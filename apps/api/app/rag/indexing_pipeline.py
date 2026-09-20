"""
Shared indexing pipeline used by both repository (code) ingestion and
document ingestion. Handles: chunking -> embedding -> persisting chunks,
skipping re-embedding when the source content hasn't changed since the last
successful index.
"""
from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.enums import KnowledgeSourceType
from app.models.knowledge import KnowledgeChunk, KnowledgeSource
from app.rag.chunk_types import Chunk
from app.rag.code_chunker import chunk_source_code
from app.rag.document_chunker import chunk_document_text
from app.rag.embeddings import get_embedding_provider
from app.rag.hashing import content_hash

logger = get_logger(__name__)


class IndexingResult:
    def __init__(self, source_id: uuid.UUID, chunk_count: int, skipped: bool):
        self.source_id = source_id
        self.chunk_count = chunk_count
        self.skipped = skipped


async def _find_existing_source(
    db: AsyncSession,
    project_id: uuid.UUID,
    repository_id: uuid.UUID | None,
    document_id: uuid.UUID | None,
    file_path: str | None,
) -> KnowledgeSource | None:
    stmt = select(KnowledgeSource).where(KnowledgeSource.project_id == project_id)
    if repository_id is not None:
        stmt = stmt.where(
            KnowledgeSource.repository_id == repository_id,
            KnowledgeSource.file_path == file_path,
        )
    elif document_id is not None:
        stmt = stmt.where(KnowledgeSource.document_id == document_id)
    else:
        return None
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _persist_chunks(
    db: AsyncSession, project_id: uuid.UUID, source: KnowledgeSource, chunks: list[Chunk]
) -> int:
    # Replace all existing chunks for this source (simplest correct approach —
    # code/documents are rarely so large that a full re-chunk is expensive,
    # and it guarantees no orphaned/stale chunks remain).
    await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.knowledge_source_id == source.id))

    if not chunks:
        await db.commit()
        return 0

    provider = get_embedding_provider()
    embeddings = await provider.embed_texts([c.content for c in chunks])

    for chunk, embedding in zip(chunks, embeddings):
        db.add(
            KnowledgeChunk(
                project_id=project_id,
                knowledge_source_id=source.id,
                content=chunk.content,
                content_hash=content_hash(chunk.content),
                chunk_index=chunk.chunk_index,
                token_count=chunk.token_count,
                symbol_name=chunk.symbol_name,
                symbol_type=chunk.symbol_type,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
                section_title=chunk.section_title,
                embedding=embedding,
            )
        )

    await db.commit()
    return len(chunks)


async def index_code_file(
    db: AsyncSession,
    project_id: uuid.UUID,
    repository_id: uuid.UUID,
    file_path: str,
    language: str,
    branch: str,
    commit_sha: str,
    content: str,
) -> IndexingResult:
    new_hash = content_hash(content)
    existing = await _find_existing_source(db, project_id, repository_id, None, file_path)

    if existing is not None and existing.content_hash == new_hash and not existing.is_stale:
        existing.commit_sha = commit_sha
        existing.branch = branch
        await db.commit()
        chunk_count_result = await db.execute(
            select(KnowledgeChunk).where(KnowledgeChunk.knowledge_source_id == existing.id)
        )
        return IndexingResult(existing.id, len(chunk_count_result.scalars().all()), skipped=True)

    if existing is None:
        existing = KnowledgeSource(
            project_id=project_id,
            source_type=KnowledgeSourceType.CODE_FILE,
            repository_id=repository_id,
            file_path=file_path,
            language=language,
            branch=branch,
            commit_sha=commit_sha,
            content_hash=new_hash,
        )
        db.add(existing)
        await db.flush()
    else:
        existing.content_hash = new_hash
        existing.branch = branch
        existing.commit_sha = commit_sha
        existing.is_stale = False

    chunks = chunk_source_code(content, language)
    chunk_count = await _persist_chunks(db, project_id, existing, chunks)
    logger.info(
        "code_file_indexed",
        project_id=str(project_id),
        file_path=file_path,
        chunk_count=chunk_count,
    )
    return IndexingResult(existing.id, chunk_count, skipped=False)


async def index_document(
    db: AsyncSession,
    project_id: uuid.UUID,
    document_id: uuid.UUID,
    file_type: str,
    content: str,
) -> IndexingResult:
    new_hash = content_hash(content)
    existing = await _find_existing_source(db, project_id, None, document_id, None)

    if existing is None:
        existing = KnowledgeSource(
            project_id=project_id,
            source_type=KnowledgeSourceType.DOCUMENT,
            document_id=document_id,
            content_hash=new_hash,
        )
        db.add(existing)
        await db.flush()
    else:
        existing.content_hash = new_hash
        existing.is_stale = False

    chunks = chunk_document_text(content, file_type)
    chunk_count = await _persist_chunks(db, project_id, existing, chunks)
    logger.info(
        "document_indexed",
        project_id=str(project_id),
        document_id=str(document_id),
        chunk_count=chunk_count,
    )
    return IndexingResult(existing.id, chunk_count, skipped=False)
