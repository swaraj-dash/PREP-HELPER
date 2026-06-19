from datetime import datetime
from pydantic import BaseModel

class TagOut(BaseModel):
    id: str
    name: str
    tag_type: str
    usage_count: int
    created_at: datetime

    model_config = {
        "from_attributes": True
    }

class TagCreate(BaseModel):
    name: str
    tag_type: str = "custom"

class TagMerge(BaseModel):
    source_tag_id: str
    target_tag_id: str
