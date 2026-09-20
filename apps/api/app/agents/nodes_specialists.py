from __future__ import annotations

import time

from langchain_core.runnables import RunnableConfig

from app.agents.evidence_utils import chunk_to_evidence_item, format_evidence_for_prompt
from app.agents.llm_client import LLMProviderError, chat_completion
from app.agents.prompts import (
    ARCHITECTURE_PROMPT,
    CODE_RETRIEVAL_PROMPT,
    DEBUGGING_PROMPT,
    DOCUMENTATION_PROMPT,
    IMPLEMENTATION_PLANNING_PROMPT,
)
from app.agents.state import AgentState
from app.agents.tools import search_all, search_code, search_documents
from app.core.logging import get_logger

logger = get_logger(__name__)


async def _run_specialist(
    state: AgentState,
    config: RunnableConfig,
    agent_name: str,
    system_prompt: str,
    search_kind: str,
) -> dict:
    start = time.perf_counter()
    db = config["configurable"]["db"]
    project_id = config["configurable"]["project_id"]
    question = state["question"]

    tool_calls: list[dict] = []
    try:
        if search_kind == "code":
            chunks = await search_code(db, project_id, question)
            tool_calls.append({"tool": "search_code", "query": question, "results": len(chunks)})
        elif search_kind == "documents":
            chunks = await search_documents(db, project_id, question)
            tool_calls.append({"tool": "search_documents", "query": question, "results": len(chunks)})
        else:
            chunks = await search_all(db, project_id, question)
            tool_calls.append({"tool": "search_all", "query": question, "results": len(chunks)})

        evidence_items = [chunk_to_evidence_item(c, retrieved_by=agent_name) for c in chunks]
        evidence_text = format_evidence_for_prompt(evidence_items)

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Question: {question}\n\nRetrieved evidence:\n{evidence_text}",
            },
        ]
        result = await chat_completion(messages, temperature=0.1, max_tokens=700)

        duration_ms = int((time.perf_counter() - start) * 1000)
        return {
            "evidence": evidence_items,
            "agent_outputs": [
                {
                    "agent": agent_name,
                    "summary": result.content,
                    "evidence_chunk_ids": [e["chunk_id"] for e in evidence_items],
                    "input_tokens": result.input_tokens,
                    "output_tokens": result.output_tokens,
                }
            ],
            "step_events": [
                {
                    "agent": agent_name,
                    "status": "completed",
                    "duration_ms": duration_ms,
                    "tool_calls": tool_calls,
                    "retrieved_count": len(evidence_items),
                    "input_tokens": result.input_tokens,
                    "output_tokens": result.output_tokens,
                    "summary": result.content[:280],
                    "error_message": None,
                }
            ],
        }

    except LLMProviderError as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.error("specialist_agent_failed", agent=agent_name, error=str(exc))
        return {
            "errors": [f"{agent_name}: {exc}"],
            "step_events": [
                {
                    "agent": agent_name,
                    "status": "failed",
                    "duration_ms": duration_ms,
                    "tool_calls": tool_calls,
                    "retrieved_count": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "summary": None,
                    "error_message": str(exc),
                }
            ],
        }


async def code_retrieval_node(state: AgentState, config: RunnableConfig) -> dict:
    return await _run_specialist(state, config, "code_retrieval", CODE_RETRIEVAL_PROMPT, "code")


async def documentation_node(state: AgentState, config: RunnableConfig) -> dict:
    return await _run_specialist(state, config, "documentation", DOCUMENTATION_PROMPT, "documents")


async def debugging_node(state: AgentState, config: RunnableConfig) -> dict:
    return await _run_specialist(state, config, "debugging", DEBUGGING_PROMPT, "all")


async def architecture_node(state: AgentState, config: RunnableConfig) -> dict:
    return await _run_specialist(state, config, "architecture", ARCHITECTURE_PROMPT, "all")


async def implementation_planning_node(state: AgentState, config: RunnableConfig) -> dict:
    return await _run_specialist(
        state, config, "implementation_planning", IMPLEMENTATION_PLANNING_PROMPT, "all"
    )
