"""
The compiled multi-agent graph.

Flow:
    START -> supervisor -> (fan-out to 0+ specialist agents chosen by the
    supervisor) -> reviewer -> [needs_more_evidence -> targeted_retrieval ->
    reviewer (bounded retries)] -> END

The graph is built once at import time and reused across requests; per-request
dependencies (db session, project_id) are injected via RunnableConfig rather
than captured in closures, so the compiled graph is safe to reuse concurrently.
"""
from langgraph.graph import END, START, StateGraph

from app.agents.nodes_core import (
    reviewer_node,
    route_after_reviewer,
    route_after_supervisor,
    supervisor_node,
    targeted_retrieval_node,
)
from app.agents.nodes_specialists import (
    architecture_node,
    code_retrieval_node,
    debugging_node,
    documentation_node,
    implementation_planning_node,
)
from app.agents.state import AgentState

SPECIALIST_NODES = {
    "code_retrieval": code_retrieval_node,
    "documentation": documentation_node,
    "debugging": debugging_node,
    "architecture": architecture_node,
    "implementation_planning": implementation_planning_node,
}


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("supervisor", supervisor_node)
    for name, node_fn in SPECIALIST_NODES.items():
        graph.add_node(name, node_fn)
    graph.add_node("reviewer", reviewer_node)
    graph.add_node("targeted_retrieval", targeted_retrieval_node)

    graph.add_edge(START, "supervisor")

    graph.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {**{name: name for name in SPECIALIST_NODES}, "reviewer": "reviewer"},
    )

    for name in SPECIALIST_NODES:
        graph.add_edge(name, "reviewer")

    graph.add_conditional_edges(
        "reviewer",
        route_after_reviewer,
        {"targeted_retrieval": "targeted_retrieval", "__end__": END},
    )
    graph.add_edge("targeted_retrieval", "reviewer")

    return graph.compile()


compiled_graph = build_graph()
