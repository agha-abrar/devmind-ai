"""
Ties the compiled LangGraph agent graph to persistence (AgentRun/AgentStep)
and to real token-level streaming of the final answer.

Usage: `async for event in run_and_stream_chat(...): ...` where each event is
a small dict the chat route turns directly into an SSE frame.
"""
from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.evidence_utils import evidence_label
from app.agents.graph import compiled_graph
from app.agents.pricing import estimate_cost_usd
from app.agents.state import AgentState
from app.agents.synthesis import build_synthesis_messages, stream_synthesis
from app.core.logging import get_logger
from app.models.agent_run import AgentRun, AgentStep
from app.models.citation import Citation
from app.models.conversation import Conversation, Message
from app.models.enums import AgentName, AgentRunStatus, AgentStepStatus, MessageRole, ReviewStatus

logger = get_logger(__name__)

MAX_HISTORY_MESSAGES = 10

_AGENT_NAME_MAP = {
    "supervisor": AgentName.SUPERVISOR,
    "code_retrieval": AgentName.CODE_RETRIEVAL,
    "documentation": AgentName.DOCUMENTATION,
    "debugging": AgentName.DEBUGGING,
    "architecture": AgentName.ARCHITECTURE,
    "implementation_planning": AgentName.IMPLEMENTATION_PLANNING,
    "reviewer": AgentName.REVIEWER,
}


async def _load_conversation_history(db: AsyncSession, conversation_id: uuid.UUID) -> list[dict]:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        return []
    messages = conversation.messages[-MAX_HISTORY_MESSAGES:]
    return [{"role": m.role.value, "content": m.content} for m in messages]


async def run_and_stream_chat(
    db: AsyncSession,
    project_id: uuid.UUID,
    conversation_id: uuid.UUID,
    user_question: str,
) -> AsyncIterator[dict]:
    history = await _load_conversation_history(db, conversation_id)

    user_message = Message(
        conversation_id=conversation_id, role=MessageRole.USER, content=user_question
    )
    db.add(user_message)
    await db.commit()

    agent_run = AgentRun(
        project_id=project_id,
        conversation_id=conversation_id,
        user_question=user_question,
        status=AgentRunStatus.RUNNING,
        started_at=datetime.now(timezone.utc),
    )
    db.add(agent_run)
    await db.commit()
    await db.refresh(agent_run)

    yield {"type": "agent_run_started", "agent_run_id": str(agent_run.id)}

    initial_state: AgentState = {
        "project_id": str(project_id),
        "conversation_id": str(conversation_id),
        "question": user_question,
        "conversation_history": history,
        "evidence": [],
        "agent_outputs": [],
        "errors": [],
        "step_events": [],
    }

    try:
        final_state: AgentState = await compiled_graph.ainvoke(
            initial_state,
            config={"configurable": {"db": db, "project_id": project_id}},
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("agent_graph_failed", agent_run_id=str(agent_run.id), error=str(exc))
        agent_run.status = AgentRunStatus.FAILED
        agent_run.error_message = str(exc)
        agent_run.completed_at = datetime.now(timezone.utc)
        await db.commit()
        yield {"type": "error", "message": "The agent workflow failed unexpectedly. Please try again."}
        return

    # Persist step trace
    total_input_tokens = 0
    total_output_tokens = 0
    for i, step in enumerate(final_state.get("step_events", [])):
        total_input_tokens += step["input_tokens"]
        total_output_tokens += step["output_tokens"]
        db.add(
            AgentStep(
                agent_run_id=agent_run.id,
                sequence_index=i,
                agent_name=_AGENT_NAME_MAP.get(step["agent"], AgentName.SUPERVISOR),
                status=AgentStepStatus.FAILED if step["error_message"] else AgentStepStatus.COMPLETED,
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
                duration_ms=step["duration_ms"],
                tool_calls=step["tool_calls"],
                retrieved_count=step["retrieved_count"],
                input_tokens=step["input_tokens"],
                output_tokens=step["output_tokens"],
                summary=step["summary"],
                error_message=step["error_message"],
            )
        )
    await db.commit()

    review_status = final_state.get("review_status", "unsupported")
    citations_source = final_state.get("final_citations", [])

    assistant_content = ""

    if review_status == "supported" and citations_source:
        messages = build_synthesis_messages(
            user_question, final_state.get("agent_outputs", []), citations_source
        )
        try:
            async for token in stream_synthesis(messages):
                assistant_content += token
                yield {"type": "token", "content": token}
        except Exception as exc:  # noqa: BLE001
            logger.error("synthesis_stream_failed", error=str(exc))
            fallback = (
                "I retrieved relevant evidence but the response generation failed "
                f"partway through ({exc}). Please retry."
            )
            assistant_content = fallback
            yield {"type": "token", "content": fallback}
    else:
        assistant_content = final_state.get(
            "final_answer",
            "I couldn't find enough evidence in the indexed repository or documents to "
            "answer this reliably.",
        )
        yield {"type": "token", "content": assistant_content}

    assistant_message = Message(
        conversation_id=conversation_id, role=MessageRole.ASSISTANT, content=assistant_content
    )
    db.add(assistant_message)
    await db.flush()

    citation_payloads = []
    if review_status == "supported":
        for i, item in enumerate(citations_source):
            citation = Citation(
                message_id=assistant_message.id,
                knowledge_chunk_id=uuid.UUID(item["chunk_id"]),
                marker=i + 1,
                display_label=evidence_label(item),
                source_type=item["source_type"],
                file_path=item["file_path"],
                document_name=item["document_name"],
                repository_full_name=item["repository_full_name"],
                start_line=item["start_line"],
                end_line=item["end_line"],
                snippet=item["content"][:2000],
            )
            db.add(citation)
            citation_payloads.append(
                {
                    "marker": i + 1,
                    "display_label": citation.display_label,
                    "source_type": citation.source_type,
                    "file_path": citation.file_path,
                    "document_name": citation.document_name,
                    "start_line": citation.start_line,
                    "end_line": citation.end_line,
                }
            )

    agent_run.message_id = assistant_message.id
    agent_run.status = AgentRunStatus.COMPLETED
    agent_run.review_status = ReviewStatus(review_status)
    agent_run.retry_count = final_state.get("retry_count", 0)
    agent_run.completed_at = datetime.now(timezone.utc)
    agent_run.started_at = agent_run.started_at or agent_run.completed_at
    agent_run.duration_ms = int(
        (agent_run.completed_at - agent_run.started_at).total_seconds() * 1000
    )
    agent_run.total_input_tokens = total_input_tokens
    agent_run.total_output_tokens = total_output_tokens
    agent_run.estimated_cost_usd = estimate_cost_usd(total_input_tokens, total_output_tokens)

    # Auto-title new conversations from the first question
    conversation = await db.get(Conversation, conversation_id)
    if conversation and conversation.title == "New conversation":
        conversation.title = user_question[:80]

    await db.commit()

    yield {
        "type": "done",
        "message_id": str(assistant_message.id),
        "agent_run_id": str(agent_run.id),
        "review_status": review_status,
        "citations": citation_payloads,
    }
