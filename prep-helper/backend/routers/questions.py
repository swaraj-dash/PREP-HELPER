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
from backend.schemas.question import QuestionOut, QuestionPatch, QuestionSuggestRequest, QuestionSource
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

import re

def normalize_text(text: str) -> str:
    # remove punctuation, spacing, and lowercase
    return re.sub(r'\W+', '', text.lower())

async def synthesize_combined_answer(questions: list[Question]) -> str:
    # Build prompt with all raw answers
    answers_str = ""
    for idx, q in enumerate(questions):
        answers_str += f"Answer {idx + 1}:\n{q.answer_text}\n\n"
    
    system_prompt = (
        "You are an expert technical tutor. You are given multiple answers to the same question from different study notes.\n"
        "Your task is to diagnose all the answers and formulate a single, unified, high-quality, comprehensive, and clear combined answer.\n"
        "The combined answer should be highly formatted (use markdown bullet points, bold text, or code snippets if appropriate), clear, professional, and easy to read.\n"
        "Do not mention 'Answer 1', 'Answer 2', or any meta-talk like 'Here is the combined answer...'. Just output the synthesized answer directly."
    )
    user_prompt = f"Question: {questions[0].question_text}\n\nHere are the raw answers to synthesize:\n{answers_str}"
    
    try:
        from backend.services.ai_client import get_ai_client
        ai_client = get_ai_client("reasoning")
        response = await ai_client.complete(system=system_prompt, user=user_prompt, json_mode=False)
        return response.strip()
    except Exception as e:
        print(f"[Synthesizer] Error synthesizing combined answer: {e}")
        # Return the longest raw answer as fallback
        return max([q.answer_text for q in questions], key=len)

