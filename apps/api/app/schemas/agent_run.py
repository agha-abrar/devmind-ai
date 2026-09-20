import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import AgentName, AgentRunStatus, AgentStepStatus, ReviewStatus


class ChatRequest(BaseModel):
    conversation_id: uuid.UUID
    message: str = Field(min_length=1, max_length=8000)


class AgentStepResponse(BaseModel):
    id: uuid.UUID
    sequence_index: int
    agent_name: AgentName
    status: AgentStepStatus
    duration_ms: int | None
    tool_calls: list | None
    retrieved_count: int
    input_tokens: int
    output_tokens: int
    summary: str | None
    error_message: str | None

    model_config = {"from_attributes": True}


class AgentRunResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    conversation_id: uuid.UUID
    message_id: uuid.UUID | None
    user_question: str
    status: AgentRunStatus
    review_status: ReviewStatus | None
    retry_count: int
    started_at: datetime | None
    completed_at: datetime | None
    duration_ms: int | None
    total_input_tokens: int
    total_output_tokens: int
    estimated_cost_usd: float
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentRunDetailResponse(AgentRunResponse):
    steps: list[AgentStepResponse]
