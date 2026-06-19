import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime
from backend.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="queued")  # queued, extracting, classifying, chunking, tagging, embedding, done, error
    doc_type = Column(String, nullable=True)   # QA_HEAVY, NOTES_HEAVY, MIXED
    page_count = Column(Integer, nullable=True)
    chunk_count = Column(Integer, default=0)
    question_count = Column(Integer, default=0)
    note_count = Column(Integer, default=0)
    error_message = Column(String, nullable=True)
    tag_summary = Column(String, nullable=True)  # JSON-encoded array of top tags

    def __repr__(self):
        return f"<Document id={self.id} original_name={self.original_name} status={self.status}>"
