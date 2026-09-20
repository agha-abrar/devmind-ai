import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_project_for_user
from app.db.session import get_db
from app.models.agent_run import AgentRun
from app.models.project import Project
from app.schemas.agent_run import AgentRunDetailResponse, AgentRunResponse

router = APIRouter(prefix="/projects/{project_id}/agent-runs", tags=["agent-runs"])


@router.get("", response_model=list[AgentRunResponse])
async def list_agent_runs(
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
) -> list[AgentRunResponse]:
    result = await db.execute(
        select(AgentRun)
        .where(AgentRun.project_id == project.id)
        .order_by(AgentRun.created_at.desc())
        .limit(limit)
    )
    return [AgentRunResponse.model_validate(r) for r in result.scalars().all()]


@router.get("/{agent_run_id}", response_model=AgentRunDetailResponse)
async def get_agent_run(
    agent_run_id: uuid.UUID,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
) -> AgentRunDetailResponse:
    result = await db.execute(
        select(AgentRun)
        .options(selectinload(AgentRun.steps))
        .where(AgentRun.id == agent_run_id, AgentRun.project_id == project.id)
    )
    agent_run = result.scalar_one_or_none()
    if agent_run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent run not found.")
    return AgentRunDetailResponse.model_validate(agent_run)
