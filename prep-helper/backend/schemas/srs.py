from __future__ import annotations
from datetime import datetime
from typing import Optional, Literal, TYPE_CHECKING
from pydantic import BaseModel

if TYPE_CHECKING:
    from backend.schemas.question import QuestionOut

class SRSStateOut(BaseModel):
    id: str
    question_id: str
    ease_factor: float
    interval_days: int
    due_date: datetime
    repetitions: int
    last_reviewed: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }

class ReviewSubmit(BaseModel):
    question_id: str
    rating: Literal["again", "hard", "good", "easy"]
    response_time_ms: Optional[int] = None

class SessionStart(BaseModel):
    tag_filter: Optional[list[str]] = None  # List of tag IDs or tag names
    session_type: Optional[str] = "flashcard"

class SessionStartResponse(BaseModel):
    session_id: str
    first_card: Optional[QuestionOut] = None

class SessionEndResponse(BaseModel):
    session_id: str
    started_at: datetime
    ended_at: datetime
    cards_reviewed: int
    session_type: str

# Rebuild models with circular references
from backend.schemas.question import QuestionOut
SessionStartResponse.model_rebuild()
