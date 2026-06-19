from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel

class SRSStateOut(BaseModel):
    ease_factor: float
    interval_days: int
    due_date: datetime
    repetitions: int

    model_config = {
        "from_attributes": True
    }

class ReviewSubmit(BaseModel):
    question_id: str
    rating: Literal["again", "hard", "good", "easy"]
    response_time_ms: Optional[int] = None

class SessionStart(BaseModel):
    tag_filter: Optional[List[str]] = None
    session_type: Optional[str] = "flashcard"
