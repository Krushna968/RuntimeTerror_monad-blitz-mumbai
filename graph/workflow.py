"""
graph/workflow.py
--------------------
Builds and compiles the LangGraph workflow that wires together all
four agents:

START -> certificate_detection_node -> decomposition_node
      -> authentication_node -> explainability_node -> END

If Agent 1 decides the document is NOT a certificate, the graph
short-circuits straight to END to avoid wasting LLM calls on
agents 2-4.
"""

from langgraph.graph import StateGraph, START, END

from graph.state import CertificateState
from agents.certificate_detector import CertificateDetectorAgent
from agents.decomposition_agent import CertificateDecompositionAgent
from agents.authentication_agent import AuthenticationAgent
from agents.explainability_agent import ExplainabilityAgent

# Instantiate agents once (they hold a reusable LLM client)
detector_agent = CertificateDetectorAgent()
decomposition_agent = CertificateDecompositionAgent()
authentication_agent = AuthenticationAgent()
explainability_agent = ExplainabilityAgent()


def certificate_detection_node(state: CertificateState) -> CertificateState:
    result = detector_agent.run(state["raw_text"])
    state["detection_result"] = result
    state["stopped_early"] = not result.get("is_certificate", False)
    return state


def decomposition_node(state: CertificateState) -> CertificateState:
    result = decomposition_agent.run(state["raw_text"], state.get("qr_data", []))
    state["extracted_data"] = result
    return state


def authentication_node(state: CertificateState) -> CertificateState:
    result = authentication_agent.run(state["extracted_data"])
    state["auth_result"] = result
    return state


def explainability_node(state: CertificateState) -> CertificateState:
    report = explainability_agent.run(state["extracted_data"], state["auth_result"])
    state["explanation"] = report
    return state


def _route_after_detection(state: CertificateState) -> str:
    """Conditional edge: skip straight to END if it's not a certificate."""
    if state.get("stopped_early"):
        return "end"
    return "continue"


def build_graph():
    """Builds and compiles the CertiChain AI LangGraph workflow."""
    workflow = StateGraph(CertificateState)

    workflow.add_node("certificate_detection_node", certificate_detection_node)
    workflow.add_node("decomposition_node", decomposition_node)
    workflow.add_node("authentication_node", authentication_node)
    workflow.add_node("explainability_node", explainability_node)

    workflow.add_edge(START, "certificate_detection_node")

    workflow.add_conditional_edges(
        "certificate_detection_node",
        _route_after_detection,
        {
            "continue": "decomposition_node",
            "end": END,
        },
    )

    workflow.add_edge("decomposition_node", "authentication_node")
    workflow.add_edge("authentication_node", "explainability_node")
    workflow.add_edge("explainability_node", END)

    return workflow.compile()
