"""
LLM provider abstraction. Any OpenAI-compatible chat completions endpoint
works by changing LLM_PROVIDER/LLM_BASE_URL/LLM_MODEL/LLM_API_KEY — no code
changes required.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class LLMProviderError(Exception):
    pass


@dataclass
class ChatResult:
    content: str
    input_tokens: int
    output_tokens: int


def _get_client() -> AsyncOpenAI:
    if not settings.llm_api_key:
        raise LLMProviderError(
            "LLM_API_KEY is not configured. Set it in your environment to enable AI features."
        )
    return AsyncOpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        timeout=settings.llm_request_timeout_seconds,
    )


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=8), reraise=True)
async def chat_completion(
    messages: list[dict], temperature: float = 0.2, max_tokens: int = 1500
) -> ChatResult:
    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("llm_chat_completion_failed", error=str(exc))
        raise LLMProviderError(f"LLM provider request failed: {exc}") from exc

    choice = response.choices[0]
    usage = response.usage
    return ChatResult(
        content=choice.message.content or "",
        input_tokens=usage.prompt_tokens if usage else 0,
        output_tokens=usage.completion_tokens if usage else 0,
    )


async def chat_completion_stream(
    messages: list[dict], temperature: float = 0.3, max_tokens: int = 2000
) -> AsyncIterator[str]:
    client = _get_client()
    try:
        stream = await client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content
    except Exception as exc:  # noqa: BLE001
        logger.error("llm_stream_failed", error=str(exc))
        raise LLMProviderError(f"LLM provider streaming request failed: {exc}") from exc
