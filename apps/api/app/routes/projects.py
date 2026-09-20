from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_project_for_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.project_service import (
    create_project,
    delete_project,
    get_project_stats,
    list_projects_for_user,
    update_project,
    user_can_access_workspace,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[ProjectResponse]:
    projects = await list_projects_for_user(db, current_user.id)
    return [ProjectResponse.model_validate(p) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project_route(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    if not await user_can_access_workspace(db, current_user.id, payload.workspace_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    project = await create_project(db, payload.workspace_id, payload.name, payload.description)
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project: Project = Depends(get_project_for_user), db: AsyncSession = Depends(get_db)
) -> ProjectDetailResponse:
    stats = await get_project_stats(db, project.id)
    return ProjectDetailResponse(**ProjectResponse.model_validate(project).model_dump(), stats=stats)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project_route(
    payload: ProjectUpdate,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    updated = await update_project(db, project, **payload.model_dump(exclude_unset=True))
    return ProjectResponse.model_validate(updated)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_route(
    project: Project = Depends(get_project_for_user), db: AsyncSession = Depends(get_db)
) -> None:
    await delete_project(db, project)
    return None
