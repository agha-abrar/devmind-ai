"""
Reranking abstraction.

Retrieval architecture: retrieve candidates (hybrid_search) -> rerank -> keep
the strongest evidence for the agents.

If RERANKER_PROVIDER is unset ("none"), we fall back to a deterministic
lexical-overlap heuristic reranker so the pipeline degrades gracefully rather
than silently skipping reranking. If an OpenAI-compatible chat model is
configured as the reranker, we use it as an LLM-based relevance judge
(cheap, fast model recommended).
"""
from __future__ import annotations

import re
from abc import ABC, abstractmethod

from openai import AsyncOpenAI

from app.core.config import settings
from app.core.logging import get_logger
from app.rag.retrieval_types import RetrievedChunk

logger = get_logger(__name__)

_WORD_PATTERN = re.compile(r"[a-zA-Z_][a-zA-Z0-9_]{2,}")


class Reranker(ABC):
    @abstractmethod
    async def rerank(
        self, query: str, chunks: list[RetrievedChunk], top_k: int
    ) -> list[RetrievedChunk]:
        ...


class HeuristicOverlapReranker(Reranker):
    """
    Fallback reranker used when no dedicated reranking model is configured.
    Scores each chunk by normalized token overlap with the query, blended
    with the original hybrid retrieval score. Deterministic and free.
    """

    async def rerank(
        self, query: str, chunks: list[RetrievedChunk], top_k: int
    ) -> list[RetrievedChunk]:
        query_terms = set(t.lower() for t in _WORD_PATTERN.findall(query))
        if not query_terms:
            return chunks[:top_k]

        scored: list[tuple[float, RetrievedChunk]] = []
        for chunk in chunks:
            chunk_terms = set(t.lower() for t in _WORD_PATTERN.findall(chunk.content))
            overlap = len(query_terms & chunk_terms) / max(len(query_terms), 1)
            blended = 0.6 * overlap + 0.4 * chunk.score
            scored.append((blended, chunk))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [chunk for _, chunk in scored[:top_k]]


class LLMJudgeReranker(Reranker):
    """
    Uses a small, fast chat model as a relevance judge: asks it to score each
    candidate 0-10 for relevance to the query, in a single structured-output
    call, then sorts by score. Falls back to the heuristic reranker on any
    provider failure so a flaky reranker never breaks retrieval.
    """

    def __init__(self, api_key: str, model: str, base_url: str):
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model
        self._fallback = HeuristicOverlapReranker()

    async def rerank(
        self, query: str, chunks: list[RetrievedChunk], top_k: int
    ) -> list[RetrievedChunk]:
        if not chunks:
            return []

        numbered = "\n\n".join(
            f"[{i}] {c.display_label()}\n{c.content[:600]}" for i, c in enumerate(chunks)
        )
        prompt = (
            "Score how relevant each numbered passage is to the question, from 0 (irrelevant) "
            "to 10 (directly answers it). Respond ONLY with JSON: a list of "
            '{"index": <int>, "score": <int>}, one entry per passage, no other text.\n\n'
            f"Question: {query}\n\nPassages:\n{numbered}"
        )

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=1000,
            )
            raw = response.choices[0].message.content or "[]"
            raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            import json

            scores = json.loads(raw)
            score_map = {int(item["index"]): float(item["score"]) for item in scores}
        except Exception as exc:  # noqa: BLE001
            logger.warning("llm_reranker_failed_falling_back", error=str(exc))
            return await self._fallback.rerank(query, chunks, top_k)

        scored = [(score_map.get(i, 0.0), chunk) for i, chunk in enumerate(chunks)]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [chunk for _, chunk in scored[:top_k]]


def get_reranker() -> Reranker:
    if settings.reranker_provider == "none" or not settings.reranker_model:
        return HeuristicOverlapReranker()

    return LLMJudgeReranker(
        api_key=settings.reranker_api_key or settings.llm_api_key,
        model=settings.reranker_model,
        base_url=settings.llm_base_url,
    )
