import os
import uuid
import json
import aiofiles
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Depends
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.config import load_config, is_vault_configured
from backend.models.document import Document
from backend.models.question import Question
from backend.models.note import Note
from backend.models.tag import Tag, ItemTag
from backend.models.srs import SRSCard
from backend.schemas.document import DocumentUploadResponse, DocumentSummary, DocumentDetail
from backend.services.pipeline.orchestrator import run_pipeline
from backend.services.pipeline.embedder import get_collection

router = APIRouter(prefix="/documents", tags=["documents"])

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".pptx", ".txt", ".md", ".png", ".jpg", ".jpeg"}

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Uploads a study document and schedules the processing pipeline in the background."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault directory is not configured.")

    config = load_config()
    
    # 1. Validate file extension
    original_name = file.filename
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format '{ext}'. Supported formats: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    # 2. Save file to vault upload folder with unique uuid name
    doc_id = str(uuid.uuid4())
    filename = f"{doc_id}{ext}"
    upload_dir = os.path.join(config.vault_path, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)

    try:
        async with aiofiles.open(file_path, "wb") as out_file:
            while content := await file.read(1024 * 1024):  # read 1MB chunks
                await out_file.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file to disk: {str(e)}")

    # 3. Create document record in database
    doc_record = Document(
        id=doc_id,
        filename=filename,
        original_name=original_name,
        file_type=ext.replace(".", ""),
        status="queued"
    )
    db.add(doc_record)
    await db.commit()

    # 4. Launch ingestion task in background
    background_tasks.add_task(run_pipeline, doc_id, file_path, original_name)

    return {"doc_id": doc_id}


@router.get("", response_model=list[DocumentSummary])
async def list_documents(db: AsyncSession = Depends(get_db)):
    """Returns a list of all documents sorted by upload date descending."""
    if not is_vault_configured():
        return []
    
    stmt = select(Document).order_by(Document.uploaded_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{id}", response_model=DocumentDetail)
async def get_document(id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves detailed metadata for a single document."""
    if not is_vault_configured():
        raise HTTPException(status_code=400, detail="Vault not configured.")

    stmt = select(Document).where(Document.id == id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@router.delete("/{id}")
async def delete_document(id: str, confirm: bool = False, db: AsyncSession = Depends(get_db)):
    """Deletes a document, cascades deletions to its questions, notes, SRS progress, and tags,
    removes the original file from disk, and drops references from ChromaDB collections.
    """
    if not confirm:
        raise HTTPException(status_code=400, detail="Must pass confirm=true query parameter to verify deletion.")

    config = load_config()

    # Fetch document
    stmt = select(Document).where(Document.id == id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # 1. Fetch related questions and notes to remove tags and srs mappings
    res_q = await db.execute(select(Question.id).where(Question.document_id == id))
    question_ids = [row[0] for row in res_q.all()]

    res_n = await db.execute(select(Note.id).where(Note.document_id == id))
    note_ids = [row[0] for row in res_n.all()]

    # 2. Delete tags associations from ItemTag
    item_ids = question_ids + note_ids
    if item_ids:
        # Fetch tags to update usage counts
        stmt_t = select(Tag).join(ItemTag, Tag.id == ItemTag.tag_id).where(ItemTag.item_id.in_(item_ids))
        res_t = await db.execute(stmt_t)
        affected_tags = res_t.scalars().all()
        for t in affected_tags:
            # We decrement usage count for each occurrence in item_tags
            # Simple select count
            cnt_stmt = select(ItemTag).where(ItemTag.tag_id == t.id, ItemTag.item_id.in_(item_ids))
            cnt_res = await db.execute(cnt_stmt)
            count = len(cnt_res.all())
            t.usage_count = max(0, t.usage_count - count)

        # Delete associations
        await db.execute(delete(ItemTag).where(ItemTag.item_id.in_(item_ids)))

    # 3. SQLite cascades Question, Note, and SRSCard deletions automatically if configured.
    # To be safe against sqlite settings, run explicit deletions:
    if question_ids:
        await db.execute(delete(SRSCard).where(SRSCard.question_id.in_(question_ids)))
        await db.execute(delete(Question).where(Question.id.in_(question_ids)))
    if note_ids:
        await db.execute(delete(Note).where(Note.id.in_(note_ids)))

    # Delete Document row
    await db.execute(delete(Document).where(Document.id == id))
    await db.commit()

    # 4. Delete the physical file from disk
    file_path = os.path.join(config.vault_path, "uploads", doc.filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"[Document Delete] Warning: failed to delete physical file {file_path}: {e}")

    # 5. Delete document vectors from Chroma collections
    try:
        q_col = get_collection("questions")
        q_col.delete(where={"doc_id": id})
        
        n_col = get_collection("notes")
        n_col.delete(where={"doc_id": id})
    except Exception as e:
        print(f"[Document Delete] Warning: failed to delete vectors from ChromaDB: {e}")

    return {"success": True, "detail": "Document and all related contents successfully deleted."}


@router.post("/{id}/reprocess", response_model=DocumentUploadResponse)
async def reprocess_document(
    id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Resets document state, clears existing structured extraction data/vectors, and restarts ingestion."""
    config = load_config()

    stmt = select(Document).where(Document.id == id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # 1. Find related questions and notes
    res_q = await db.execute(select(Question.id).where(Question.document_id == id))
    question_ids = [row[0] for row in res_q.all()]

    res_n = await db.execute(select(Note.id).where(Note.document_id == id))
    note_ids = [row[0] for row in res_n.all()]

    # 2. Clear previous associations and tags
    item_ids = question_ids + note_ids
    if item_ids:
        # Decrement tag usage counts
        stmt_t = select(Tag).join(ItemTag, Tag.id == ItemTag.tag_id).where(ItemTag.item_id.in_(item_ids))
        res_t = await db.execute(stmt_t)
        affected_tags = res_t.scalars().all()
        for t in affected_tags:
            cnt_stmt = select(ItemTag).where(ItemTag.tag_id == t.id, ItemTag.item_id.in_(item_ids))
            cnt_res = await db.execute(cnt_stmt)
            count = len(cnt_res.all())
            t.usage_count = max(0, t.usage_count - count)

        await db.execute(delete(ItemTag).where(ItemTag.item_id.in_(item_ids)))

    if question_ids:
        await db.execute(delete(SRSCard).where(SRSCard.question_id.in_(question_ids)))
        await db.execute(delete(Question).where(Question.id.in_(question_ids)))
    if note_ids:
        await db.execute(delete(Note).where(Note.id.in_(note_ids)))

    # 3. Update document status
    doc.status = "queued"
    doc.question_count = 0
    doc.note_count = 0
    doc.chunk_count = 0
    doc.error_message = None
    doc.tag_summary = None
    await db.commit()

    # 4. Delete vectors from ChromaDB
    try:
        q_col = get_collection("questions")
        q_col.delete(where={"doc_id": id})
        
        n_col = get_collection("notes")
        n_col.delete(where={"doc_id": id})
    except Exception as e:
        print(f"[Reprocess] Warning: failed to clear ChromaDB vectors: {e}")

    # 5. Start background task
    file_path = os.path.join(config.vault_path, "uploads", doc.filename)
    background_tasks.add_task(run_pipeline, id, file_path, doc.original_name)

    return {"doc_id": id}
