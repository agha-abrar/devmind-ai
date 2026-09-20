from __future__ import annotations

from collections.abc import AsyncIterator

from app.agents.evidence_utils import format_evidence_for_prompt
from app.agents.llm_client import ChatResult, chat_completion, chat_completion_stream
from app.agents.prompts import FINAL_SYNTHESIS_PROMPT
from app.agents.state import AgentOutput, EvidenceItem


def build_synthesis_messages(
    question: str, agent_outputs: list[AgentOutput], evidence: list[EvidenceItem]
) -> list[dict]:
    agent_summaries = "\n\n".join(f"[{o['agent']}] {o['summary']}" for o in agent_outputs)
    evidence_text = format_evidence_for_prompt(evidence)
    return [
        {"role": "system", "content": FINAL_SYNTHESIS_PROMPT},
        {
            "role": "user",
            "content": (
                f"Question: {question}\n\nSpecialist findings:\n{agent_summaries or '(none)'}\n\n"
                f"Numbered evidence (cite using these exact numbers):\n{evidence_text}"
            ),
        },
    ]


async def stream_synthesis(messages: list[dict]) -> AsyncIterator[str]:
    async for token in chat_completion_stream(messages, temperature=0.2, max_tokens=1200):
        yield token


async def synthesize_sync(messages: list[dict]) -> ChatResult:
    return await chat_completion(messages, temperature=0.2, max_tokens=1200)
