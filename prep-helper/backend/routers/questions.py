import json
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db, Base
from backend.config import load_config, is_vault_configured
from backend.models.question import Question
from backend.models.tag import Tag, ItemTag
from backend.models.srs import SRSCard
from backend.models.document import Document
from backend.schemas.question import QuestionOut, QuestionPatch, QuestionSuggestRequest
from backend.schemas.tag import TagOut
from backend.schemas.srs import SRSStateOut
from backend.services.ai_client import get_ai_client
from backend.services.pipeline.embedder import get_collection, embed_questions

router = APIRouter(prefix="/questions", tags=["questions"])

@router.post("/suggest-metadata", response_model=dict)
async def suggest_metadata(payload: QuestionSuggestRequest, db: AsyncSession = Depends(get_db)):
    """Uses AI to estimate difficulty level and suggest tags based on question and answer text."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    q_text = payload.question_text.strip()
    a_text = payload.answer_text.strip()

    if not q_text or not a_text:
        raise HTTPException(status_code=400, detail="Both question_text and answer_text are required to suggest metadata.")

    try:
        from backend.services.ai_client import get_ai_client
        from backend.services.pipeline.tagger import tag_chunks

        ai_client = get_ai_client("tagging")  # Use the tagging task-specific client mapping
        chunks = [{"q": q_text, "a": a_text}]

        # tag_chunks resolves/seeds tags and estimates difficulty in-place
        tagged_chunks = await tag_chunks(chunks, "qa", ai_client, db)
        
        # Commit to save any newly created tags in database
        await db.commit()

        if tagged_chunks:
            res = tagged_chunks[0]
            # Resolved tags lists Tag models
            tags = [t.name for t in res.get("resolved_tags", [])]
            return {
                "difficulty": res.get("difficulty", "intermediate"),
                "tags": tags
            }

        return {"difficulty": "intermediate", "tags": []}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI metadata suggestion failed: {str(e)}")

@router.get("", response_model=dict)
async def list_questions(
    tags: list[str] = Query(None, alias="tags"),
    search: str = Query(None),
    difficulty: str = Query(None),
    bookmarked: bool = Query(None),
    doc_id: str = Query(None),
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Lists questions with multi-tag AND intersections, semantic searching, and standard attribute filters."""
    if not is_vault_configured():
        return {"data": [], "meta": {"total": 0, "limit": limit, "offset": offset}}

    # 1. Base Query Builder
    stmt = select(Question)

    # 2. Integrate Semantic Search via ChromaDB
    chroma_ids = None
    if search and search.strip():
        try:
            ai_client = get_ai_client("extraction")
            # Generate search query embedding vector
            query_emb = await ai_client.embed([search])
            if query_emb:
                collection = get_collection("questions")
                # Query Chroma
                chroma_res = collection.query(
                    query_embeddings=query_emb,
                    n_results=50,  # Grab top 50 matches
                    where={"doc_id": doc_id} if doc_id else None
                )
                if chroma_res and chroma_res["ids"] and chroma_res["ids"][0]:
                    chroma_ids = chroma_res["ids"][0]
                else:
                    # Semantic search yielded zero results
                    return {"data": [], "meta": {"total": 0, "limit": limit, "offset": offset}}
        except Exception as e:
            print(f"[Questions API] Semantic search failed/errored: {e}. Falling back to standard filters.")

    if chroma_ids is not None:
        stmt = stmt.where(Question.id.in_(chroma_ids))

    # 3. Intersect tag AND logic
    if tags:
        # Subquery finding all item_ids containing all tags
        subq = (
            select(ItemTag.item_id)
            .join(Tag, ItemTag.tag_id == Tag.id)
            .where(ItemTag.item_type == "question", Tag.name.in_(tags))
            .group_by(ItemTag.item_id)
            .having(func.count(func.distinct(Tag.name)) == len(tags))
        )
        stmt = stmt.where(Question.id.in_(subq))

    # 4. Attribute filters
    if difficulty:
        stmt = stmt.where(Question.difficulty == difficulty)
    if bookmarked is not None:
        stmt = stmt.where(Question.bookmarked == bookmarked)
    if doc_id:
        stmt = stmt.where(Question.document_id == doc_id)

    # 5. Count total matches (for pagination meta)
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_res = await db.execute(count_stmt)
    total_count = count_res.scalar() or 0

    # 6. Apply offset and limit
    # If using semantic search, we want to maintain the relevance order returned by ChromaDB
    # So if chroma_ids is active, order by the index list sequence in SQLite
    if chroma_ids:
        # A simple CASE statement to order by Chroma results sequence
        clauses = [func.case(*[(Question.id == val, idx) for idx, val in enumerate(chroma_ids)])]
        stmt = stmt.order_by(*clauses)
    else:
        stmt = stmt.order_by(Question.created_at.desc())

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    questions = res.scalars().all()

    if not questions:
        return {"data": [], "meta": {"total": total_count, "limit": limit, "offset": offset}}

    # 7. Batch fetch tags and SRS Cards to build output objects
    q_ids = [q.id for q in questions]

    # Load tags
    tag_map = {}
    tags_stmt = (
        select(ItemTag.item_id, Tag)
        .join(Tag, ItemTag.tag_id == Tag.id)
        .where(ItemTag.item_type == "question", ItemTag.item_id.in_(q_ids))
    )
    tags_res = await db.execute(tags_stmt)
    for q_id, tag in tags_res.all():
        if q_id not in tag_map:
            tag_map[q_id] = []
        tag_map[q_id].append(TagOut.model_validate(tag))

    # Load SRS Cards
    srs_map = {}
    srs_stmt = select(SRSCard).where(SRSCard.question_id.in_(q_ids))
    srs_res = await db.execute(srs_stmt)
    for card in srs_res.scalars().all():
        srs_map[card.question_id] = SRSStateOut(
            ease_factor=card.ease_factor,
            interval_days=card.interval_days,
            due_date=card.due_date,
            repetitions=card.repetitions
        )

    # 8. Construct response payloads
    data_out = []
    for q in questions:
        data_out.append(
            QuestionOut(
                id=q.id,
                document_id=q.document_id,
                question_text=q.question_text,
                answer_text=q.answer_text,
                difficulty=q.difficulty,
                source_page=q.source_page,
                order_in_doc=q.order_in_doc,
                bookmarked=q.bookmarked,
                created_at=q.created_at,
                updated_at=q.updated_at,
                tags=tag_map.get(q.id, []),
                srs_state=srs_map.get(q.id)
            )
        )

    return {
        "data": data_out,
        "meta": {
            "total": total_count,
            "limit": limit,
            "offset": offset
        }
    }


