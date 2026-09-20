from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Citation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    A verified link between a piece of assistant prose and a specific,
    retrieved KnowledgeChunk. The LLM never invents these — citations are only
    created from evidence IDs that were actually retrieved for the turn.
    """

    __tablename__ = "citations"

    message_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False
    )
    knowledge_chunk_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("knowledge_chunks.id", ondelete="CASCADE"), nullable=False
    )
    marker: Mapped[int] = mapped_column(Integer, nullable=False)  # [1], [2], ...

    # Denormalized display fields so the UI never needs a join to render citations
    display_label: Mapped[str] = mapped_column(String(500), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    document_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    repository_full_name: Mapped[str | None] = mapped_column(String(511), nullable=True)
    start_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    snippet: Mapped[str] = mapped_column(Text, nullable=False)

    message: Mapped["Message"] = relationship(back_populates="citations")
    knowledge_chunk: Mapped["KnowledgeChunk"] = relationship()
