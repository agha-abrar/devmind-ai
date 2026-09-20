from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.rag.hybrid_search import hybrid_search
from app.rag.reranker import get_reranker
from app.rag.retrieval_types import RetrievedChunk

DEFAULT_TOP_K = 8
DEFAULT_CANDIDATE_K = 30


async def retrieve_context(
    db: AsyncSession,
    project_id: uuid.UUID,
    query: str,
    top_k: int = DEFAULT_TOP_K,
    candidate_k: int = DEFAULT_CANDIDATE_K,
    source_type: str | None = None,
    repository_id: uuid.UUID | None = None,
) -> list[RetrievedChunk]:
    candidates = await hybrid_search(
        db=db,
        project_id=project_id,
        query_text=query,
        top_k=top_k,
        candidate_k=candidate_k,
        source_type=source_type,
        repository_id=repository_id,
    )
    if not candidates:
        return []

    reranker = get_reranker()
    return await reranker.rerank(query, candidates, top_k)
