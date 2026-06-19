from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.config import is_vault_configured
from backend.models.tag import Tag
from backend.schemas.tag import TagOut

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
