import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import KnowledgeSourceType
from app.models.knowledge import KnowledgeChunk, KnowledgeSource
from app.models.project import Project
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.models.enums import WorkspaceRole
from app.rag.embeddings import get_embedding_provider
from app.rag.hybrid_search import hybrid_search
from app.rag.retrieval_service import retrieve_context


async def _make_project(db: AsyncSession) -> Project:
    user = User(email=f"retrieval-{uuid.uuid4().hex}@example.com", hashed_password="x", full_name="Retrieval Tester")
    db.add(user)
    await db.flush()

    workspace = Workspace(name="Retrieval WS", slug=f"retrieval-ws-{user.id}", owner_id=user.id)
    db.add(workspace)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER))

    project = Project(workspace_id=workspace.id, name="Retrieval Project")
    db.add(project)
    await db.flush()
    return project


async def _add_chunk(db: AsyncSession, project: Project, file_path: str, content: str) -> None:
    source = KnowledgeSource(
        project_id=project.id,
        source_type=KnowledgeSourceType.CODE_FILE,
        file_path=file_path,
        language="python",
        content_hash="hash-" + file_path,
    )
    db.add(source)
    await db.flush()

    provider = get_embedding_provider()
    embedding = await provider.embed_query(content)

    db.add(
        KnowledgeChunk(
            project_id=project.id,
            knowledge_source_id=source.id,
            content=content,
            content_hash="chash-" + file_path,
            chunk_index=0,
            token_count=len(content.split()),
            symbol_name="authenticate_user",
            symbol_type="function",
            start_line=1,
            end_line=10,
            embedding=embedding,
        )
    )
    await db.commit()


@pytest.mark.asyncio
async def test_hybrid_search_finds_keyword_match(db_session: AsyncSession):
    project = await _make_project(db_session)
    await _add_chunk(
        db_session,
        project,
        "app/services/auth_service.py",
        "def authenticate_user(email, password):\n    # verifies bcrypt password hash\n    return user",
    )
    await _add_chunk(
        db_session,
        project,
        "app/services/billing_service.py",
        "def charge_credit_card(amount):\n    # processes a Stripe payment\n    return receipt",
    )

    results = await hybrid_search(db_session, project.id, "how does authenticate_user work", top_k=5)

    assert len(results) >= 1
    assert any("auth_service.py" in (r.file_path or "") for r in results)


@pytest.mark.asyncio
async def test_retrieve_context_respects_project_isolation(db_session: AsyncSession):
    project_a = await _make_project(db_session)
    project_b = await _make_project(db_session)

    await _add_chunk(
        db_session, project_a, "app/a_only.py", "def secret_function_alpha():\n    return 1"
    )

    results_for_b = await retrieve_context(db_session, project_b.id, "secret_function_alpha", top_k=5)
    assert all(r.file_path != "app/a_only.py" for r in results_for_b)


@pytest.mark.asyncio
async def test_retrieve_context_returns_empty_for_empty_project(db_session: AsyncSession):
    project = await _make_project(db_session)
    results = await retrieve_context(db_session, project.id, "anything at all", top_k=5)
    assert results == []
