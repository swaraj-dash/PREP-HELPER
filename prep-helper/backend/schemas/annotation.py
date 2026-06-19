from datetime import datetime
from pydantic import BaseModel

class UserAnnotationOut(BaseModel):
    id: str
    item_type: str
    item_id: str
    annotation_text: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }

class UserAnnotationCreate(BaseModel):
    item_type: str
    item_id: str
    annotation_text: str

class UserAnnotationUpdate(BaseModel):
    annotation_text: str
