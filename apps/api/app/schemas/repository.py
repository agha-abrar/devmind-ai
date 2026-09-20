import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import RepositoryStatus


class RepositoryCreate(BaseModel):
    repo_url: str = Field(
        min_length=1,
        max_length=500,
        description="GitHub repository URL or 'owner/repo' slug.",
    )
    access_token: str | None = Field(
        default=None,
        description="Optional GitHub token for private repos (never stored).",
    )


class RepositoryResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    provider: str
    owner: str
    name: str
    full_name: str
    default_branch: str
    last_indexed_commit_sha: str | None
    status: RepositoryStatus
    error_message: str | None
    indexed_file_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
