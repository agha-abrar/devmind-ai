"""
Embedding provider abstraction.

Any OpenAI-compatible embeddings endpoint (OpenAI itself, or a
self-hosted/gateway service exposing the same /embeddings API shape) can be
plugged in purely through environment variables — no code changes needed.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from openai import AsyncOpenAI
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

EMBEDDING_BATCH_SIZE = 64


class EmbeddingProviderError(Exception):
    pass


class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding vector per input text, in the same order."""

    async def embed_query(self, text: str) -> list[float]:
        vectors = await self.embed_texts([text])
        return vectors[0]


class OpenAICompatibleEmbeddingProvider(EmbeddingProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str,
        dimensions: int,
    ) -> None:
        if not api_key:
            raise EmbeddingProviderError(
                "EMBEDDING_API_KEY is not configured. Set it in your environment to enable "
                "repository/document indexing."
            )
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model
        self._dimensions = dimensions

    @retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        response = await self._client.embeddings.create(
            model=self._model,
            input=batch,
            dimensions=self._dimensions,
        )
        return [item.embedding for item in response.data]

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), EMBEDDING_BATCH_SIZE):
            batch = texts[i : i + EMBEDDING_BATCH_SIZE]
            try:
                embeddings = await self._embed_batch(batch)
            except Exception as exc:
                logger.error("embedding_batch_failed", batch_start=i, error=str(exc))
                raise EmbeddingProviderError(f"Embedding provider request failed: {exc}") from exc
            all_embeddings.extend(embeddings)

        return all_embeddings


def get_embedding_provider() -> EmbeddingProvider:
    if settings.embedding_provider in ("openai", "openai_compatible"):
        return OpenAICompatibleEmbeddingProvider(
            api_key=settings.embedding_api_key,
            model=settings.embedding_model,
            base_url=settings.embedding_base_url,
            dimensions=settings.embedding_dimensions,
        )
    raise EmbeddingProviderError(f"Unsupported embedding provider: {settings.embedding_provider}")
