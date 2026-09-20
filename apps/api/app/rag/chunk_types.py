from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Chunk:
    content: str
    chunk_index: int
    token_count: int
    symbol_name: str | None = None
    symbol_type: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    section_title: str | None = None
