from __future__ import annotations

import json
import time

from langchain_core.runnables import RunnableConfig

from app.agents.evidence_utils import (
    chunk_to_evidence_item,
    dedupe_evidence,
    format_evidence_for_prompt,
)
from app.agents.llm_client import LLMProviderError, chat_completion
from app.agents.prompts import REVIEWER_PROMPT, SUPERVISOR_PROMPT
from app.agents.state import AgentState
from app.agents.tools import search_all
from app.core.logging import get_logger

logger = get_logger(__name__)

VALID_AGENTS = {
    "code_retrieval",
    "documentation",
    "debugging",
    "architecture",
    "implementation_planning",
}
MAX_REVIEW_RETRIES = 2


def _extract_json(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.removeprefix("json").strip()
    return json.loads(cleaned)


async def supervisor_node(state: AgentState, config: RunnableConfig) -> dict:
    start = time.perf_counter()
    question = state["question"]
    history = state.get("conversation_history", [])

    history_text = ""
    if history:
        history_text = "\n".join(f"{m['role']}: {m['content']}" for m in history[-6:])

    messages = [
        {"role": "system", "content": SUPERVISOR_PROMPT},
        {
            "role": "user",
            "content": f"Recent conversation:\n{history_text}\n\nCurrent question: {question}",
        },
    ]

    try:
        result = await chat_completion(messages, temperature=0.0, max_tokens=300)
        parsed = _extract_json(result.content)
        task_classification = parsed.get("task_classification", "general")
        agents = [a for a in parsed.get("agents", []) if a in VALID_AGENTS]
        if not agents and task_classification != "general":
            agents = ["code_retrieval"]
        input_tokens, output_tokens = result.input_tokens, result.output_tokens
    except (LLMProviderError, json.JSONDecodeError, KeyError) as exc:
        logger.warning("supervisor_parse_failed_using_default_plan", error=str(exc))
        task_classification = "code_lookup"
        agents = ["code_retrieval"]
        input_tokens = output_tokens = 0

    duration_ms = int((time.perf_counter() - start) * 1000)

    return {
        "task_classification": task_classification,
        "execution_plan": agents,
        "retry_count": 0,
        "step_events": [
            {
                "agent": "supervisor",
                "status": "completed",
                "duration_ms": duration_ms,
                "tool_calls": [],
                "retrieved_count": 0,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "summary": f"Classified as '{task_classification}', routing to: {', '.join(agents) or 'none'}",
                "error_message": None,
            }
        ],
    }


def route_after_supervisor(state: AgentState) -> list[str]:
    plan = state.get("execution_plan") or []
    if not plan:
        # Nothing specialized needed (e.g. small talk) — go straight to reviewer,
        # which will produce a direct, low-evidence-aware response.
        return ["reviewer"]
    return plan


async def targeted_retrieval_node(state: AgentState, config: RunnableConfig) -> dict:
    start = time.perf_counter()
    db = config["configurable"]["db"]
    project_id = config["configurable"]["project_id"]
    queries = state.get("additional_queries") or [state["question"]]

    new_evidence = []
    tool_calls = []
    for query in queries:
        chunks = await search_all(db, project_id, query, top_k=6)
        tool_calls.append({"tool": "search_all", "query": query, "results": len(chunks)})
        new_evidence.extend(chunk_to_evidence_item(c, retrieved_by="targeted_retrieval") for c in chunks)

    duration_ms = int((time.perf_counter() - start) * 1000)

    return {
        "evidence": new_evidence,
        "step_events": [
            {
                "agent": "reviewer",
                "status": "completed",
                "duration_ms": duration_ms,
                "tool_calls": tool_calls,
                "retrieved_count": len(new_evidence),
                "input_tokens": 0,
                "output_tokens": 0,
                "summary": f"Targeted retrieval for {len(queries)} follow-up quer{'y' if len(queries)==1 else 'ies'}",
                "error_message": None,
            }
        ],
    }


NO_EVIDENCE_MESSAGE = (
    "I couldn't find enough evidence in the indexed repository or documents to answer this "
    "reliably. Try indexing the relevant repository/documentation, or rephrase the question "
    "with more specific terms (a file name, function name, or error message)."
)


async def reviewer_node(state: AgentState, config: RunnableConfig) -> dict:
    start = time.perf_counter()
    question = state["question"]
    evidence = dedupe_evidence(state.get("evidence", []))
    agent_outputs = state.get("agent_outputs", [])
    retry_count = state.get("retry_count", 0)

    if not evidence:
        duration_ms = int((time.perf_counter() - start) * 1000)
        return {
            "review_status": "unsupported",
            "review_notes": "No evidence was retrieved for this question.",
            "final_answer": NO_EVIDENCE_MESSAGE,
            "final_citations": [],
            "step_events": [
                {
                    "agent": "reviewer",
                    "status": "completed",
                    "duration_ms": duration_ms,
                    "tool_calls": [],
                    "retrieved_count": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "summary": "No evidence retrieved; returned low-evidence response.",
                    "error_message": None,
                }
            ],
        }

    agent_summaries = "\n\n".join(f"[{o['agent']}] {o['summary']}" for o in agent_outputs)
    evidence_text = format_evidence_for_prompt(evidence)

    messages = [
        {"role": "system", "content": REVIEWER_PROMPT},
        {
            "role": "user",
            "content": (
                f"Question: {question}\n\nSpecialist findings:\n{agent_summaries or '(none)'}\n\n"
                f"Evidence:\n{evidence_text}"
            ),
        },
    ]

    input_tokens = output_tokens = 0
    try:
        result = await chat_completion(messages, temperature=0.0, max_tokens=400)
        parsed = _extract_json(result.content)
        review_status = parsed.get("review_status", "supported")
        notes = parsed.get("notes", "")
        additional_queries = parsed.get("additional_queries", [])
        input_tokens, output_tokens = result.input_tokens, result.output_tokens
    except (LLMProviderError, json.JSONDecodeError, KeyError) as exc:
        logger.warning("reviewer_parse_failed_defaulting_to_supported", error=str(exc))
        review_status, notes, additional_queries = "supported", "", []

    if review_status == "needs_more_evidence" and retry_count >= MAX_REVIEW_RETRIES:
        review_status = "unsupported"
        notes = (notes + " (retry limit reached)").strip()

    duration_ms = int((time.perf_counter() - start) * 1000)
    base_step_event = {
        "agent": "reviewer",
        "status": "completed",
        "duration_ms": duration_ms,
        "tool_calls": [],
        "retrieved_count": len(evidence),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "error_message": None,
    }

    if review_status == "needs_more_evidence":
        return {
            "review_status": review_status,
            "review_notes": notes,
            "additional_queries": additional_queries or [question],
            "retry_count": retry_count + 1,
            "step_events": [{**base_step_event, "summary": f"Needs more evidence: {notes}"}],
        }

    if review_status == "unsupported":
        return {
            "review_status": review_status,
            "review_notes": notes,
            "final_answer": NO_EVIDENCE_MESSAGE,
            "final_citations": [],
            "step_events": [{**base_step_event, "summary": f"Unsupported: {notes}"}],
        }

    # supported — final answer text is streamed separately by the runner
    # (see app/agents/synthesis.py) so the user-visible generation is real
    # token-level streaming, not a simulated replay of an already-complete string.
    return {
        "review_status": review_status,
        "review_notes": notes,
        "final_citations": evidence,
        "step_events": [{**base_step_event, "summary": "Approved grounded evidence for synthesis."}],
    }


def route_after_reviewer(state: AgentState) -> str:
    if state.get("review_status") == "needs_more_evidence":
        return "targeted_retrieval"
    return "__end__"
