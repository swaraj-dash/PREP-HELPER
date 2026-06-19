import json
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.config import load_config, is_vault_configured
from backend.models.note import Note
from backend.models.tag import Tag, ItemTag
from backend.models.document import Document
from backend.schemas.note import NoteOut, NotePatch
from backend.schemas.tag import TagOut
from backend.services.ai_client import get_ai_client
from backend.services.pipeline.embedder import get_collection, embed_notes

router = APIRouter(prefix="/notes", tags=["notes"])

@router.get("", response_model=dict)
async def list_notes(
    tags: list[str] = Query(None, alias="tags"),
    search: str = Query(None),
    doc_id: str = Query(None),
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Lists study notes with tag AND intersections and semantic vector search."""
    if not is_vault_configured():
        return {"data": [], "meta": {"total": 0, "limit": limit, "offset": offset}}

    stmt = select(Note)

    # Semantic Search via ChromaDB
    chroma_ids = None
    if search and search.strip():
        try:
            ai_client = get_ai_client("extraction")
            query_emb = await ai_client.embed([search])
            if query_emb:
                collection = get_collection("notes")
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
            print(f"[Notes API] Semantic search failed/errored: {e}")

    if chroma_ids is not None:
        stmt = stmt.where(Note.id.in_(chroma_ids))

    # Tag AND logic
    if tags:
        subq = (
            select(ItemTag.item_id)
            .join(Tag, ItemTag.tag_id == Tag.id)
            .where(ItemTag.item_type == "note", Tag.name.in_(tags))
            .group_by(ItemTag.item_id)
            .having(func.count(func.distinct(Tag.name)) == len(tags))
        )
        stmt = stmt.where(Note.id.in_(subq))

    if doc_id:
        stmt = stmt.where(Note.document_id == doc_id)

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_res = await db.execute(count_stmt)
    total_count = count_res.scalar() or 0

    # Order by
    if chroma_ids:
        clauses = [func.case(*[(Note.id == val, idx) for idx, val in enumerate(chroma_ids)])]
        stmt = stmt.order_by(*clauses)
    else:
        stmt = stmt.order_by(Note.topic_order.asc(), Note.order_index.asc())

    stmt = stmt.offset(offset).limit(limit)
    res = await db.execute(stmt)
    notes = res.scalars().all()

    if not notes:
        return {"data": [], "meta": {"total": total_count, "limit": limit, "offset": offset}}

    # Load tags and documents mapping
    n_ids = [n.id for n in notes]
    doc_ids = list(set(n.document_id for n in notes))

    # Fetch document names
    doc_stmt = select(Document.id, Document.original_name).where(Document.id.in_(doc_ids))
    doc_res = await db.execute(doc_stmt)
    doc_map = {d_id: orig_name for d_id, orig_name in doc_res.all()}

    # Fetch tags
    tag_map = {}
    tags_stmt = (
        select(ItemTag.item_id, Tag)
        .join(Tag, ItemTag.tag_id == Tag.id)
        .where(ItemTag.item_type == "note", ItemTag.item_id.in_(n_ids))
    )
    tags_res = await db.execute(tags_stmt)
    for n_id, tag in tags_res.all():
        if n_id not in tag_map:
            tag_map[n_id] = []
        tag_map[n_id].append(TagOut.model_validate(tag))

    data_out = []
    for n in notes:
        data_out.append(
            NoteOut(
                id=n.id,
                document_id=n.document_id,
                heading=n.heading,
                content=n.content,
                content_type=n.content_type,
                order_index=n.order_index,
                topic_order=n.topic_order,
                created_at=n.created_at,
                tags=tag_map.get(n.id, []),
                source_doc_name=doc_map.get(n.document_id, "Unknown Document")
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


@router.get("/topic/{tag_name}", response_model=list[NoteOut])
async def get_notes_by_topic(tag_name: str, db: AsyncSession = Depends(get_db)):
    """Retrieves all notes associated with a given topic, ordered by learning sequence."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    # Find the tag ID
    tag_stmt = select(Tag).where(Tag.name == tag_name)
    tag_res = await db.execute(tag_stmt)
    tag = tag_res.scalar_one_or_none()
    if not tag:
        return []

    # Get notes associated with this tag
    stmt = (
        select(Note)
        .join(ItemTag, Note.id == ItemTag.item_id)
        .where(ItemTag.item_type == "note", ItemTag.tag_id == tag.id)
        .order_by(Note.topic_order.asc(), Note.order_index.asc())
    )
    res = await db.execute(stmt)
    notes = res.scalars().all()

    if not notes:
        return []

    n_ids = [n.id for n in notes]
    doc_ids = list(set(n.document_id for n in notes))

    # Fetch document names
    doc_stmt = select(Document.id, Document.original_name).where(Document.id.in_(doc_ids))
    doc_res = await db.execute(doc_stmt)
    doc_map = {d_id: orig_name for d_id, orig_name in doc_res.all()}

    # Fetch tags for each note
    tag_map = {}
    tags_stmt = (
        select(ItemTag.item_id, Tag)
        .join(Tag, ItemTag.tag_id == Tag.id)
        .where(ItemTag.item_type == "note", ItemTag.item_id.in_(n_ids))
    )
    tags_res = await db.execute(tags_stmt)
    for n_id, t in tags_res.all():
        if n_id not in tag_map:
            tag_map[n_id] = []
        tag_map[n_id].append(TagOut.model_validate(t))

    return [
        NoteOut(
            id=n.id,
            document_id=n.document_id,
            heading=n.heading,
            content=n.content,
            content_type=n.content_type,
            order_index=n.order_index,
            topic_order=n.topic_order,
            created_at=n.created_at,
            tags=tag_map.get(n.id, []),
            source_doc_name=doc_map.get(n.document_id, "Unknown Document")
        )
        for n in notes
    ]


@router.patch("/{id}", response_model=NoteOut)
async def patch_note(id: str, payload: NotePatch, db: AsyncSession = Depends(get_db)):
    """Updates a note, modifies tag associations, and syncs vector index."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(Note).where(Note.id == id)
    res = await db.execute(stmt)
    n = res.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found.")

    if payload.heading is not None:
        n.heading = payload.heading
    if payload.content is not None:
        n.content = payload.content
    if payload.content_type is not None:
        n.content_type = payload.content_type

    # Handle tag removals
    if payload.remove_tags:
        for t_name in payload.remove_tags:
            t_name = t_name.strip()
            if not t_name:
                continue
            t_stmt = select(Tag).where(Tag.name == t_name)
            t_res = await db.execute(t_stmt)
            tag_obj = t_res.scalar_one_or_none()
            if tag_obj:
                assoc_stmt = select(ItemTag).where(ItemTag.item_type == "note", ItemTag.item_id == id, ItemTag.tag_id == tag_obj.id)
                assoc_res = await db.execute(assoc_stmt)
                assoc = assoc_res.scalar_one_or_none()
                if assoc:
                    await db.delete(assoc)
                    tag_obj.usage_count = max(0, tag_obj.usage_count - 1)

    # Handle tag additions (supports custom creation)
    if payload.add_tags:
        for t_name in payload.add_tags:
            t_name = t_name.strip()
            if not t_name:
                continue
            t_stmt = select(Tag).where(Tag.name == t_name)
            t_res = await db.execute(t_stmt)
            tag_obj = t_res.scalar_one_or_none()
            if not tag_obj:
                tag_obj = Tag(name=t_name, tag_type="custom", usage_count=0)
                db.add(tag_obj)
                await db.flush()

            assoc_stmt = select(ItemTag).where(ItemTag.item_type == "note", ItemTag.item_id == id, ItemTag.tag_id == tag_obj.id)
            assoc_res = await db.execute(assoc_stmt)
            assoc = assoc_res.scalar_one_or_none()
            if not assoc:
                assoc = ItemTag(item_type="note", item_id=id, tag_id=tag_obj.id)
                db.add(assoc)
                tag_obj.usage_count += 1

    await db.commit()

    # Re-embed note in ChromaDB
    try:
        ai_client = get_ai_client("extraction")
        await embed_notes([n], ai_client, db)
    except Exception as e:
        print(f"[Notes Router] Warning: failed to re-embed note {id}: {e}")

    # Return refreshed note
    return await get_note_by_id(id, db)


async def get_note_by_id(id: str, db: AsyncSession):
    stmt = select(Note).where(Note.id == id)
    res = await db.execute(stmt)
    n = res.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found.")

    doc_stmt = select(Document.original_name).where(Document.id == n.document_id)
    doc_res = await db.execute(doc_stmt)
    orig_name = doc_res.scalar() or "Unknown Document"

    tags_stmt = (
        select(Tag)
        .join(ItemTag, Tag.id == ItemTag.tag_id)
        .where(ItemTag.item_type == "note", ItemTag.item_id == id)
    )
    tags_res = await db.execute(tags_stmt)
    tags_out = [TagOut.model_validate(t) for t in tags_res.scalars().all()]

    return NoteOut(
        id=n.id,
        document_id=n.document_id,
        heading=n.heading,
        content=n.content,
        content_type=n.content_type,
        order_index=n.order_index,
        topic_order=n.topic_order,
        created_at=n.created_at,
        tags=tags_out,
        source_doc_name=orig_name
    )
