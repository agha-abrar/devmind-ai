from __future__ import annotations

import time

import redis.asyncio as redis
from fastapi import HTTPException, status

from app.core.config import settings

_redis_client: redis.Redis | None = None


def _get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


class RateLimiter:
    """Fixed-window rate limiter keyed by an arbitrary identifier (usually user_id)."""

    def __init__(self, limit: int, window_seconds: int, scope: str):
        self.limit = limit
        self.window_seconds = window_seconds
        self.scope = scope

    async def check(self, identifier: str) -> None:
        client = _get_redis()
        window = int(time.time() // self.window_seconds)
        key = f"ratelimit:{self.scope}:{identifier}:{window}"
        try:
            count = await client.incr(key)
            if count == 1:
                await client.expire(key, self.window_seconds)
        except Exception:
            # Fail open: if Redis is briefly unavailable, don't block the user.
            return

        if count > self.limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {self.scope}. Try again shortly.",
            )


chat_rate_limiter = RateLimiter(
    limit=settings.rate_limit_chat_per_minute, window_seconds=60, scope="chat"
)
ingestion_rate_limiter = RateLimiter(
    limit=settings.rate_limit_ingestion_per_hour, window_seconds=3600, scope="ingestion"
)
