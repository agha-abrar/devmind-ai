"""
Structured tools available to agent nodes. Every tool is scoped to a single
project_id (already authorized upstream by the route dependency) and returns
structured, typed output — never raw unvalidated model output.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import KnowledgeSourceType
from app.models.knowledge import KnowledgeChunk, KnowledgeSource
from app.models.repository import Repository
from app.rag.retrieval_service import retrieve_context
from app.rag.retrieval_types import RetrievedChunk


async def search_code(
    db: AsyncSession, project_id: uuid.UUID, query: str, top_k: int = 8
) -> list[RetrievedChunk]:
    """Search only source-code knowledge for the given query."""
    return await retrieve_context(db, project_id, query, top_k=top_k, source_type="code_file")


async def search_documents(
    db: AsyncSession, project_id: uuid.UUID, query: str, top_k: int = 6
) -> list[RetrievedChunk]:
    """Search only uploaded documentation/knowledge for the given query."""
    return await retrieve_context(db, project_id, query, top_k=top_k, source_type="document")


async def search_all(
    db: AsyncSession, project_id: uuid.UUID, query: str, top_k: int = 10
) -> list[RetrievedChunk]:
    """Search both code and documents together."""
    return await retrieve_context(db, project_id, query, top_k=top_k)


async def get_file_content(
    db: AsyncSession, project_id: uuid.UUID, file_path: str
) -> str | None:
    """Return the full re-assembled content of a single indexed code file, in chunk order."""
    result = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.project_id == project_id,
            KnowledgeSource.file_path == file_path,
            KnowledgeSource.source_type == KnowledgeSourceType.CODE_FILE,
        )
    )
    source = result.scalar_one_or_none()
    if source is None:
        return None

    chunks_result = await db.execute(
        select(KnowledgeChunk)
        .where(KnowledgeChunk.knowledge_source_id == source.id)
        .order_by(KnowledgeChunk.chunk_index)
    )
    chunks = chunks_result.scalars().all()
    return "\n\n".join(c.content for c in chunks)


async def get_code_context(
    db: AsyncSession, project_id: uuid.UUID, file_path: str, center_line: int, window: int = 20
) -> str | None:
    """Return the chunk(s) of a file overlapping a given line range window."""
    result = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.project_id == project_id,
            KnowledgeSource.file_path == file_path,
            KnowledgeSource.source_type == KnowledgeSourceType.CODE_FILE,
        )
    )
    source = result.scalar_one_or_none()
    if source is None:
        return None

    low, high = center_line - window, center_line + window
    chunks_result = await db.execute(
        select(KnowledgeChunk)
        .where(
            KnowledgeChunk.knowledge_source_id == source.id,
            KnowledgeChunk.start_line.isnot(None),
            KnowledgeChunk.end_line.isnot(None),
            KnowledgeChunk.start_line <= high,
            KnowledgeChunk.end_line >= low,
        )
        .order_by(KnowledgeChunk.chunk_index)
    )
    chunks = chunks_result.scalars().all()
    if not chunks:
        return None
    return "\n\n".join(c.content for c in chunks)


async def find_symbol(
    db: AsyncSession, project_id: uuid.UUID, symbol_name: str
) -> list[RetrievedChunk]:
    """Find chunks whose detected function/class name matches the given symbol."""
    result = await db.execute(
        select(KnowledgeChunk, KnowledgeSource)
        .join(KnowledgeSource, KnowledgeChunk.knowledge_source_id == KnowledgeSource.id)
        .where(
            KnowledgeChunk.project_id == project_id,
            KnowledgeChunk.symbol_name.ilike(f"%{symbol_name}%"),
        )
        .limit(15)
    )
    output: list[RetrievedChunk] = []
    for chunk, source in result.all():
        output.append(
            RetrievedChunk(
                chunk_id=chunk.id,
                knowledge_source_id=source.id,
                content=chunk.content,
                score=1.0,
                source_type=source.source_type.value,
                file_path=source.file_path,
                language=source.language,
                repository_id=source.repository_id,
                repository_full_name=None,
                document_id=source.document_id,
                document_name=None,
                section_title=chunk.section_title,
                symbol_name=chunk.symbol_name,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
            )
        )
    return output


async def get_repository_tree(db: AsyncSession, project_id: uuid.UUID) -> dict[str, list[str]]:
    """Return {repository_full_name: [file_path, ...]} for every indexed repository."""
    result = await db.execute(
        select(Repository.full_name, KnowledgeSource.file_path)
        .join(KnowledgeSource, KnowledgeSource.repository_id == Repository.id)
        .where(Repository.project_id == project_id)
    )
    tree: dict[str, list[str]] = {}
    for repo_name, file_path in result.all():
        tree.setdefault(repo_name, []).append(file_path)
    return tree


async def retrieve_related_chunks(
    db: AsyncSession, project_id: uuid.UUID, knowledge_source_id: uuid.UUID, exclude_chunk_id: uuid.UUID
) -> list[RetrievedChunk]:
    """Return sibling chunks from the same file/document, useful for expanding context around a hit."""
    result = await db.execute(
        select(KnowledgeChunk, KnowledgeSource)
        .join(KnowledgeSource, KnowledgeChunk.knowledge_source_id == KnowledgeSource.id)
        .where(
            KnowledgeChunk.knowledge_source_id == knowledge_source_id,
            KnowledgeChunk.id != exclude_chunk_id,
        )
        .order_by(KnowledgeChunk.chunk_index)
        .limit(5)
    )
    output: list[RetrievedChunk] = []
    for chunk, source in result.all():
        output.append(
            RetrievedChunk(
                chunk_id=chunk.id,
                knowledge_source_id=source.id,
                content=chunk.content,
                score=0.5,
                source_type=source.source_type.value,
                file_path=source.file_path,
                language=source.language,
                repository_id=source.repository_id,
                repository_full_name=None,
                document_id=source.document_id,
                document_name=None,
                section_title=chunk.section_title,
                symbol_name=chunk.symbol_name,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
            )
        )
    return output
