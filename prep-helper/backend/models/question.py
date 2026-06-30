import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Index
from backend.database import Base

class Question(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(String, nullable=False)
    answer_text = Column(String, nullable=False)
    difficulty = Column(String, nullable=True)  # beginner, intermediate, advanced
    source_page = Column(Integer, nullable=True)
    order_in_doc = Column(Integer, nullable=True)
    bookmarked = Column(Boolean, default=False)
    combined_answer = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_questions_doc", "document_id"),
    )

    def __repr__(self):
        return f"<Question id={self.id} question_text={self.question_text[:30]}...>"
