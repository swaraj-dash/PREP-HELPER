from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.config import is_vault_configured
from backend.models.tag import Tag, ItemTag
from backend.schemas.tag import TagOut, TagCreate, TagMerge, TagPatch

router = APIRouter(prefix="/tags", tags=["tags"])

@router.get("", response_model=list[TagOut])
async def list_tags(
    tag_type: str = Query(None, alias="type"),
    search: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Lists all tags in the vault sorted by usage count descending, optionally filtered by type or name search."""
    if not is_vault_configured():
        return []

    stmt = select(Tag)
    if tag_type:
        stmt = stmt.where(Tag.tag_type == tag_type)
    if search:
        stmt = stmt.where(Tag.name.ilike(f"%{search}%"))

    stmt = stmt.order_by(Tag.usage_count.desc(), Tag.name.asc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("", response_model=TagOut)
async def create_tag(payload: TagCreate, db: AsyncSession = Depends(get_db)):
    """Creates a new user custom tag."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    name_stripped = payload.name.strip()
    if not name_stripped:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty.")

    # Check for duplicate name case-insensitively
    stmt = select(Tag).where(Tag.name.ilike(name_stripped))
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Tag '{name_stripped}' already exists.")

    new_tag = Tag(name=name_stripped, tag_type=payload.tag_type, usage_count=0)
    db.add(new_tag)
    await db.commit()
    await db.refresh(new_tag)
    return new_tag


@router.patch("/{id}", response_model=TagOut)
async def patch_tag(id: str, payload: TagPatch, db: AsyncSession = Depends(get_db)):
    """Updates attributes of a tag (name or type)."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(Tag).where(Tag.id == id)
    res = await db.execute(stmt)
    tag = res.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found.")

    if payload.name is not None:
        name_stripped = payload.name.strip()
        if not name_stripped:
            raise HTTPException(status_code=400, detail="Tag name cannot be empty.")
        if name_stripped != tag.name:
            # Check for duplicate
            dup_stmt = select(Tag).where(Tag.name.ilike(name_stripped))
            dup_res = await db.execute(dup_stmt)
            if dup_res.scalar_one_or_none():
                raise HTTPException(status_code=400, detail=f"Tag '{name_stripped}' already exists.")
            tag.name = name_stripped

    if payload.tag_type is not None:
        tag.tag_type = payload.tag_type

    await db.commit()
    await db.refresh(tag)
    return tag


@router.post("/merge", response_model=TagOut)
async def merge_tags(payload: TagMerge, db: AsyncSession = Depends(get_db)):
    """Merges a duplicate source tag into a target tag, remapping all questions and notes."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    if payload.source_tag_id == payload.target_tag_id:
        raise HTTPException(status_code=400, detail="Cannot merge a tag into itself.")

    # Fetch source tag
    src_stmt = select(Tag).where(Tag.id == payload.source_tag_id)
    src_res = await db.execute(src_stmt)
    src_tag = src_res.scalar_one_or_none()
    if not src_tag:
        raise HTTPException(status_code=404, detail="Source tag not found.")

    # Fetch target tag
    tgt_stmt = select(Tag).where(Tag.id == payload.target_tag_id)
    tgt_res = await db.execute(tgt_stmt)
    tgt_tag = tgt_res.scalar_one_or_none()
    if not tgt_tag:
        raise HTTPException(status_code=404, detail="Target tag not found.")

    # 1. Find all item IDs mapped to the target tag
    target_items_stmt = select(ItemTag.item_id).where(ItemTag.tag_id == tgt_tag.id)
    target_items_res = await db.execute(target_items_stmt)
    tgt_item_ids = list(target_items_res.scalars().all())

    # 2. Delete source mappings for items that already carry the target tag to prevent primary key collisions
    if tgt_item_ids:
        del_dup_stmt = delete(ItemTag).where(
            ItemTag.tag_id == src_tag.id,
            ItemTag.item_id.in_(tgt_item_ids)
        )
        await db.execute(del_dup_stmt)

    # 3. Update remaining source tag links to point to target tag
    update_stmt = select(ItemTag).where(ItemTag.tag_id == src_tag.id)
    update_res = await db.execute(update_stmt)
    for item_link in update_res.scalars().all():
        item_link.tag_id = tgt_tag.id

    await db.flush()

    # 4. Delete source tag
    await db.delete(src_tag)

    # 5. Recalculate target tag usage_count
    count_stmt = select(func.count()).select_from(ItemTag).where(ItemTag.tag_id == tgt_tag.id)
    count_res = await db.execute(count_stmt)
    tgt_tag.usage_count = count_res.scalar() or 0

    await db.commit()
    await db.refresh(tgt_tag)

    # 6. Rebuild ChromaDB indexes to keep semantic filters in sync
    try:
        from backend.services.ai_client import get_ai_client
        from backend.services.pipeline.embedder import rebuild_index
        ai_client = get_ai_client("extraction")
        await rebuild_index(db, ai_client)
    except Exception as e:
        print(f"[Tags Merge] Warning: failed to rebuild ChromaDB indexes: {e}")

    return tgt_tag


@router.delete("/{id}")
async def delete_tag(id: str, force: bool = Query(False), db: AsyncSession = Depends(get_db)):
    """Deletes a tag, optionally forcing cleanup of note and question links."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(Tag).where(Tag.id == id)
    res = await db.execute(stmt)
    tag = res.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found.")

    if tag.usage_count > 0 and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Tag '{tag.name}' is currently in use by {tag.usage_count} items. Use force=true to delete."
        )

    # Remove all references in item_tags table
    await db.execute(delete(ItemTag).where(ItemTag.tag_id == id))
    await db.delete(tag)
    await db.commit()

    # Rebuild ChromaDB indexes
    try:
        from backend.services.ai_client import get_ai_client
        from backend.services.pipeline.embedder import rebuild_index
        ai_client = get_ai_client("extraction")
        await rebuild_index(db, ai_client)
    except Exception as e:
        print(f"[Tags Delete] Warning: failed to rebuild ChromaDB indexes: {e}")

    return {"success": True, "detail": "Tag successfully deleted."}
