"""
Run retrieval evaluation (Recall@K, MRR) against a project that has already
been indexed (e.g. index this very repository as a DevMind AI project first).

Usage:
    python -m eval.run_evaluation <project_id> [--dataset eval/dataset.example.json] [--k 5]
"""
import argparse
import asyncio
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.rag.evaluation import EvalCase, run_evaluation  # noqa: E402


def load_cases(path: str) -> list[EvalCase]:
    with open(path) as f:
        data = json.load(f)
    return [
        EvalCase(
            question=c["question"],
            expected_file_paths=c.get("expected_file_paths", []),
            expected_document_names=c.get("expected_document_names", []),
            expected_keywords=c.get("expected_keywords", []),
        )
        for c in data["cases"]
    ]


async def main(project_id: str, dataset_path: str, k: int) -> None:
    cases = load_cases(dataset_path)
    async with AsyncSessionLocal() as db:
        report = await run_evaluation(db, uuid.UUID(project_id), cases, k=k)

    print(f"\nRetrieval evaluation (k={report.k}, {len(cases)} cases)")
    print(f"  Recall@{report.k}: {report.recall_at_k:.2%}")
    print(f"  MRR:        {report.mrr:.3f}\n")
    for result in report.case_results:
        status = "HIT " if result.hit else "MISS"
        rank = f"rank={result.rank_of_first_hit}" if result.rank_of_first_hit else "rank=-"
        print(f"  [{status}] ({rank}) {result.question}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("project_id")
    parser.add_argument("--dataset", default="eval/dataset.example.json")
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()
    asyncio.run(main(args.project_id, args.dataset, args.k))
