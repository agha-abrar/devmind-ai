from __future__ import annotations

import os
import uuid

from slugify import slugify
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.document import Document
from app.models.enums import DocumentStatus
from app.rag.hashing import content_hash
from app.services.document_extraction import SUPPORTED_DOCUMENT_TYPES


class DocumentUploadError(Exception):
    pass


def validate_upload(filename: str, size_bytes: int) -> str:
    _, ext = os.path.splitext(filename)
    file_type = ext.lower().lstrip(".")
    if file_type not in SUPPORTED_DOCUMENT_TYPES:
        raise DocumentUploadError(
            f"Unsupported file type '.{file_type}'. Supported types: "
            f"{', '.join(sorted(SUPPORTED_DOCUMENT_TYPES))}."
        )
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if size_bytes > max_bytes:
        raise DocumentUploadError(
            f"File exceeds the {settings.max_upload_size_mb}MB upload limit."
        )
    if size_bytes == 0:
        raise DocumentUploadError("File is empty.")
    return file_type


def safe_storage_path(project_id: uuid.UUID, original_filename: str) -> str:
    base_name = slugify(os.path.splitext(original_filename)[0]) or "file"
    ext = os.path.splitext(original_filename)[1].lower()
    unique_name = f"{uuid.uuid4().hex}-{base_name}{ext}"
    project_dir = os.path.join(settings.upload_dir, str(project_id))
    os.makedirs(project_dir, exist_ok=True)
    return os.path.join(project_dir, unique_name)


async def create_document_record(
    db: AsyncSession,
    project_id: uuid.UUID,
    original_filename: str,
    storage_path: str,
    file_type: str,
    size_bytes: int,
    data: bytes,
) -> Document:
    document = Document(
        project_id=project_id,
        original_filename=original_filename,
        storage_path=storage_path,
        file_type=file_type,
        size_bytes=size_bytes,
        content_hash=content_hash(data.decode("utf-8", errors="ignore")),
        status=DocumentStatus.UPLOADED,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document
