import asyncio
import uuid

from sqlalchemy import delete, select

from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.models.enums import RepositoryStatus
from app.models.knowledge import KnowledgeSource
from app.models.repository import Repository
from app.rag.indexing_pipeline import index_code_file
from app.repositories.github_ingestion import GithubIngestionError, fetch_repo_metadata, iter_repo_files
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


async def _ingest_repository(repository_id: str, access_token: str | None) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Repository).where(Repository.id == uuid.UUID(repository_id)))
        repository = result.scalar_one_or_none()
        if repository is None:
            logger.warning("repository_not_found_for_ingestion", repository_id=repository_id)
            return

        repository.status = RepositoryStatus.INDEXING
        repository.error_message = None
        await db.commit()

        try:
            metadata = await asyncio.to_thread(
                fetch_repo_metadata, repository.owner, repository.name, access_token
            )
            repository.default_branch = metadata.default_branch

            seen_file_paths: set[str] = set()
            indexed_count = 0

            for repo_file in await asyncio.to_thread(
                lambda: list(
                    iter_repo_files(
                        repository.owner, repository.name, metadata.default_branch, access_token
                    )
                )
            ):
                seen_file_paths.add(repo_file.path)
                await index_code_file(
                    db=db,
                    project_id=repository.project_id,
                    repository_id=repository.id,
                    file_path=repo_file.path,
                    language=repo_file.language,
                    branch=metadata.default_branch,
                    commit_sha=metadata.latest_commit_sha,
                    content=repo_file.content,
                )
                indexed_count += 1

            # Prune knowledge sources for files that no longer exist in the repo
            existing_sources = await db.execute(
                select(KnowledgeSource).where(KnowledgeSource.repository_id == repository.id)
            )
            for source in existing_sources.scalars().all():
                if source.file_path not in seen_file_paths:
                    await db.execute(
                        delete(KnowledgeSource).where(KnowledgeSource.id == source.id)
                    )

            repository.last_indexed_commit_sha = metadata.latest_commit_sha
            repository.indexed_file_count = indexed_count
            repository.status = RepositoryStatus.INDEXED
            await db.commit()
            logger.info(
                "repository_ingestion_succeeded",
                repository_id=repository_id,
                files_indexed=indexed_count,
            )

        except GithubIngestionError as exc:
            repository.status = RepositoryStatus.FAILED
            repository.error_message = str(exc)
            await db.commit()
            logger.warning("repository_ingestion_failed", repository_id=repository_id, error=str(exc))

        except Exception as exc:  # noqa: BLE001
            repository.status = RepositoryStatus.FAILED
            repository.error_message = f"Unexpected error during ingestion: {exc}"
            await db.commit()
            logger.error(
                "repository_ingestion_unexpected_error", repository_id=repository_id, error=str(exc)
            )


@celery_app.task(name="devmind.ingest_repository", bind=True, max_retries=1)
def ingest_repository_task(self, repository_id: str, access_token: str | None = None) -> None:
    asyncio.run(_ingest_repository(repository_id, access_token))
