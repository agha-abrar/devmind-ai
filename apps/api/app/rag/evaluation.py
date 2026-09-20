"""
Basic RAG evaluation framework.

A dataset is a list of cases, each with a question and either expected file
paths (for code) / document names, or expected keywords that should appear
in at least one retrieved chunk. Computes Recall@K and MRR, the two standard
retrieval metrics that don't require an LLM judge.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.rag.retrieval_service import retrieve_context
from app.rag.retrieval_types import RetrievedChunk


@dataclass
class EvalCase:
    question: str
    expected_file_paths: list[str] = field(default_factory=list)
    expected_document_names: list[str] = field(default_factory=list)
    expected_keywords: list[str] = field(default_factory=list)


@dataclass
class EvalCaseResult:
    question: str
    hit: bool
    rank_of_first_hit: int | None  # 1-indexed
    retrieved_labels: list[str]


@dataclass
class EvalReport:
    case_results: list[EvalCaseResult]
    recall_at_k: float
    mrr: float
    k: int


def _chunk_matches(chunk: RetrievedChunk, case: EvalCase) -> bool:
    if case.expected_file_paths and chunk.file_path:
        if any(chunk.file_path.endswith(p) or p in chunk.file_path for p in case.expected_file_paths):
            return True
    if case.expected_document_names and chunk.document_name:
        if any(name.lower() in chunk.document_name.lower() for name in case.expected_document_names):
            return True
    if case.expected_keywords:
        content_lower = chunk.content.lower()
        if any(kw.lower() in content_lower for kw in case.expected_keywords):
            return True
    return False


async def run_evaluation(
    db: AsyncSession, project_id: uuid.UUID, cases: list[EvalCase], k: int = 5
) -> EvalReport:
    results: list[EvalCaseResult] = []
    hits = 0
    reciprocal_ranks: list[float] = []

    for case in cases:
        chunks = await retrieve_context(db, project_id, case.question, top_k=k, candidate_k=max(k * 3, 20))

        rank_of_first_hit: int | None = None
        for i, chunk in enumerate(chunks):
            if _chunk_matches(chunk, case):
                rank_of_first_hit = i + 1
                break

        hit = rank_of_first_hit is not None
        if hit:
            hits += 1
            reciprocal_ranks.append(1.0 / rank_of_first_hit)
        else:
            reciprocal_ranks.append(0.0)

        results.append(
            EvalCaseResult(
                question=case.question,
                hit=hit,
                rank_of_first_hit=rank_of_first_hit,
                retrieved_labels=[c.display_label() for c in chunks],
            )
        )

    recall_at_k = hits / len(cases) if cases else 0.0
    mrr = sum(reciprocal_ranks) / len(cases) if cases else 0.0

    return EvalReport(case_results=results, recall_at_k=recall_at_k, mrr=mrr, k=k)
