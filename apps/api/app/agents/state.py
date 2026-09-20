"""
Shared state passed between every node in the agent graph.

Fields written by more than one node running in parallel (agent_outputs,
evidence, errors, step_events) use `operator.add` reducers so LangGraph can
merge concurrent branch updates instead of overwriting each other.
"""
from __future__ import annotations

import operator
from typing import Annotated, Literal, TypedDict

TaskType = Literal[
    "code_lookup",
    "documentation",
    "debugging",
    "architecture",
    "implementation_planning",
    "general",
]


class EvidenceItem(TypedDict):
    chunk_id: str
    knowledge_source_id: str
    content: str
    score: float
    source_type: str
    file_path: str | None
    language: str | None
    repository_id: str | None
    repository_full_name: str | None
    document_id: str | None
    document_name: str | None
    section_title: str | None
    symbol_name: str | None
    start_line: int | None
    end_line: int | None
    retrieved_by: str  # which agent retrieved it


class AgentOutput(TypedDict):
    agent: str
    summary: str
    evidence_chunk_ids: list[str]
    input_tokens: int
    output_tokens: int


class StepEvent(TypedDict):
    agent: str
    status: str
    duration_ms: int
    tool_calls: list[dict]
    retrieved_count: int
    input_tokens: int
    output_tokens: int
    summary: str | None
    error_message: str | None


class AgentState(TypedDict, total=False):
    # Input
    project_id: str
    conversation_id: str
    user_id: str
    question: str
    conversation_history: list[dict]  # [{"role": ..., "content": ...}], already truncated

    # Supervisor output
    task_classification: TaskType
    execution_plan: list[str]  # agent names to invoke this pass

    # Accumulated across nodes (parallel-safe via reducers)
    evidence: Annotated[list[EvidenceItem], operator.add]
    agent_outputs: Annotated[list[AgentOutput], operator.add]
    errors: Annotated[list[str], operator.add]
    step_events: Annotated[list[StepEvent], operator.add]

    # Reviewer output
    review_status: Literal["supported", "needs_more_evidence", "unsupported"]
    review_notes: str
    retry_count: int
    additional_queries: list[str]

    # Final result
    final_answer: str
    final_citations: list[EvidenceItem]
