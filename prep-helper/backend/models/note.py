import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from backend.database import Base

class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    heading = Column(String, nullable=True)
    content = Column(String, nullable=False)
    content_type = Column(String, nullable=True)  # definition, example, code, concept, summary
    order_index = Column(Integer, nullable=True)
    topic_order = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_notes_doc", "document_id"),
        Index("idx_notes_topic_order", "topic_order"),
    )

    def __repr__(self):
        return f"<Note id={self.id} heading={self.heading}>"