async def group_question_sources(rep: Question, db: AsyncSession, tag_map=None, srs_map=None):
    # Find all questions with the same normalized text
    stmt_all = select(Question)
    res_all = await db.execute(stmt_all)
    all_qs = res_all.scalars().all()
    q_norm = normalize_text(rep.question_text)
    group_qs = [item for item in all_qs if normalize_text(item.question_text) == q_norm]
    
    # Load document names
    doc_ids = list(set(m.document_id for m in group_qs))
    doc_map = {}
    if doc_ids:
        doc_stmt = select(Document.id, Document.original_name).where(Document.id.in_(doc_ids))
        doc_res = await db.execute(doc_stmt)
        doc_map = {d_id: orig_name for d_id, orig_name in doc_res.all()}
        
    # Load tags if not provided
    q_ids = [m.id for m in group_qs]
    if tag_map is None:
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
            
    # Load SRS mapping if not provided
    if srs_map is None:
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
            
    merged_tags = []
    seen_tag_ids = set()
    for member in group_qs:
        for tag in tag_map.get(member.id, []):
            if tag.id not in seen_tag_ids:
                seen_tag_ids.add(tag.id)
                merged_tags.append(tag)
                
    srs_state = None
    for member in group_qs:
        if member.id in srs_map:
            srs_state = srs_map[member.id]
            break
            
    combined = None
    if len(group_qs) > 1:
        # Check if any member has combined_answer set in the database
        for member in group_qs:
            if member.combined_answer:
                combined = member.combined_answer
                break
        if not combined:
            combined = await synthesize_combined_answer(group_qs)
            for member in group_qs:
                member.combined_answer = combined
            await db.commit()
            
    return QuestionOut(
        id=rep.id,
        document_id=rep.document_id,
        question_text=rep.question_text,
        answer_text=rep.answer_text,
        difficulty=rep.difficulty,
        source_page=rep.source_page,
        order_in_doc=rep.order_in_doc,
        bookmarked=any(m.bookmarked for m in group_qs),
        created_at=rep.created_at,
        updated_at=rep.updated_at,
        tags=merged_tags,
        srs_state=srs_state,
        combined_answer=combined,
        sources=[
            QuestionSource(
                question_id=m.id,
                document_id=m.document_id,
                document_name=doc_map.get(m.document_id, "Unknown PDF"),
                answer_text=m.answer_text,
                source_page=m.source_page
            )
            for m in group_qs
        ]
    )

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
    """Lists questions with multi-tag AND intersections, semantic searching, similarity grouping, and standard filters."""
    if not is_vault_configured():
        return {"data": [], "meta": {"total": 0, "limit": limit, "offset": offset}}

    # 1. Base Query Builder
    stmt = select(Question)

    # 2. Integrate Semantic Search via ChromaDB
    chroma_ids = None
    if search and search.strip():
        try:
            ai_client = get_ai_client("extraction")
            query_emb = await ai_client.embed([search])
            if query_emb:
                collection = get_collection("questions")
                chroma_res = collection.query(
                    query_embeddings=query_emb,
                    n_results=50,
                    where={"doc_id": doc_id} if doc_id else None
                )
                if chroma_res and chroma_res["ids"] and chroma_res["ids"][0]:
                    chroma_ids = chroma_res["ids"][0]
                else:
                    return {"data": [], "meta": {"total": 0, "limit": limit, "offset": offset}}
        except Exception as e:
            print(f"[Questions API] Semantic search failed/errored: {e}. Falling back to standard filters.")

    if chroma_ids is not None:
        stmt = stmt.where(Question.id.in_(chroma_ids))

    # 3. Intersect tag AND logic
    if tags:
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

    # Order query
    if chroma_ids:
        clauses = [func.case(*[(Question.id == val, idx) for idx, val in enumerate(chroma_ids)])]
        stmt = stmt.order_by(*clauses)
    else:
        stmt = stmt.order_by(Question.created_at.desc())

    # Execute statement to fetch all filtered questions to group in Python
    res = await db.execute(stmt)
    all_filtered = res.scalars().all()

    if not all_filtered:
        return {"data": [], "meta": {"total": 0, "limit": limit, "offset": offset}}

    # Group questions by similarity
    groups = {}
    ordered_groups = []
    for q in all_filtered:
        norm = normalize_text(q.question_text)
        if norm not in groups:
            groups[norm] = []
            ordered_groups.append(norm)
        groups[norm].append(q)

    total_grouped_count = len(ordered_groups)

    # Slice groups based on pagination limit/offset
    paginated_norms = ordered_groups[offset : offset + limit]

    # Gather all questions that we will actually display
    display_questions = []
    for norm in paginated_norms:
        display_questions.extend(groups[norm])

    if not display_questions:
        return {"data": [], "meta": {"total": total_grouped_count, "limit": limit, "offset": offset}}

    display_q_ids = [q.id for q in display_questions]

    # Batch fetch tags for display questions
    tag_map = {}
    tags_stmt = (
        select(ItemTag.item_id, Tag)
        .join(Tag, ItemTag.tag_id == Tag.id)
        .where(ItemTag.item_type == "question", ItemTag.item_id.in_(display_q_ids))
    )
    tags_res = await db.execute(tags_stmt)
    for q_id, tag in tags_res.all():
        if q_id not in tag_map:
            tag_map[q_id] = []
        tag_map[q_id].append(TagOut.model_validate(tag))

    # Batch fetch SRS states
    srs_map = {}
    srs_stmt = select(SRSCard).where(SRSCard.question_id.in_(display_q_ids))
    srs_res = await db.execute(srs_stmt)
    for card in srs_res.scalars().all():
        srs_map[card.question_id] = SRSStateOut(
            ease_factor=card.ease_factor,
            interval_days=card.interval_days,
            due_date=card.due_date,
            repetitions=card.repetitions
        )

    # Batch load filenames for these documents
    doc_ids = list(set(q.document_id for q in display_questions))
    doc_map = {}
    if doc_ids:
        doc_stmt = select(Document.id, Document.original_name).where(Document.id.in_(doc_ids))
        doc_res = await db.execute(doc_stmt)
        doc_map = {d_id: orig_name for d_id, orig_name in doc_res.all()}

    # Construct response payloads
    data_out = []
    for norm in paginated_norms:
        group_members = groups[norm]
        rep = group_members[0]

        # Merge tags of all members in group
        merged_tags = []
        seen_tag_ids = set()
        for member in group_members:
            for tag in tag_map.get(member.id, []):
                if tag.id not in seen_tag_ids:
                    seen_tag_ids.add(tag.id)
                    merged_tags.append(tag)

        # Resolve SRS state
        srs_state = None
        for member in group_members:
            if member.id in srs_map:
                srs_state = srs_map[member.id]
                break

        # Resolve Combined Answer
        combined = None
        if len(group_members) > 1:
            for member in group_members:
                if member.combined_answer:
                    combined = member.combined_answer
                    break
            if not combined:
                combined = await synthesize_combined_answer(group_members)
                for member in group_members:
                    member.combined_answer = combined
                await db.commit()

        # Build sources list
        sources = [
            QuestionSource(
                question_id=m.id,
                document_id=m.document_id,
                document_name=doc_map.get(m.document_id, "Unknown PDF"),
                answer_text=m.answer_text,
                source_page=m.source_page
            )
            for m in group_members
        ]

        data_out.append(
            QuestionOut(
                id=rep.id,
                document_id=rep.document_id,
                question_text=rep.question_text,
                answer_text=rep.answer_text,
                difficulty=rep.difficulty,
                source_page=rep.source_page,
                order_in_doc=rep.order_in_doc,
                bookmarked=any(m.bookmarked for m in group_members),
                created_at=rep.created_at,
                updated_at=rep.updated_at,
                tags=merged_tags,
                srs_state=srs_state,
                combined_answer=combined,
                sources=sources
            )
        )

    return {
        "data": data_out,
        "meta": {
            "total": total_grouped_count,
            "limit": limit,
            "offset": offset
        }
    }

@router.get("/{id}", response_model=QuestionOut)
async def get_question(id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves a single question by its ID, grouped with duplicates if present."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(Question).where(Question.id == id)
    res = await db.execute(stmt)
    q = res.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    return await group_question_sources(q, db)


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
