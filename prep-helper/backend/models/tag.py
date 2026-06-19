import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from backend.database import Base

class Tag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False, index=True)
    tag_type = Column(String, nullable=False)  # tech, concept, domain, difficulty, content_type, custom
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Tag name={self.name} tag_type={self.tag_type}>"

class ItemTag(Base):
    __tablename__ = "item_tags"

    item_type = Column(String, primary_key=True)  # 'question' or 'note'
    item_id = Column(String, primary_key=True)
    tag_id = Column(String, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)

    __table_args__ = (
        Index("idx_item_tags_tag", "tag_id"),
        Index("idx_item_tags_item", "item_type", "item_id"),
    )
