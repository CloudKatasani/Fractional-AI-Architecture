"""Agent registry — the single source of truth for agent metadata (generates docs/AGENT_CATALOG.md)."""

from __future__ import annotations

from app.agents.application.design_review import DesignReviewAgent
from app.agents.application.drift_detector import DriftDetector
from app.agents.base import Agent
from app.agents.data_ai.ai_risk_classifier import AIRiskClassifier
from app.agents.data_ai.ai_usecase_intake import AIUseCaseIntake
from app.agents.data_ai.governance_policy_checker import GovernancePolicyChecker
from app.agents.data_ai.model_agent_registry_steward import ModelAgentRegistrySteward
from app.agents.portfolio.app_discovery import AppDiscovery
from app.agents.portfolio.business_case_builder import BusinessCaseBuilder
from app.agents.portfolio.cost_license_optimizer import CostLicenseOptimizer
from app.agents.portfolio.lifecycle_watcher import LifecycleWatcher
from app.agents.portfolio.overlap_finder import OverlapFinder
from app.agents.shared.copilot import Copilot
from app.agents.shared.evidence_audit import EvidenceAudit
from app.agents.shared.exec_briefing import ExecBriefing
from app.agents.shared.graph_curator import GraphCurator
from app.agents.shared.orchestrator import Orchestrator


class DiagramGenerator(Agent):
    id = "shared.diagram_generator"
    name = "Diagram Generator"
    domain = "shared"
    description = ("Produces Mermaid diagrams from the knowledge graph: capability map, C4-style context for an "
                   "application, data flow for a dataset, integration map for a capability.")
    inputs = ["kg_nodes", "kg_edges"]
    outputs = "Mermaid text"
    default_autonomy = 1
    demo_trigger = "Render diagram"
    runnable = False


_CLASSES: list[type[Agent]] = [
    # SaaS & cloud savings
    AppDiscovery, CostLicenseOptimizer, OverlapFinder, LifecycleWatcher, BusinessCaseBuilder,
    # AI governance & compliance
    AIUseCaseIntake, AIRiskClassifier, ModelAgentRegistrySteward, GovernancePolicyChecker,
    # Design reviews & drift
    DesignReviewAgent, DriftDetector,
    # Shared
    Orchestrator, GraphCurator, Copilot, DiagramGenerator, EvidenceAudit, ExecBriefing,
]

AGENTS: dict[str, Agent] = {cls.id: cls() for cls in _CLASSES}

DOMAIN_LABELS = {"portfolio": "SaaS & Cloud Savings", "data_ai": "AI Governance & Compliance",
                 "application": "Design Reviews & Drift", "shared": "Platform"}

# Seeded acceptance history so the Agents page can show promotion guidance (80%/4 weeks -> L2; 90%/8 weeks -> L3).
SEED_ACCEPTANCE = {
    "pf.app_discovery": (37, 41), "pf.cost_license_optimizer": (22, 27), "pf.overlap_finder": (9, 11),
    "pf.lifecycle_watcher": (18, 19), "pf.business_case_builder": (4, 5),
    "dai.governance_policy_checker": (44, 48), "dai.ai_risk_classifier": (15, 17), "dai.ai_usecase_intake": (8, 11),
    "dai.model_agent_registry_steward": (12, 14), "app.design_review": (26, 29), "app.drift_detector": (23, 25),
}


def get_agent(agent_id: str) -> Agent:
    try:
        return AGENTS[agent_id]
    except KeyError as exc:
        raise KeyError(f"unknown agent {agent_id}") from exc


def catalog_markdown() -> str:
    lines = ["# Agent Catalog", "", "Generated from `backend/app/agents/registry.py` (single source of truth). "
             "Regenerate with `make docs`.", ""]
    for dom, label in DOMAIN_LABELS.items():
        lines += [f"## {label}", "", "| id | Name | Inputs | Output | Actions | Approver | Default autonomy | Demo trigger |",
                  "|---|---|---|---|---|---|---|---|"]
        for a in AGENTS.values():
            if a.domain != dom:
                continue
            lines.append(f"| `{a.id}` | {a.name} | {', '.join(a.inputs)} | {a.outputs} | {', '.join(a.action_types) or '—'} | "
                         f"{a.approver_role or '—'} | L{a.default_autonomy} | {a.demo_trigger} |")
        lines.append("")
        for a in AGENTS.values():
            if a.domain == dom:
                lines.append(f"- **{a.name}** — {a.description}")
        lines.append("")
    return "\n".join(lines)
