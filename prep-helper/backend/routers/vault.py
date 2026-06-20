import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.config import load_config, is_vault_configured
from backend.services.vault_service import export_vault, preview_vault, import_vault

router = APIRouter(prefix="/vault", tags=["vault"])

class ExportRequest(BaseModel):
    tag_ids: list[str] | None = None
    doc_ids: list[str] | None = None
    passphrase: str = Field(..., min_length=4)

class PreviewRequest(BaseModel):
    file_path: str

class ImportRequest(BaseModel):
    file_path: str
    passphrase: str
    collision_strategy: str  # keep_mine, keep_theirs, keep_both

@router.post("/export")
async def post_export_vault(req: ExportRequest, db: AsyncSession = Depends(get_db)):
    """Exports filtered items from current vault and encrypts them using the passphrase."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault is not configured.")
    
    config = load_config()
    output_dir = os.path.join(config.vault_path, "exports")
    
    try:
        file_path = await export_vault(
            tag_ids=req.tag_ids,
            doc_ids=req.doc_ids,
            passphrase=req.passphrase,
            db=db,
            output_dir=output_dir
        )
        meta = preview_vault(file_path)
        return {
            "file_path": file_path,
            "file_name": os.path.basename(file_path),
            "item_counts": meta["item_counts"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/import/preview")
def post_import_preview(req: PreviewRequest):
    """Previews stats and metadata from a .phvault export file without decrypting it."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault is not configured.")
    
    # Try finding it relative to vault path or absolute
    target_path = req.file_path
    if not os.path.isabs(target_path):
        config = load_config()
        if config.vault_path:
            target_path = os.path.join(config.vault_path, target_path)
            
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Vault archive file not found.")
        
    try:
        meta = preview_vault(target_path)
        return meta
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to preview vault file: {str(e)}")


@router.post("/import")
async def post_import_vault(req: ImportRequest, db: AsyncSession = Depends(get_db)):
    """Decrypts and imports items from a .phvault export file, applying conflict resolution."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault is not configured.")
    
    target_path = req.file_path
    if not os.path.isabs(target_path):
        config = load_config()
        if config.vault_path:
            target_path = os.path.join(config.vault_path, target_path)
            
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Vault archive file not found.")
        
    if req.collision_strategy not in ["keep_mine", "keep_theirs", "keep_both"]:
        raise HTTPException(status_code=400, detail="Invalid collision strategy.")
        
    try:
        result = await import_vault(
            file_path=target_path,
            passphrase=req.passphrase,
            collision_strategy=req.collision_strategy,
            db=db
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
