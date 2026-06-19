from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from backend.schemas.tag import TagOut

class NoteOut(BaseModel):
    id: str
    document_id: str
    heading: Optional[str] = None
    content: str
    content_type: Optional[str] = None
    order_index: Optional[int] = None
    topic_order: Optional[int] = None
    created_at: datetime
    tags: List[TagOut] = []
    source_doc_name: str

    model_config = {
        "from_attributes": True
    }

class NotePatch(BaseModel):
    heading: Optional[str] = None
    content: Optional[str] = None
    content_type: Optional[str] = None
    add_tags: Optional[List[str]] = None
    remove_tags: Optional[List[str]] = None
