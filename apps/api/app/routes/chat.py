import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from app.agents.runner import run_and_stream_chat
from app.core.deps import get_current_user, get_project_for_user
from app.core.rate_limit import chat_rate_limiter
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.project import Project
from app.models.user import User
from app.schemas.agent_run import ChatRequest

router = APIRouter(prefix="/projects/{project_id}/chat", tags=["chat"])


async def _sse_event_stream(request: Request, db: AsyncSession, project_id, conversation_id, message: str):
    async for event in run_and_stream_chat(db, project_id, conversation_id, message):
        if await request.is_disconnected():
            break
        yield f"data: {json.dumps(event)}\n\n"
    yield "event: end\ndata: {}\n\n"


@router.post("")
async def chat(
    request: Request,
    payload: ChatRequest,
    project: Project = Depends(get_project_for_user),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    await chat_rate_limiter.check(str(current_user.id))

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == payload.conversation_id, Conversation.project_id == project.id
        )
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    return StreamingResponse(
        _sse_event_stream(request, db, project.id, conversation.id, payload.message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
