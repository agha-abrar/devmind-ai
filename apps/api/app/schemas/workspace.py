import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import WorkspaceRole


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    owner_id: uuid.UUID
    role: WorkspaceRole
    created_at: datetime

    model_config = {"from_attributes": True}
