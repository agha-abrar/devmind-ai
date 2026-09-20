from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class RetrievedChunk:
    chunk_id: uuid.UUID
    knowledge_source_id: uuid.UUID
    content: str
    score: float
    source_type: str  # "code_file" | "document"
    file_path: str | None
    language: str | None
    repository_id: uuid.UUID | None
    repository_full_name: str | None
    document_id: uuid.UUID | None
    document_name: str | None
    section_title: str | None
    symbol_name: str | None
    start_line: int | None
    end_line: int | None

    def display_label(self) -> str:
        if self.source_type == "code_file" and self.file_path:
            if self.start_line and self.end_line:
                return f"{self.file_path}:{self.start_line}-{self.end_line}"
            return self.file_path
        if self.document_name:
            return self.document_name
        return "Unknown source"
