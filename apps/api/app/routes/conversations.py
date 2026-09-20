import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_project_for_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.conversation import (
    ConversationCreate,
    ConversationDetailResponse,
    ConversationResponse,
    ConversationUpdate,
)
from app.services.conversation_service import (
    create_conversation,
    delete_conversation,
    get_conversation_with_messages,
    list_conversations,
    rename_conversation,
)

router = APIRouter(prefix="/projects/{project_id}/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationResponse])
async def list_conversations_route(
    project: Project = Depends(get_project_for_user), db: AsyncSession = Depends(get_db)
) -> list[ConversationResponse]:
    conversations = await list_conversations(db, project.id)
    return [ConversationResponse.model_validate(c) for c in conversations]


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation_route(
    payload: ConversationCreate,
    project: Project = Depends(get_project_for_user),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    conversation = await create_conversation(db, project.id, current_user.id, payload.title)
    return ConversationResponse.model_validate(conversation)


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation_route(
    conversation_id: uuid.UUID,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationDetailResponse:
    conversation = await get_conversation_with_messages(db, project.id, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return ConversationDetailResponse.model_validate(conversation)


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def rename_conversation_route(
    conversation_id: uuid.UUID,
    payload: ConversationUpdate,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    conversation = await get_conversation_with_messages(db, project.id, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    updated = await rename_conversation(db, conversation, payload.title)
    return ConversationResponse.model_validate(updated)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation_route(
    conversation_id: uuid.UUID,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    conversation = await get_conversation_with_messages(db, project.id, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    await delete_conversation(db, conversation)
    return None