@router.get("/{id}", response_model=QuestionOut)
async def get_question(id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves a single question by its ID."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(Question).where(Question.id == id)
    res = await db.execute(stmt)
    q = res.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    # Load tags
    tags_stmt = (
        select(Tag)
        .join(ItemTag, Tag.id == ItemTag.tag_id)
        .where(ItemTag.item_type == "question", ItemTag.item_id == id)
    )
    tags_res = await db.execute(tags_stmt)
    tags_out = [TagOut.model_validate(t) for t in tags_res.scalars().all()]

    # Load SRS
    srs_stmt = select(SRSCard).where(SRSCard.question_id == id)
    srs_res = await db.execute(srs_stmt)
    card = srs_res.scalar_one_or_none()
    srs_state = None
    if card:
        srs_state = SRSStateOut(
            ease_factor=card.ease_factor,
            interval_days=card.interval_days,
            due_date=card.due_date,
            repetitions=card.repetitions
        )

    return QuestionOut(
        id=q.id,
        document_id=q.document_id,
        question_text=q.question_text,
        answer_text=q.answer_text,
        difficulty=q.difficulty,
        source_page=q.source_page,
        order_in_doc=q.order_in_doc,
        bookmarked=q.bookmarked,
        created_at=q.created_at,
        updated_at=q.updated_at,
        tags=tags_out,
        srs_state=srs_state
    )


@router.patch("/{id}", response_model=QuestionOut)
async def patch_question(id: str, payload: QuestionPatch, db: AsyncSession = Depends(get_db)):
    """Updates attributes of a question, resolves inline tag changes, and updates vector store representations."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(Question).where(Question.id == id)
    res = await db.execute(stmt)
    q = res.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    # 1. Update primitive attributes
    if payload.question_text is not None:
        q.question_text = payload.question_text
    if payload.answer_text is not None:
        q.answer_text = payload.answer_text
    if payload.bookmarked is not None:
        q.bookmarked = payload.bookmarked
    if payload.difficulty is not None:
        q.difficulty = payload.difficulty

    q.updated_at = datetime.utcnow()

    # 2. Handle Tag removals
    if payload.remove_tags:
        for t_name in payload.remove_tags:
            t_name = t_name.strip()
            if not t_name:
                continue
            # Find the tag
            t_stmt = select(Tag).where(Tag.name == t_name)
            t_res = await db.execute(t_stmt)
            tag_obj = t_res.scalar_one_or_none()
            if tag_obj:
                # Check mapping
                assoc_stmt = select(ItemTag).where(ItemTag.item_type == "question", ItemTag.item_id == id, ItemTag.tag_id == tag_obj.id)
                assoc_res = await db.execute(assoc_stmt)
                assoc = assoc_res.scalar_one_or_none()
                if assoc:
                    await db.delete(assoc)
                    tag_obj.usage_count = max(0, tag_obj.usage_count - 1)

    # 3. Handle Tag additions (supports custom tags creation)
    if payload.add_tags:
        for t_name in payload.add_tags:
            t_name = t_name.strip()
            if not t_name:
                continue
            # Check if tag exists
            t_stmt = select(Tag).where(Tag.name == t_name)
            t_res = await db.execute(t_stmt)
            tag_obj = t_res.scalar_one_or_none()
            
            if not tag_obj:
                # Create custom tag
                tag_obj = Tag(name=t_name, tag_type="custom", usage_count=0)
                db.add(tag_obj)
                await db.flush()

            # Link tag if not already linked
            assoc_stmt = select(ItemTag).where(ItemTag.item_type == "question", ItemTag.item_id == id, ItemTag.tag_id == tag_obj.id)
            assoc_res = await db.execute(assoc_stmt)
            assoc = assoc_res.scalar_one_or_none()
            if not assoc:
                assoc = ItemTag(item_type="question", item_id=id, tag_id=tag_obj.id)
                db.add(assoc)
                tag_obj.usage_count += 1

    await db.commit()

    # 4. Refresh vector index representation in Chroma DB
    try:
        ai_client = get_ai_client("extraction")
        await embed_questions([q], ai_client, db)
    except Exception as e:
        print(f"[Questions API] Warning: failed to re-embed updated question {id} in Chroma: {e}")

    # Fetch updated question details
    return await get_question(id, db)


@router.delete("/{id}")
async def delete_question(id: str, db: AsyncSession = Depends(get_db)):
    """Deletes a question, cascades deletes to srs_cards, clears ItemTag mappings, and drops vector index."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(Question).where(Question.id == id)
    res = await db.execute(stmt)
    q = res.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    # 1. Decrement tag usage counts
    tags_stmt = select(Tag).join(ItemTag, Tag.id == ItemTag.tag_id).where(ItemTag.item_type == "question", ItemTag.item_id == id)
    tags_res = await db.execute(tags_stmt)
    tags_linked = tags_res.scalars().all()
    for t in tags_linked:
        t.usage_count = max(0, t.usage_count - 1)

    # 2. Clear ItemTag associations
    await db.execute(delete(ItemTag).where(ItemTag.item_type == "question", ItemTag.item_id == id))

    # 3. Delete Question (cascades to SRSCard at SQL level)
    await db.execute(delete(SRSCard).where(SRSCard.question_id == id))
    await db.execute(delete(Question).where(Question.id == id))
    await db.commit()

    # 4. Remove from Chroma vector index
    try:
        col = get_collection("questions")
        col.delete(ids=[id])
    except Exception as e:
        print(f"[Questions API] Warning: failed to delete question {id} from Chroma: {e}")

    return {"success": True, "detail": "Question successfully deleted."}
