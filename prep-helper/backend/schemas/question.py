from __future__ import annotations
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from pydantic import BaseModel
from backend.schemas.tag import TagOut

if TYPE_CHECKING:
    from backend.schemas.srs import SRSStateOut

class QuestionOut(BaseModel):
    id: str
    document_id: str
    question_text: str
    answer_text: str
    difficulty: Optional[str] = None
    source_page: Optional[int] = None
    order_in_doc: Optional[int] = None
    bookmarked: bool
    created_at: datetime
    updated_at: datetime
    tags: List[TagOut] = []
    srs_state: Optional[SRSStateOut] = None

    model_config = {
        "from_attributes": True
    }


class QuestionPatch(BaseModel):
    question_text: Optional[str] = None
    answer_text: Optional[str] = None
    difficulty: Optional[str] = None
    bookmarked: Optional[bool] = None
    add_tags: Optional[List[str]] = None
    remove_tags: Optional[List[str]] = None

class QuestionSuggestRequest(BaseModel):
    question_text: str
    answer_text: str

# Rebuild model to compile circular reference annotations
from backend.schemas.srs import SRSStateOut
QuestionOut.model_rebuild()


