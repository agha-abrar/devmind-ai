"""
Hybrid retrieval over the project's knowledge base.

Combines:
  1. Vector similarity search (pgvector cosine distance) — good for semantic
     matches ("how does auth work") even without exact keyword overlap.
  2. PostgreSQL full-text search (tsvector/tsquery) — good for exact
     identifiers, function names, error strings, config keys.

Candidates from both are merged with Reciprocal Rank Fusion (RRF), which
needs no score normalization between the two very different scales
(cosine distance vs. ts_rank).
"""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.document import Document
from app.models.knowledge import KnowledgeChunk, KnowledgeSource
from app.models.repository import Repository
from app.rag.embeddings import get_embedding_provider
from app.rag.retrieval_types import RetrievedChunk

logger = get_logger(__name__)

RRF_K = 60  # standard RRF smoothing constant


def _row_to_chunk(row, score: float) -> RetrievedChunk:
    chunk: KnowledgeChunk = row.KnowledgeChunk
    source: KnowledgeSource = row.KnowledgeSource
    repo_full_name = row.repo_full_name
    document_name = row.document_name

    return RetrievedChunk(
        chunk_id=chunk.id,
        knowledge_source_id=source.id,
        content=chunk.content,
        score=score,
        source_type=source.source_type.value,
        file_path=source.file_path,
        language=source.language,
        repository_id=source.repository_id,
        repository_full_name=repo_full_name,
        document_id=source.document_id,
        document_name=document_name,
        section_title=chunk.section_title,
        symbol_name=chunk.symbol_name,
        start_line=chunk.start_line,
        end_line=chunk.end_line,
    )


async def _vector_candidates(
    db: AsyncSession, project_id: uuid.UUID, query_embedding: list[float], candidate_k: int
) -> list[tuple[uuid.UUID, RetrievedChunk]]:
    distance = KnowledgeChunk.embedding.cosine_distance(query_embedding)
    stmt_with_distance = (
        select(
            KnowledgeChunk,
            KnowledgeSource,
            Repository.full_name.label("repo_full_name"),
            Document.original_filename.label("document_name"),
            distance.label("distance"),
        )
        .join(KnowledgeSource, KnowledgeChunk.knowledge_source_id == KnowledgeSource.id)
        .outerjoin(Repository, KnowledgeSource.repository_id == Repository.id)
        .outerjoin(Document, KnowledgeSource.document_id == Document.id)
        .where(KnowledgeChunk.project_id == project_id, KnowledgeChunk.embedding.isnot(None))
        .order_by(distance)
        .limit(candidate_k)
    )
    result = await db.execute(stmt_with_distance)
    output = []
    for row in result:
        similarity_score = 1.0 - float(row.distance)
        output.append((row.KnowledgeChunk.id, _row_to_chunk(row, similarity_score)))
    return output


async def _keyword_candidates(
    db: AsyncSession, project_id: uuid.UUID, query_text: str, candidate_k: int
) -> list[tuple[uuid.UUID, RetrievedChunk]]:
    tsquery = func.plainto_tsquery("english", query_text)
    rank = func.ts_rank(KnowledgeChunk.content_tsv, tsquery)
    stmt = (
        select(
            KnowledgeChunk,
            KnowledgeSource,
            Repository.full_name.label("repo_full_name"),
            Document.original_filename.label("document_name"),
            rank.label("rank"),
        )
        .join(KnowledgeSource, KnowledgeChunk.knowledge_source_id == KnowledgeSource.id)
        .outerjoin(Repository, KnowledgeSource.repository_id == Repository.id)
        .outerjoin(Document, KnowledgeSource.document_id == Document.id)
        .where(
            KnowledgeChunk.project_id == project_id,
            KnowledgeChunk.content_tsv.op("@@")(tsquery),
        )
        .order_by(rank.desc())
        .limit(candidate_k)
    )
    result = await db.execute(stmt)
    output = []
    for row in result:
        output.append((row.KnowledgeChunk.id, _row_to_chunk(row, float(row.rank))))
    return output


async def hybrid_search(
    db: AsyncSession,
    project_id: uuid.UUID,
    query_text: str,
    top_k: int = 8,
    candidate_k: int = 30,
    source_type: str | None = None,
    repository_id: uuid.UUID | None = None,
) -> list[RetrievedChunk]:
    """
    Returns up to `top_k` chunks, ranked by Reciprocal Rank Fusion of vector
    similarity and full-text keyword rank. Never returns more than
    `candidate_k` raw candidates per method, so we don't ship the whole
    knowledge base to the fusion step.
    """
    provider = get_embedding_provider()
    query_embedding = await provider.embed_query(query_text)

    vector_hits = await _vector_candidates(db, project_id, query_embedding, candidate_k)
    keyword_hits = await _keyword_candidates(db, project_id, query_text, candidate_k)

    fused_scores: dict[uuid.UUID, float] = {}
    chunk_lookup: dict[uuid.UUID, RetrievedChunk] = {}

    for rank_position, (chunk_id, chunk) in enumerate(vector_hits):
        fused_scores[chunk_id] = fused_scores.get(chunk_id, 0.0) + 1.0 / (RRF_K + rank_position + 1)
        chunk_lookup[chunk_id] = chunk

    for rank_position, (chunk_id, chunk) in enumerate(keyword_hits):
        fused_scores[chunk_id] = fused_scores.get(chunk_id, 0.0) + 1.0 / (RRF_K + rank_position + 1)
        chunk_lookup.setdefault(chunk_id, chunk)

    ranked_ids = sorted(fused_scores.keys(), key=lambda cid: fused_scores[cid], reverse=True)

    results: list[RetrievedChunk] = []
    for chunk_id in ranked_ids:
        chunk = chunk_lookup[chunk_id]
        if source_type and chunk.source_type != source_type:
            continue
        if repository_id and chunk.repository_id != repository_id:
            continue
        chunk.score = fused_scores[chunk_id]
        results.append(chunk)
        if len(results) >= candidate_k:
            break

    logger.info(
        "hybrid_search_completed",
        project_id=str(project_id),
        vector_hits=len(vector_hits),
        keyword_hits=len(keyword_hits),
        fused_count=len(results),
    )

    return results[:top_k] if top_k < len(results) else results
