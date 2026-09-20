from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_run import AgentRun
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.knowledge import KnowledgeChunk, KnowledgeSource
from app.models.project import Project
from app.models.repository import Repository
from app.models.workspace import WorkspaceMember
from app.schemas.project import ProjectStats


class ProjectError(Exception):
    pass


async def list_projects_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[Project]:
    workspace_ids_subq = select(WorkspaceMember.workspace_id).where(
        WorkspaceMember.user_id == user_id
    )
    result = await db.execute(
        select(Project)
        .where(Project.workspace_id.in_(workspace_ids_subq))
        .order_by(Project.updated_at.desc())
    )
    return list(result.scalars().all())


async def user_can_access_workspace(db: AsyncSession, user_id: uuid.UUID, workspace_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
    )
    return result.scalar_one_or_none() is not None


async def create_project(
    db: AsyncSession, workspace_id: uuid.UUID, name: str, description: str | None
) -> Project:
    project = Project(workspace_id=workspace_id, name=name, description=description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def update_project(db: AsyncSession, project: Project, **fields) -> Project:
    for key, value in fields.items():
        if value is not None:
            setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project: Project) -> None:
    await db.delete(project)
    await db.commit()


async def get_project_stats(db: AsyncSession, project_id: uuid.UUID) -> ProjectStats:
    async def _count(model, *filters) -> int:
        result = await db.execute(
            select(func.count()).select_from(model).where(model.project_id == project_id, *filters)
        )
        return int(result.scalar_one())

    repositories = await _count(Repository)
    documents = await _count(Document)
    indexed_files = await _count(KnowledgeSource)
    knowledge_chunks = await _count(KnowledgeChunk)
    conversations = await _count(Conversation)
    agent_runs = await _count(AgentRun)

    return ProjectStats(
        repositories=repositories,
        documents=documents,
        indexed_files=indexed_files,
        knowledge_chunks=knowledge_chunks,
        conversations=conversations,
        agent_runs=agent_runs,
    )
