import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import DocumentStatus


class DocumentResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    original_filename: str
    file_type: str
    size_bytes: int
    status: DocumentStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
