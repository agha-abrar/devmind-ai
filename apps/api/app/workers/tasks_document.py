import asyncio
import uuid

from sqlalchemy import select

from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.models.document import Document
from app.models.enums import DocumentStatus
from app.rag.indexing_pipeline import index_document
from app.services.document_extraction import DocumentExtractionError, extract_text
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


async def _process_document(document_id: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Document).where(Document.id == uuid.UUID(document_id)))
        document = result.scalar_one_or_none()
        if document is None:
            logger.warning("document_not_found_for_processing", document_id=document_id)
            return

        document.status = DocumentStatus.PROCESSING
        document.error_message = None
        await db.commit()

        try:
            with open(document.storage_path, "rb") as f:
                raw_bytes = f.read()

            text = extract_text(raw_bytes, document.file_type)
            await index_document(
                db=db,
                project_id=document.project_id,
                document_id=document.id,
                file_type=document.file_type,
                content=text,
            )
            document.status = DocumentStatus.INDEXED
            await db.commit()
            logger.info("document_processing_succeeded", document_id=document_id)

        except DocumentExtractionError as exc:
            document.status = DocumentStatus.FAILED
            document.error_message = str(exc)
            await db.commit()
            logger.warning("document_processing_failed", document_id=document_id, error=str(exc))

        except Exception as exc:  # noqa: BLE001
            document.status = DocumentStatus.FAILED
            document.error_message = f"Unexpected error during processing: {exc}"
            await db.commit()
            logger.error("document_processing_unexpected_error", document_id=document_id, error=str(exc))


@celery_app.task(name="devmind.process_document", bind=True, max_retries=1)
def process_document_task(self, document_id: str) -> None:
    asyncio.run(_process_document(document_id))
