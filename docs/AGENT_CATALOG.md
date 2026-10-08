# Agent Catalog

Generated from `backend/app/agents/registry.py` (single source of truth). Regenerate with `make docs`.

## SaaS & Cloud Savings

| id | Name | Inputs | Output | Actions | Approver | Default autonomy | Demo trigger |
|---|---|---|---|---|---|---|---|
| `pf.app_discovery` | Application Discovery | sso_usage, invoice_lines, cloud_resources, cmdb_cis, applications | DiscoveryFinding | confirm_app, merge_cmdb_ci, retire_cmdb_ci, assign_owner | app_owner | L1 | Run discovery |
| `pf.cost_license_optimizer` | Cost and License Optimizer | applications, contracts, cloud_resources, invoice_lines, sso_usage | CostFinding | renegotiate_contract, cancel_renewal, tag_resources | cio | L2 | Find savings |
| `pf.overlap_finder` | Overlap Finder | applications, capabilities, repos, incidents | OverlapCluster | propose_consolidation | principal_architect | L2 | Find overlaps |
| `pf.lifecycle_watcher` | Lifecycle Watcher | applications, contracts, repos | LifecycleAlert | create_renewal_task, plan_upgrade | principal_architect | L2 | Check lifecycle |
| `pf.business_case_builder` | Rationalization Business Case Builder | applications, contracts, integrations, repos | BusinessCase | approve_business_case | cio | L2 | Build business case |

- **Application Discovery** — Reconciles SSO logs, invoices, expense reports, cloud tags and CMDB records into one application inventory; surfaces shadow IT, CMDB duplicates and stale CIs with confidence per match.
- **Cost and License Optimizer** — Computes TCO per application (contract share + tagged cloud + 15% overhead) and flags low seat utilisation, auto-renewals within 90 days, untagged cloud spend, unused apps and above-market pricing.
- **Overlap Finder** — Groups applications realising the same L2 capability (or category) with overlapping feature tags and recommends a survivor by usage, cost, technical debt and strategic fit.
- **Lifecycle Watcher** — Watches vendor end-of-support dates (12 months), contract renewals (180 days) and end-of-life frameworks; severity by days remaining and business criticality.
- **Rationalization Business Case Builder** — Builds a one-page business case for an overlap cluster or disposition set: 3-year savings, one-time migration cost, payback, simple NPV, risks and a timeline.

## AI Governance & Compliance

| id | Name | Inputs | Output | Actions | Approver | Default autonomy | Demo trigger |
|---|---|---|---|---|---|---|---|
| `dai.ai_usecase_intake` | AI Use-Case Intake | ai_usecases, datasets | UseCaseScore | prioritize_usecase | principal_architect | L2 | Rank backlog |
| `dai.ai_risk_classifier` | AI Risk Classifier | ai_usecases, datasets | RiskClassification | set_risk_tier | risk_officer | L2 | Classify risk |
| `dai.model_agent_registry_steward` | Model and Agent Registry Steward | ai_assets, ai_usecases, invoice_lines | RegistryFinding | register_asset, require_eval, suspend_asset | risk_officer | L2 | Audit AI registry |
| `dai.governance_policy_checker` | Governance Policy Checker | datasets, pipelines, bi_assets, data_policies, ai_assets, ai_usecases | PolicyFinding | apply_masking, set_retention, assign_owner, block_pipeline | data_governance_lead | L2 | Check policies |

- **AI Use-Case Intake** — Scores AI use cases on value (estimate, sponsor priority) and feasibility (data exists, quality, ownership, pattern maturity), checks data readiness and ranks the backlog.
- **AI Risk Classifier** — Tiers AI use cases (unacceptable / high / limited / minimal) with EU AI Act-style rules; lists the triggering rule ids, required controls and documentation. Unacceptable use cases are blocked.
- **Model and Agent Registry Steward** — Inventories AI assets; flags unregistered (shadow) AI, missing evaluation, unknown training data, unapproved vendors and expense-paid tools; computes AI spend by department.
- **Governance Policy Checker** — Evaluates data policy predicates: PII without retention, retention over/under policy, restricted data in non-production, BI reading PII directly, datasets without owner, residency, PCI scope, CPNI use.

## Design Reviews & Drift

| id | Name | Inputs | Output | Actions | Approver | Default autonomy | Demo trigger |
|---|---|---|---|---|---|---|---|
| `app.design_review` | Design Review Agent | design_docs, standards, apis | DesignReview | publish_review, request_exception | tech_lead | L2 | Review design |
| `app.drift_detector` | Drift Detector | repos, integrations, applications | DriftFinding | create_remediation_ticket, approve_exception | security_architect | L3 | Detect drift |

- **Design Review Agent** — Checks design submissions against architecture standards (integration, data classification, approved GenAI platforms, NFRs, boundary rules); every concern maps to a standard id; suggests APIs to reuse.
- **Drift Detector** — Compares declared vs runtime dependencies from repositories, finds unapproved integrations and direct DB links across restricted boundaries (IT/OT, BSS/OSS); renders intended vs actual diagrams.

## Platform

| id | Name | Inputs | Output | Actions | Approver | Default autonomy | Demo trigger |
|---|---|---|---|---|---|---|---|
| `shared.orchestrator` | Orchestrator | agent registry | Combined AgentOutputs | — | — | L2 | Ask the office |
| `shared.graph_curator` | Knowledge Graph Curator | approvals, kg_nodes, kg_edges | graph updates | — | — | L3 | Runs after every decision |
| `shared.copilot` | Architecture Copilot | kg_nodes, kg_edges, standards, patterns | Answer with citations | — | — | L1 | Ask a question |
| `shared.diagram_generator` | Diagram Generator | kg_nodes, kg_edges | Mermaid text | — | — | L1 | Render diagram |
| `shared.evidence_audit` | Evidence and Audit Agent | data_policies, agent_runs, approvals, audit_events, ai_usecases, applications | EvidenceItem | — | — | L1 | Generate evidence pack |
| `shared.exec_briefing` | Executive Briefing Agent | metrics, approvals, agent_runs | BriefingPoint | — | — | L1 | Generate briefing |

- **Orchestrator** — Routes a natural-language request or UI trigger to one or more agents, merges their outputs, creates approvals and enforces autonomy gating.
- **Knowledge Graph Curator** — Applies approved actions to the knowledge graph, resolves conflicts by confidence, recomputes derived properties and (at autonomy L3) executes simulated side effects such as tickets and ADR publication.
- **Architecture Copilot** — Answers questions over the knowledge graph (owners, dependencies, costs, lineage, policies, patterns) with cited record ids and optional diagrams.
- **Diagram Generator** — Produces Mermaid diagrams from the knowledge graph: capability map, C4-style context for an application, data flow for a dataset, integration map for a capability.
- **Evidence and Audit Agent** — Assembles an evidence pack for a regulation or policy: applicable controls, current findings, approvals with timestamps and approvers; exports markdown and JSON.
- **Executive Briefing Agent** — Writes the monthly executive summary: inventory accuracy, savings identified / approved / realised, AI use cases by tier, design review SLA, return on subscription, upcoming renewals and the top decisions needed.
