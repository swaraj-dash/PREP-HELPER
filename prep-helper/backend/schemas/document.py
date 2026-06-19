import json
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator

class DocumentUploadResponse(BaseModel):
    doc_id: str

class DocumentSummary(BaseModel):
    id: str
    original_name: str
    status: str
    doc_type: Optional[str] = None
    uploaded_at: datetime
    question_count: int
    note_count: int
    tag_summary: Optional[List[str]] = None

    model_config = {
        "from_attributes": True
    }

    @field_validator("tag_summary", mode="before")
    @classmethod
    def parse_tag_summary(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return v or []

class DocumentDetail(DocumentSummary):
    page_count: Optional[int] = None
    chunk_count: int
    error_message: Optional[str] = None
