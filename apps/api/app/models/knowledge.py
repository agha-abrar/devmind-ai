from __future__ import annotations

import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import Computed, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import KnowledgeSourceType


class KnowledgeSource(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    A single indexable unit: one file from a repository, or one uploaded
    document. Chunks (KnowledgeChunk) always belong to a KnowledgeSource.
    """

    __tablename__ = "knowledge_sources"

    project_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    source_type: Mapped[KnowledgeSourceType] = mapped_column(
        Enum(KnowledgeSourceType, name="knowledge_source_type", values_callable=lambda cls: [item.value for item in cls]), nullable=False
    )

    # Populated when source_type == CODE_FILE
    repository_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=True
    )
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Populated when source_type == DOCUMENT
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True
    )

    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_stale: Mapped[bool] = mapped_column(default=False, nullable=False)

    project: Mapped["Project"] = relationship(back_populates="knowledge_sources")
    repository: Mapped["Repository | None"] = relationship(back_populates="knowledge_sources")
    document: Mapped["Document | None"] = relationship(back_populates="knowledge_sources")
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_knowledge_sources_project_repo", "project_id", "repository_id"),
        Index("ix_knowledge_sources_project_document", "project_id", "document_id"),
    )


class KnowledgeChunk(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """
    A single embedded, retrievable unit of text with full provenance metadata.
    """

    __tablename__ = "knowledge_chunks"

    project_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    knowledge_source_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("knowledge_sources.id", ondelete="CASCADE"),
        nullable=False,
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Structural metadata (code)
    symbol_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    symbol_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # function/class/module
    start_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Structural metadata (documents)
    section_title: Mapped[str | None] = mapped_column(String(500), nullable=True)

    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(settings.embedding_dimensions), nullable=True
    )

    # Generated column powering PostgreSQL full-text (keyword) search.
    # Combined with `embedding` for hybrid retrieval (see app/rag/hybrid_search.py).
    content_tsv: Mapped[str] = mapped_column(
        TSVECTOR, Computed("to_tsvector('english', content)", persisted=True), nullable=True
    )

    source: Mapped["KnowledgeSource"] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("ix_knowledge_chunks_project_id", "project_id"),
        Index("ix_knowledge_chunks_content_tsv", "content_tsv", postgresql_using="gin"),
        Index(
            "ix_knowledge_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
