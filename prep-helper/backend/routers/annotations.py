from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.config import is_vault_configured
from backend.models.srs import UserAnnotation
from backend.schemas.annotation import UserAnnotationOut, UserAnnotationCreate, UserAnnotationUpdate

router = APIRouter(prefix="/annotations", tags=["annotations"])

@router.post("", response_model=UserAnnotationOut)
async def create_annotation(payload: UserAnnotationCreate, db: AsyncSession = Depends(get_db)):
    """Creates a user annotation linked to a question or note."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    annotation = UserAnnotation(
        item_type=payload.item_type,
        item_id=payload.item_id,
        annotation_text=payload.annotation_text
    )
    db.add(annotation)
    await db.commit()
    await db.refresh(annotation)
    return annotation


@router.get("/{item_type}/{item_id}", response_model=list[UserAnnotationOut])
async def get_annotations(item_type: str, item_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves all annotations linked to a specific item."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    if item_type not in ["question", "note"]:
        raise HTTPException(status_code=400, detail="Invalid item_type.")

    stmt = select(UserAnnotation).where(
        UserAnnotation.item_type == item_type,
        UserAnnotation.item_id == item_id
    ).order_by(UserAnnotation.created_at.desc())
    
    res = await db.execute(stmt)
    return res.scalars().all()


@router.put("/{id}", response_model=UserAnnotationOut)
async def update_annotation(id: str, payload: UserAnnotationUpdate, db: AsyncSession = Depends(get_db)):
    """Modifies the content text of a specific annotation."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(UserAnnotation).where(UserAnnotation.id == id)
    res = await db.execute(stmt)
    annotation = res.scalar_one_or_none()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found.")

    annotation.annotation_text = payload.annotation_text
    await db.commit()
    await db.refresh(annotation)
    return annotation


@router.delete("/{id}")
async def delete_annotation(id: str, db: AsyncSession = Depends(get_db)):
    """Deletes a specific annotation."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(UserAnnotation).where(UserAnnotation.id == id)
    res = await db.execute(stmt)
    annotation = res.scalar_one_or_none()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found.")

    await db.delete(annotation)
    await db.commit()
    return {"success": True, "detail": "Annotation successfully deleted."}
