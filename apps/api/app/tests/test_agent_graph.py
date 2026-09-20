import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph import compiled_graph
from app.agents.nodes_core import route_after_supervisor
from app.models.enums import KnowledgeSourceType, WorkspaceRole
from app.models.knowledge import KnowledgeChunk, KnowledgeSource
from app.models.project import Project
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.rag.embeddings import get_embedding_provider


def test_route_after_supervisor_returns_planned_agents():
    state = {"execution_plan": ["code_retrieval", "debugging"]}
    assert route_after_supervisor(state) == ["code_retrieval", "debugging"]


def test_route_after_supervisor_falls_back_to_reviewer_when_no_plan():
    state = {"execution_plan": []}
    assert route_after_supervisor(state) == ["reviewer"]


async def _make_project_with_chunk(db: AsyncSession) -> Project:
    user = User(email="agent-test@example.com", hashed_password="x", full_name="Agent Tester")
    db.add(user)
    await db.flush()
    workspace = Workspace(name="Agent WS", slug=f"agent-ws-{user.id}", owner_id=user.id)
    db.add(workspace)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER))
    project = Project(workspace_id=workspace.id, name="Agent Project")
    db.add(project)
    await db.flush()

    source = KnowledgeSource(
        project_id=project.id,
        source_type=KnowledgeSourceType.CODE_FILE,
        file_path="app/core/security.py",
        language="python",
        content_hash="hash1",
    )
    db.add(source)
    await db.flush()

    provider = get_embedding_provider()
    content = "def create_access_token(user_id):\n    return jwt.encode(...)"
    embedding = await provider.embed_query(content)
    db.add(
        KnowledgeChunk(
            project_id=project.id,
            knowledge_source_id=source.id,
            content=content,
            content_hash="chash1",
            chunk_index=0,
            token_count=10,
            symbol_name="create_access_token",
            symbol_type="function",
            start_line=1,
            end_line=2,
            embedding=embedding,
        )
    )
    await db.commit()
    return project


@pytest.mark.asyncio
async def test_graph_produces_grounded_citations_from_real_evidence_only(db_session: AsyncSession):
    project = await _make_project_with_chunk(db_session)

    initial_state = {
        "project_id": str(project.id),
        "conversation_id": "00000000-0000-0000-0000-000000000000",
        "question": "How is the access token created?",
        "conversation_history": [],
        "evidence": [],
        "agent_outputs": [],
        "errors": [],
        "step_events": [],
    }

    final_state = await compiled_graph.ainvoke(
        initial_state,
        config={"configurable": {"db": db_session, "project_id": project.id}},
    )

    assert final_state["execution_plan"] == ["code_retrieval"]
    assert final_state["review_status"] == "supported"

    retrieved_ids = {e["chunk_id"] for e in final_state["evidence"]}
    cited_ids = {c["chunk_id"] for c in final_state["final_citations"]}
    # Every citation must correspond to an actually retrieved evidence chunk —
    # the graph must never fabricate a citation.
    assert cited_ids.issubset(retrieved_ids)
    assert len(cited_ids) > 0


@pytest.mark.asyncio
async def test_graph_returns_low_evidence_message_when_nothing_retrieved(db_session: AsyncSession):
    user = User(email="empty-agent@example.com", hashed_password="x", full_name="Empty Tester")
    db_session.add(user)
    await db_session.flush()
    workspace = Workspace(name="Empty WS", slug=f"empty-ws-{user.id}", owner_id=user.id)
    db_session.add(workspace)
    await db_session.flush()
    db_session.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER))
    project = Project(workspace_id=workspace.id, name="Empty Project")
    db_session.add(project)
    await db_session.commit()

    initial_state = {
        "project_id": str(project.id),
        "conversation_id": "00000000-0000-0000-0000-000000000000",
        "question": "How does the payment retry logic work?",
        "conversation_history": [],
        "evidence": [],
        "agent_outputs": [],
        "errors": [],
        "step_events": [],
    }

    final_state = await compiled_graph.ainvoke(
        initial_state,
        config={"configurable": {"db": db_session, "project_id": project.id}},
    )

    assert final_state["review_status"] == "unsupported"
    assert "couldn't find enough evidence" in final_state["final_answer"].lower()
    assert final_state["final_citations"] == []
