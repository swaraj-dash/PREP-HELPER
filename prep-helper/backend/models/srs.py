import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Index, Boolean
from backend.database import Base

class SRSCard(Base):
    __tablename__ = "srs_cards"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String, ForeignKey("questions.id", ondelete="CASCADE"), unique=True, nullable=False)
    ease_factor = Column(Float, default=2.5)
    interval_days = Column(Integer, default=0)
    due_date = Column(DateTime, default=datetime.utcnow)
    repetitions = Column(Integer, default=0)
    last_reviewed = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_srs_due", "due_date"),
    )

    def __repr__(self):
        return f"<SRSCard id={self.id} question_id={self.question_id} due_date={self.due_date}>"

class SRSReview(Base):
    __tablename__ = "srs_reviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    card_id = Column(String, ForeignKey("srs_cards.id", ondelete="CASCADE"), nullable=False)
    reviewed_at = Column(DateTime, default=datetime.utcnow)
    rating = Column(String, nullable=False)  # again, hard, good, easy
    response_time_ms = Column(Integer, nullable=True)

    __table_args__ = (
        Index("idx_reviews_card", "card_id"),
        Index("idx_reviews_date", "reviewed_at"),
    )

    def __repr__(self):
        return f"<SRSReview id={self.id} rating={self.rating} reviewed_at={self.reviewed_at}>"

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    tag_filter = Column(String, nullable=True)  # JSON-encoded array of tag IDs
    cards_reviewed = Column(Integer, default=0)
    session_type = Column(String, default="flashcard")  # flashcard, browse

    def __repr__(self):
        return f"<StudySession id={self.id} type={self.session_type} started_at={self.started_at}>"

class UserAnnotation(Base):
    __tablename__ = "user_annotations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    item_type = Column(String, nullable=False)  # 'question' or 'note'
    item_id = Column(String, nullable=False)
    annotation_text = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<UserAnnotation id={self.id} item_type={self.item_type} item_id={self.item_id}>"
