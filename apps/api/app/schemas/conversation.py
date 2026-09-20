import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import MessageRole


class ConversationCreate(BaseModel):
    project_id: uuid.UUID
    title: str | None = Field(default=None, max_length=500)


class ConversationUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=500)


class ConversationResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CitationResponse(BaseModel):
    marker: int
    display_label: str
    source_type: str
    file_path: str | None
    document_name: str | None
    repository_full_name: str | None
    start_line: int | None
    end_line: int | None
    snippet: str

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    created_at: datetime
    citations: list[CitationResponse] = []

    model_config = {"from_attributes": True}


class ConversationDetailResponse(ConversationResponse):
    messages: list[MessageResponse]
