from __future__ import annotations

from app.agents.state import EvidenceItem
from app.rag.retrieval_types import RetrievedChunk


def chunk_to_evidence_item(chunk: RetrievedChunk, retrieved_by: str) -> EvidenceItem:
    return EvidenceItem(
        chunk_id=str(chunk.chunk_id),
        knowledge_source_id=str(chunk.knowledge_source_id),
        content=chunk.content,
        score=chunk.score,
        source_type=chunk.source_type,
        file_path=chunk.file_path,
        language=chunk.language,
        repository_id=str(chunk.repository_id) if chunk.repository_id else None,
        repository_full_name=chunk.repository_full_name,
        document_id=str(chunk.document_id) if chunk.document_id else None,
        document_name=chunk.document_name,
        section_title=chunk.section_title,
        symbol_name=chunk.symbol_name,
        start_line=chunk.start_line,
        end_line=chunk.end_line,
        retrieved_by=retrieved_by,
    )


def dedupe_evidence(evidence: list[EvidenceItem]) -> list[EvidenceItem]:
    best: dict[str, EvidenceItem] = {}
    for item in evidence:
        existing = best.get(item["chunk_id"])
        if existing is None or item["score"] > existing["score"]:
            best[item["chunk_id"]] = item
    # Preserve stable, score-descending order
    return sorted(best.values(), key=lambda i: i["score"], reverse=True)


def evidence_label(item: EvidenceItem) -> str:
    if item["source_type"] == "code_file" and item["file_path"]:
        if item["start_line"] and item["end_line"]:
            return f"{item['file_path']}:{item['start_line']}-{item['end_line']}"
        return item["file_path"]
    if item["document_name"]:
        section = f" — {item['section_title']}" if item.get("section_title") else ""
        return f"{item['document_name']}{section}"
    return "Unknown source"


def format_evidence_for_prompt(evidence: list[EvidenceItem], max_chars_each: int = 800) -> str:
    if not evidence:
        return "(no evidence retrieved)"
    lines = []
    for i, item in enumerate(evidence):
        snippet = item["content"][:max_chars_each]
        lines.append(f"[{i + 1}] {evidence_label(item)}\n{snippet}")
    return "\n\n".join(lines)
