import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_project_for_user
from app.core.rate_limit import ingestion_rate_limiter
from app.db.session import get_db
from app.models.enums import RepositoryStatus
from app.models.project import Project
from app.models.repository import Repository
from app.models.user import User
from app.repositories.github_ingestion import GithubIngestionError, fetch_repo_metadata, parse_repo_url
from app.schemas.repository import RepositoryCreate, RepositoryResponse
from app.workers.tasks_repository import ingest_repository_task

router = APIRouter(prefix="/projects/{project_id}/repositories", tags=["repositories"])


@router.get("", response_model=list[RepositoryResponse])
async def list_repositories(
    project: Project = Depends(get_project_for_user), db: AsyncSession = Depends(get_db)
) -> list[RepositoryResponse]:
    result = await db.execute(select(Repository).where(Repository.project_id == project.id))
    return [RepositoryResponse.model_validate(r) for r in result.scalars().all()]


@router.post("", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
async def connect_repository(
    payload: RepositoryCreate,
    project: Project = Depends(get_project_for_user),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RepositoryResponse:
    await ingestion_rate_limiter.check(str(current_user.id))

    try:
        owner, name = parse_repo_url(payload.repo_url)
        metadata = await fetch_repo_metadata_async(owner, name, payload.access_token)
    except GithubIngestionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    repository = Repository(
        project_id=project.id,
        provider="github",
        owner=owner,
        name=name,
        full_name=metadata.full_name,
        default_branch=metadata.default_branch,
        status=RepositoryStatus.PENDING,
    )
    db.add(repository)
    await db.commit()
    await db.refresh(repository)

    ingest_repository_task.delay(str(repository.id), payload.access_token)

    return RepositoryResponse.model_validate(repository)


@router.post("/{repository_id}/resync", response_model=RepositoryResponse)
async def resync_repository(
    repository_id: uuid.UUID,
    access_token: str | None = None,
    project: Project = Depends(get_project_for_user),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RepositoryResponse:
    await ingestion_rate_limiter.check(str(current_user.id))

    result = await db.execute(
        select(Repository).where(Repository.id == repository_id, Repository.project_id == project.id)
    )
    repository = result.scalar_one_or_none()
    if repository is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found.")

    repository.status = RepositoryStatus.PENDING
    await db.commit()
    await db.refresh(repository)

    ingest_repository_task.delay(str(repository.id), access_token)
    return RepositoryResponse.model_validate(repository)


@router.delete("/{repository_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repository(
    repository_id: uuid.UUID,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Repository).where(Repository.id == repository_id, Repository.project_id == project.id)
    )
    repository = result.scalar_one_or_none()
    if repository is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found.")

    await db.delete(repository)
    await db.commit()
    return None


async def fetch_repo_metadata_async(owner: str, name: str, access_token: str | None):
    import asyncio

    return await asyncio.to_thread(fetch_repo_metadata, owner, name, access_token)
