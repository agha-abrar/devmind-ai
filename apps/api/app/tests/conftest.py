"""
Shared pytest fixtures.

Requires a dedicated Postgres database ending in _test at DATABASE_URL. Tables are created fresh and dropped per test
session so tests never depend on manually-run migrations. All external paid
services (LLM, embeddings, GitHub) are mocked — no real API calls are made.
"""
from __future__ import annotations

import sys
import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db.base import Base
from app.core.config import settings
from app.db.session import get_db
from app.main import app
from app.models.user import User


# Never create/drop tables in the application's database.
if not (make_url(settings.database_url).database or "").endswith("_test"):
    raise RuntimeError("Set DATABASE_URL to a dedicated database whose name ends in _test.")

engine = create_async_engine(settings.database_url, poolclass=NullPool)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _test_get_db():
    async with AsyncSessionLocal() as session:
        yield session


@pytest.fixture(autouse=True)
def override_database():
    app.dependency_overrides[get_db] = _test_get_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture(scope="session", loop_scope="session", autouse=True)
async def _create_schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def registered_user(client: AsyncClient) -> dict:
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePass123!", "full_name": "Test User"},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest_asyncio.fixture
async def auth_headers(registered_user: dict) -> dict:
    return {"Authorization": f"Bearer {registered_user['access_token']}"}


@pytest_asyncio.fixture
async def second_user_auth_headers(client: AsyncClient) -> dict:
    email = f"other-{uuid.uuid4().hex[:8]}@example.com"
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePass123!", "full_name": "Other User"},
    )
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def mock_embeddings(monkeypatch):
    """Every test gets a deterministic, free, fake embedding provider by default."""
    from app.rag import embeddings as embeddings_module

    class FakeEmbeddingProvider:
        async def embed_texts(self, texts: list[str]) -> list[list[float]]:
            # Deterministic pseudo-embedding derived from text length/hash so
            # similarity search still produces stable, comparable results.
            return [self._fake_vector(t) for t in texts]

        async def embed_query(self, text: str) -> list[float]:
            return self._fake_vector(text)

        @staticmethod
        def _fake_vector(text: str) -> list[float]:
            import hashlib

            from app.core.config import settings

            digest = hashlib.sha256(text.encode()).digest()
            values = [(b / 255.0) - 0.5 for b in digest]
            dim = settings.embedding_dimensions
            return (values * (dim // len(values) + 1))[:dim]

    original = embeddings_module.get_embedding_provider
    for module in list(sys.modules.values()):
        if module and getattr(module, "__name__", "").startswith("app."):
            if getattr(module, "get_embedding_provider", None) is original:
                monkeypatch.setattr(module, "get_embedding_provider", lambda: FakeEmbeddingProvider())


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    """No test should ever call a real, paid LLM provider."""
    from app.agents import llm_client

    async def fake_chat_completion(messages, temperature=0.2, max_tokens=1500):
        return llm_client.ChatResult(
            content='{"task_classification": "code_lookup", "agents": ["code_retrieval"]}',
            input_tokens=10,
            output_tokens=10,
        )

    async def fake_chat_completion_stream(messages, temperature=0.3, max_tokens=2000):
        for token in ["This ", "is ", "a ", "mocked ", "response ", "[1]."]:
            yield token

    for name, replacement in (
        ("chat_completion", fake_chat_completion),
        ("chat_completion_stream", fake_chat_completion_stream),
    ):
        original = getattr(llm_client, name)
        for module in list(sys.modules.values()):
            if module and getattr(module, "__name__", "").startswith("app."):
                if getattr(module, name, None) is original:
                    monkeypatch.setattr(module, name, replacement)
