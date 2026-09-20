"""
Document-aware chunking for uploaded knowledge sources (Markdown, PDF, DOCX,
plain text). Preserves heading/section structure where the source format has
one; otherwise splits on paragraph boundaries within a token budget.
"""
from __future__ import annotations

import re

from app.rag.chunk_types import Chunk
from app.rag.tokenizer import count_tokens

MAX_CHUNK_TOKENS = 400
MIN_CHUNK_TOKENS = 15

_MARKDOWN_HEADING = re.compile(r"^(#{1,6})\s+(.*)$", re.MULTILINE)


def _chunk_markdown(content: str) -> list[Chunk]:
    matches = list(_MARKDOWN_HEADING.finditer(content))
    if not matches:
        return _chunk_plain_text(content)

    sections: list[tuple[str, str]] = []
    if matches[0].start() > 0:
        preamble = content[: matches[0].start()].strip()
        if preamble:
            sections.append(("Introduction", preamble))

    for i, match in enumerate(matches):
        title = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        body = content[start:end].strip()
        sections.append((title, f"{title}\n\n{body}" if body else title))

    chunks: list[Chunk] = []
    for title, text in sections:
        if not text.strip():
            continue
        if count_tokens(text) <= MAX_CHUNK_TOKENS:
            chunks.append(
                Chunk(
                    content=text,
                    chunk_index=len(chunks),
                    token_count=count_tokens(text),
                    section_title=title,
                )
            )
        else:
            for sub in _split_paragraphs(text, MAX_CHUNK_TOKENS):
                chunks.append(
                    Chunk(
                        content=sub,
                        chunk_index=len(chunks),
                        token_count=count_tokens(sub),
                        section_title=title,
                    )
                )
    return chunks


def _split_paragraphs(text: str, max_tokens: int) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    buffer: list[str] = []
    buffer_tokens = 0

    for para in paragraphs:
        para_tokens = count_tokens(para)
        if buffer and buffer_tokens + para_tokens > max_tokens:
            chunks.append("\n\n".join(buffer))
            buffer = []
            buffer_tokens = 0
        buffer.append(para)
        buffer_tokens += para_tokens

    if buffer:
        chunks.append("\n\n".join(buffer))

    return chunks or [text]


def _chunk_plain_text(content: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    for text in _split_paragraphs(content, MAX_CHUNK_TOKENS):
        if count_tokens(text) < MIN_CHUNK_TOKENS and chunks:
            # Merge tiny trailing fragments into the previous chunk
            prev = chunks[-1]
            merged = f"{prev.content}\n\n{text}"
            chunks[-1] = Chunk(
                content=merged,
                chunk_index=prev.chunk_index,
                token_count=count_tokens(merged),
                section_title=prev.section_title,
            )
            continue
        chunks.append(
            Chunk(content=text, chunk_index=len(chunks), token_count=count_tokens(text))
        )
    return chunks


def chunk_document_text(content: str, file_type: str) -> list[Chunk]:
    if not content.strip():
        return []

    if file_type.lower() in {"md", "markdown"}:
        return _chunk_markdown(content)

    return _chunk_plain_text(content)
