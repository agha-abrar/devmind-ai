import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_project_for_user
from app.db.session import get_db
from app.models.document import Document
from app.models.project import Project
from app.schemas.document import DocumentResponse
from app.services.document_service import (
    DocumentUploadError,
    create_document_record,
    safe_storage_path,
    validate_upload,
)
from app.workers.tasks_document import process_document_task

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    project: Project = Depends(get_project_for_user), db: AsyncSession = Depends(get_db)
) -> list[DocumentResponse]:
    result = await db.execute(select(Document).where(Document.project_id == project.id))
    return [DocumentResponse.model_validate(d) for d in result.scalars().all()]


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    data = await file.read()

    try:
        file_type = validate_upload(file.filename or "unnamed", len(data))
    except DocumentUploadError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    storage_path = safe_storage_path(project.id, file.filename or "unnamed")
    with open(storage_path, "wb") as f:
        f.write(data)

    document = await create_document_record(
        db=db,
        project_id=project.id,
        original_filename=file.filename or "unnamed",
        storage_path=storage_path,
        file_type=file_type,
        size_bytes=len(data),
        data=data,
    )

    process_document_task.delay(str(document.id))

    return DocumentResponse.model_validate(document)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.project_id == project.id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return DocumentResponse.model_validate(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    project: Project = Depends(get_project_for_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.project_id == project.id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    import os

    if os.path.exists(document.storage_path):
        os.remove(document.storage_path)

    await db.delete(document)
    await db.commit()
    return None
