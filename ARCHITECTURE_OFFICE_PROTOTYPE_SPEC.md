# Fractional AI Architecture Office — Prototype Specification

**Audience:** Claude Code (implementing agent)
**Goal:** Build a runnable, demo-grade prototype that shows an end client how AI agents plus a human decision gate deliver Enterprise, Application, Portfolio, and Data & AI Architecture as a service. Two synthetic tenants: a **Utilities** company and a **Telecom** company.
**Status:** v1.0 — build spec. Everything in this file is in scope unless marked *stretch*.

---

## 0. How to read and execute this spec

1. Read Sections 1–3 fully before writing code (purpose, principles, stack).
2. Build in the phase order in Section 14. Each phase ends with its acceptance checks passing.
3. The demo must run **offline** with `LLM_MODE=mock` (deterministic, no API key) and **live** with `LLM_MODE=live` (Anthropic API). Mock mode is the default and is what the client demo uses unless told otherwise.
4. Every fact an agent shows must cite a source record id from the synthetic data. No uncited facts in agent output. This is a hard requirement, enforced by schema validation.
5. Nothing becomes "official" (an approved disposition, a published ADR, a risk tier) without a human approval recorded in the audit log. Agents only write to **draft** state.
6. When something in this spec is ambiguous, prefer the simplest implementation that keeps the demo story intact (Section 11), and record the decision in `docs/DECISIONS.md`.

---

## 1. Purpose and demo narrative

The client should walk away understanding four things:

1. **Architecture knowledge is scattered; agents can assemble it.** From logs, invoices, repos, catalogs and documents, agents build one living knowledge graph in hours.
2. **Agents propose, humans decide.** Every recommendation lands in an approval inbox with evidence; a principal architect or business owner approves, edits or rejects.
3. **Outcomes are measurable.** Savings identified, AI use cases risk-tiered, design reviews turned around, inventory accuracy — all visible on a dashboard.
4. **It works on their industry.** Utilities and Telecom data look real: SCADA, AMI, outage management, BSS/OSS, 5G core, network inventory.

The 15-minute demo script (Section 11) walks one scenario per architecture domain, switching tenants to show the same agents on different industries.

---

## 2. Design principles (binding)

| # | Principle | Implementation consequence |
|---|---|---|
| P1 | Grounded | Every agent output field that states a fact carries `source_refs: [record_id...]`. Outputs without refs fail validation and are retried once, then flagged. |
| P2 | Draft-first | Agents write `status=draft`. Only `POST /approvals/{id}/decide` by a human moves anything to `approved`/`rejected`. |
| P3 | Auditable | Every agent run and human decision writes an `audit_event`. The Audit screen reads only from this table. |
| P4 | Deterministic in mock mode | Same seed → same data → same agent outputs. Mock agents are rule-based or template-based over the data, not random. |
| P5 | Tenant-isolated | All queries filter by `tenant_id`. Switching tenant in the UI changes everything. |
| P6 | Autonomy levels | Each agent has a per-tenant `autonomy_level` (L1–L4, Section 8.4). Prototype enforces L1–L3; L4 is display-only. |
| P7 | Simple over clever | Monorepo, one `make demo` command, SQLite, no Kubernetes, no message bus. |

---

## 3. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Language | Python 3.12 (backend, agents, data gen); TypeScript (frontend) | |
| Backend API | FastAPI + Pydantic v2 | OpenAPI docs at `/docs` |
| Database | SQLite via SQLAlchemy 2.x | File `data/{tenant}.db`; one DB per tenant. DuckDB *stretch* for analytics. |
| Graph | Relational tables `kg_nodes`, `kg_edges` (Section 6). NetworkX in-memory for traversal. | No Neo4j. |
| LLM | `anthropic` Python SDK; model from env `ANTHROPIC_MODEL` (default `claude-sonnet-4-5`) | Abstracted behind `llm/client.py` with `MockLLM` and `AnthropicLLM`. |
| Agent framework | Hand-rolled: `agents/base.py` (`Agent` class with `run(context) -> AgentOutput`), `orchestrator/` for routing | No LangChain/LangGraph. |
| Frontend | React 18 + Vite + TypeScript + Tailwind; charts with Recharts; graph view with `react-force-graph-2d` | Served by Vite dev server in demo; built static for `make demo`. |
| Synthetic data | Python `faker` + hand-authored industry catalogs in `data_gen/catalogs/*.yaml` | Seeded (`SEED=42`). |
| Tests | pytest (backend, agents, data), Playwright *stretch* (UI smoke) | |
| Packaging | `Makefile`, `docker-compose.yml` (optional), `.env.example` | |

### 3.1 Repository layout

```
arch-office/
├── README.md
├── Makefile                      # make setup | data | api | ui | demo | test | reset
├── .env.example                  # LLM_MODE=mock, ANTHROPIC_API_KEY=, ANTHROPIC_MODEL=, SEED=42
├── docs/
│   ├── DEMO_SCRIPT.md            # generated from Section 11
│   ├── DECISIONS.md              # implementation decisions log
│   └── AGENT_CATALOG.md          # generated from agent registry
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app, routers, CORS
│   │   ├── config.py
│   │   ├── db/                   # engine, session, models.py, migrations (alembic optional)
│   │   ├── schemas/              # Pydantic request/response models
│   │   ├── routers/              # tenants, kg, portfolio, ai_gov, app_arch, ea, approvals, audit, copilot, metrics, agents
│   │   ├── services/             # business logic per domain
│   │   ├── kg/                   # graph build, queries, lineage, impact
│   │   ├── agents/
│   │   │   ├── base.py           # Agent, AgentOutput, Evidence, validation
│   │   │   ├── registry.py       # all agents, metadata, autonomy defaults
│   │   │   ├── shared/           # orchestrator, graph_curator, copilot, diagram_generator, evidence_audit, exec_briefing
│   │   │   ├── enterprise/       # strategy_capability_mapper, capability_curator, investment_traceability, roadmap_drafter, impact_analyst, board_assistant
│   │   │   ├── application/      # design_review, adr_writer, pattern_advisor, drift_detector, integration_api_architect, tech_debt_radar, threat_model_assistant
│   │   │   ├── portfolio/        # app_discovery, cost_license_optimizer, overlap_finder, time_classifier, lifecycle_watcher, business_case_builder
│   │   │   └── data_ai/          # lineage_mapper, data_product_designer, governance_policy_checker, ai_usecase_intake, ai_risk_classifier, ai_ref_arch_generator, model_agent_registry_steward
│   │   ├── llm/                  # client.py (MockLLM, AnthropicLLM), prompts/*.md, mock_responses/
│   │   └── orchestrator/         # router.py, approval_gate.py, scheduler.py (manual trigger only)
│   └── tests/
├── data_gen/
│   ├── generate.py               # python -m data_gen.generate --tenant utilities --seed 42
│   ├── catalogs/
│   │   ├── utilities.yaml        # industry catalog: capabilities, apps, vendors, APIs, data domains, AI use cases, policies
│   │   └── telecom.yaml
│   ├── generators/               # one module per entity type
│   └── README.md                 # data model and volumes
├── frontend/
│   ├── src/
│   │   ├── pages/                # Dashboard, Portfolio, AIGovernance, AppArchitecture, EnterpriseArchitecture, Copilot, Approvals, Audit, GraphExplorer, Agents
│   │   ├── components/
│   │   ├── api/                  # typed client generated from OpenAPI (openapi-typescript)
│   │   └── state/                # tenant context, auth-less "current user" selector
│   └── index.html
└── data/                         # generated .db files (gitignored), fixtures/ (checked in small samples)
```

---

## 4. Tenants, users and roles

Two tenants, seeded by `data_gen`:

| tenant_id | Name | Industry | Employees | IT spend (USD/yr) | Notes |
|---|---|---|---|---|---|
| `northgrid` | NorthGrid Energy | Electric and gas utility, 2.1M customers, regulated | 4,800 | 95M | Mix of on-prem OT and cloud IT; NERC CIP applies to OT; SAP IS-U for billing |
| `meridian` | Meridian Telecom | Mobile + fixed broadband operator, 6M subscribers | 7,200 | 160M | BSS/OSS estate with heavy vendor lock-in; 5G rollout; GDPR-like privacy law applies |

No authentication. A **"Acting as"** dropdown in the UI selects the current user, which determines what approvals they can make:

| Role | Can approve |
|---|---|
| `principal_architect` (our side) | Everything except budget and AI risk sign-off |
| `cio` | Business cases, roadmaps, investment alignment |
| `app_owner` (several per tenant) | Inventory entries and dispositions for their apps |
| `security_architect` | Threat models, drift exceptions |
| `data_governance_lead` | Governance findings, data contracts |
| `risk_officer` | AI risk tiers |
| `tech_lead` | ADRs, design review exceptions |

Users table: `users(id, tenant_id, name, role, email)`; seed 8–12 per tenant with industry-appropriate titles (e.g., "Director, Grid Operations Technology"; "Head of BSS Platforms").

---

## 5. Synthetic data

### 5.1 Entities and volumes

All tables carry `id` (string, prefixed, e.g. `APP-0042`), `tenant_id`, `source_system`, `created_at`. Volumes per tenant:

| Entity | Table | Volume | Key fields |
|---|---|---|---|
| Business capabilities | `capabilities` | 60–80 (3 levels) | name, level, parent_id, strategic_importance (1–5), maturity (1–5), owner_user_id |
| Strategy documents | `strategy_docs` | 6–8 | title, type (strategy, OKR, board_paper, regulatory_mandate), body_md (300–800 words, industry-specific), year |
| Strategic goals | `goals` | 10–14 | statement, source_doc_id, horizon_year, kpi |
| Applications | `applications` | 180 (utilities) / 240 (telecom) | name, vendor, category, hosting (on_prem, saas, iaas, paas), criticality (1–4), owner_user_id, capability_ids[], lifecycle_status, in_cmdb (bool), discovered_via[] (sso, invoice, cloud, cmdb), tech_stack[], annual_cost_usd, user_count_90d, last_login_days, version, vendor_eos_date, contract_renewal_date, data_classification (public, internal, confidential, restricted), ot_system (bool, utilities), regulatory_scope[] |
| Vendor contracts | `contracts` | 120–160 | vendor, app_ids[], annual_value_usd, licensed_seats, renewal_date, auto_renew, term_months |
| Invoice lines | `invoice_lines` | 1,500–2,500 (24 months) | vendor, amount_usd, invoice_date, cost_center, matched_app_id (nullable → shadow IT candidates) |
| SSO login events (aggregated) | `sso_usage` | one row per app per month, 24 months | app_name_raw (sometimes inconsistent spelling), unique_users, logins |
| Cloud resources | `cloud_resources` | 400–700 | provider (aws, azure), account, resource_type, tags{app, env, owner}, monthly_cost_usd, utilization_pct, untagged (bool) |
| CMDB CIs | `cmdb_cis` | 60–70% of apps, with 10% stale/duplicate names | ci_name, ci_type, app_id (nullable), last_updated |
| APIs | `apis` | 90–140 | name, owner_app_id, style (rest, soap, graphql, event), consumers[], spec_url, duplicate_group (nullable), auth (oauth2, apikey, none, mtls) |
| Integrations | `integrations` | 250–400 | from_app_id, to_app_id, pattern (api, file, db_link, event, manual), frequency, approved (bool), data_classification |
| Code repositories | `repos` | 80–120 | name, app_id, language, framework, framework_version, eol (bool), last_commit_days, open_critical_vulns, has_iac, declared_dependencies[] (app_ids), actual_dependencies[] (app_ids; differs from declared in ~20% → drift) |
| Incidents | `incidents` | 300–500 (24 months) | app_id, severity (1–4), date, root_cause_category, minutes_to_resolve |
| Projects / epics | `projects` | 40–60 | name, budget_usd, status, capability_ids[], goal_ids[] (empty for ~25% → orphan spend), app_ids[], start, end |
| Design submissions | `design_docs` | 12–16 | title, team, body_md (describes a proposed design; several deliberately violate standards), submitted_at, status |
| Architecture standards | `standards` | 25–35 | id (e.g. STD-API-01), title, rule_text, domain, severity |
| Reference patterns | `patterns` | 10–12 | name, when_to_use, components[], diagram_mermaid, standard_ids[] |
| Existing ADRs | `adrs` | 15–25 | title, status, context, decision, consequences, app_ids[], date |
| Data domains and datasets | `datasets` | 120–160 | name, domain, owner_user_id, classification, system_app_id, pii (bool), retention_days, quality_score, has_contract (bool) |
| Pipelines / transformations | `pipelines` | 150–220 | name, tool (dbt, informatica, airflow, ssis, spark), inputs[] (dataset_ids), outputs[] (dataset_ids), owner, schedule |
| BI assets | `bi_assets` | 60–90 | name, tool, dataset_ids[], consumers (department), last_viewed_days |
| Data policies | `data_policies` | 12–18 | id (POL-xx), rule (machine-checkable predicate description), regulation (e.g. NERC CIP, state PUC privacy rule, telecom privacy law, SOX), severity |
| AI use cases | `ai_usecases` | 18 (utilities) / 24 (telecom) | title, sponsor_dept, description, status (idea, pilot, production), dataset_ids[], value_estimate_usd, feasibility_notes, uses_personal_data, affects_individuals (bool), safety_relevant (bool), automated_decision (bool), pattern (rag, agent_tools, fine_tune, classic_ml, vision) |
| AI assets (models, prompts, agents in use) | `ai_assets` | 20–35 | name, type (model, prompt_app, agent, vendor_copilot), owner, vendor, data_used[] (dataset_ids), eval_status, monthly_cost_usd, registered (bool; ~40% unregistered = shadow AI), usecase_id (nullable) |
| Meeting notes / Slack threads | `discussions` | 20–30 | channel, participants, body_md (design debates that ADR Writer turns into ADRs) |

### 5.2 Industry catalogs (hand-authored, in YAML)

`data_gen/catalogs/utilities.yaml` must include at least:

- **Capabilities (L1):** Generation Management, Transmission & Distribution Operations, Grid Modernization, Asset Management, Outage Management, Metering & Meter Data, Customer Service & Billing, Energy Trading & Settlement, Regulatory Compliance & Reporting, Field Workforce Management, Vegetation Management, Safety & Environmental, Corporate (Finance, HR, Procurement), Enterprise Data & Analytics, Cybersecurity (IT/OT).
- **Applications (realistic names, generic vendors):** SCADA/EMS (e.g. "GridView EMS"), ADMS/DMS, Outage Management System, AMI head-end, Meter Data Management, Customer Information System (SAP IS-U style), GIS (Esri-style), Work and Asset Management (Maximo-style), Mobile Workforce, Demand Response platform, DER Management, Energy Trading & Risk, Settlement, Vegetation management analytics, Drone inspection platform, Rate case modeling, Regulatory filing, Customer portal and mobile app, IVR, CRM, Billing print, Payment gateway, Data lake, EDW, BI tools (two overlapping), Document management (three overlapping), Collaboration tools (three overlapping), HRIS, ERP, Procurement, Identity, SIEM, OT network monitoring. Include 10–15 **shadow IT** SaaS tools found only in invoices/SSO (e.g. survey tool, two project-tracking tools, a GenAI vendor copilot).
- **Overlap clusters to plant:** 3 document management, 3 collaboration/chat, 2 BI, 2 project tracking, 2 GIS viewers, 2 field inspection apps.
- **Lifecycle traps to plant:** 4–6 apps with `vendor_eos_date` within 9 months; 3 contracts auto-renewing within 90 days with < 30% seat utilization.
- **AI use cases:** outage prediction from weather and asset data, vegetation encroachment detection from imagery, predictive transformer failure, call-center agent assist, customer bill explanation chatbot, wildfire risk scoring, DER forecasting, meter anomaly / theft detection, field crew dispatch optimization, regulatory filing drafting, safety incident report summarization, GenAI knowledge assistant for grid operators (safety-relevant), dynamic pricing recommendation (automated decision affecting customers), drone image defect classification, storm damage assessment, HR resume screening (affects individuals), procurement contract analysis, energy trading signal model.
- **Policies / regulations:** NERC CIP (OT asset access and change control), state PUC customer data privacy rule, SOX for billing and ERP, data retention for meter data (7 years), PII masking in non-production, model risk standard for customer-facing AI.
- **Strategy docs:** "Grid Modernization 2030", "Wildfire Mitigation Plan", "Customer Experience Transformation", "Decarbonization and DER Integration", annual OKRs, board paper on AI adoption, regulatory mandate on data access for customers.
- **Standards:** API-first for customer channels; no direct DB links across OT/IT boundary; event streaming for meter data; cloud tagging mandatory; approved IAM; data classification required before integration; OT systems isolated per NERC CIP; approved GenAI platform list.

`data_gen/catalogs/telecom.yaml` must include at least:

- **Capabilities (L1):** Network Planning & Build, Network Operations (RAN, Core, Transport), Service Fulfillment / Provisioning, Service Assurance, Product & Offer Management, Customer Acquisition & Sales, Customer Care, Billing & Revenue Management, Partner & Wholesale Management, Spectrum & Regulatory, Digital Channels, Enterprise (B2B) Services, Corporate, Data & Analytics, Security & Fraud.
- **Applications:** BSS suite (CRM, product catalog, order management, charging/rating, billing, collections, mediation), OSS (network inventory, service activation/provisioning, fault management, performance management, trouble ticketing), 5G core components, RAN management, transport/SDN controller, OSS/BSS integration bus, number management, SIM/eSIM management, roaming clearing, interconnect billing, fraud management, revenue assurance, digital channels (web, app, chatbot), retail POS, dealer portal, B2B quoting (CPQ), field service, data lake, EDW, BI tools (two), customer data platform, marketing automation (two overlapping), identity, SIEM, plus 12–18 shadow IT tools. Plant **two legacy billing systems** (post-merger) and **two CRMs** (consumer and B2B) as the headline overlap.
- **Lifecycle traps:** legacy mediation platform EOS in 6 months; charging system contract renewal 120 days out at 2x market price; a vendor-hosted analytics tool with 15% usage.
- **AI use cases:** churn prediction, next-best-offer (automated decision affecting individuals), network anomaly detection, RAN energy saving optimization, self-healing network actions (agentic; safety/availability relevant), customer care chatbot, agent assist, fraud detection (SIM swap, subscription fraud), credit scoring at activation (affects individuals, regulated), field tech dispatch optimization, capacity planning forecast, network digital twin, contract clause extraction for B2B, roaming cost optimization, voice-of-customer summarization, store traffic forecasting, trouble-ticket auto-triage, cell-site lease negotiation assistant, sales email generation, employee HR chatbot, legal e-discovery assistant, marketing creative generation, spectrum auction bid model, outage comms drafting.
- **Policies / regulations:** telecom customer privacy law (CPNI-like), GDPR-like data protection, lawful intercept data handling, PCI DSS for payments, number portability obligations, EU AI Act-style tiers for AI, data residency for subscriber data.
- **Strategy docs:** "5G Monetization Strategy", "BSS Consolidation Program", "Digital-First Customer Experience", "Network Autonomy Roadmap", annual OKRs, board paper on AI, regulator consultation on AI in credit decisions.
- **Standards:** TM Forum Open API alignment for BSS; event-driven integration for order-to-activate; no shared DB between BSS and OSS; API gateway mandatory for external exposure; subscriber data residency; approved cloud regions; model registry mandatory for production AI.

### 5.3 Generation rules (for realism and demo value)

- Names in `sso_usage.app_name_raw` and `invoice_lines.vendor` must contain **deliberate inconsistencies** (case, abbreviations, suffixes like "Inc", "Prod") so Application Discovery has reconciliation work to do. Keep a hidden ground-truth mapping table `gt_app_aliases` for tests.
- ~12% of applications are **not in CMDB**; ~8% of invoice vendors match **no application** (true shadow IT); ~5% of CMDB CIs are **duplicates** or **retired apps still listed**.
- Cost allocation: `annual_cost_usd` = contract share + cloud resources tagged to the app + 15% support overhead. 10–15% of cloud resources are **untagged**.
- `repos.actual_dependencies` differs from `declared_dependencies` for ~20% of repos; plant 6–10 **direct DB link** integrations that violate standards (including 2 across the IT/OT boundary for utilities and 2 BSS↔OSS shared-DB cases for telecom).
- Plant 3–4 **duplicate APIs** (same resource, different owners), e.g., two "customer lookup" APIs.
- Plant 4–6 **design_docs that violate standards** (e.g., proposes direct DB access to the billing DB; proposes an unapproved GenAI vendor; no data classification; synchronous call chain across 5 services for a real-time path).
- Datasets: ~30% contain PII; ~20% of PII datasets have **no retention set** or **retention over policy**; 3–5 pipelines move restricted data into a non-production environment (policy violation); 2 BI dashboards read PII directly.
- AI assets: ~40% **unregistered**; 2–3 vendor copilots paid via expense reports only; one production model with `eval_status=none`.
- AI use case risk tiers must spread across tiers when the classifier rules (Section 7.4) run: roughly 15% high, 35% limited, 50% minimal; at least one **unacceptable/blocked** candidate per tenant (e.g., covert employee emotion monitoring) to show a refusal.
- Projects: ~25% have no goal linkage (orphan spend); 2 strategic goals have **no funded project** (unfunded priority).
- Incidents concentrate on 8–12 apps with old frameworks to make Tech Debt Radar's correlation visible.
- All dates relative to `DEMO_TODAY` env (default: today) so "renewal in 87 days" stays true.

### 5.4 Data generation CLI

```
python -m data_gen.generate --tenant northgrid --seed 42 --out data/northgrid.db
python -m data_gen.generate --tenant meridian --seed 42 --out data/meridian.db
python -m data_gen.generate --all
```

Also emits `data/{tenant}/raw/` CSV/JSON exports per source system (sso.csv, invoices.csv, cmdb.json, cloud.json, repos.json, catalog.json, …) so the demo can show "this is what we ingested". `data_gen/README.md` documents every table and planted anomaly with counts.

---

## 6. Knowledge graph

### 6.1 Storage

```
kg_nodes(id, tenant_id, type, name, props_json, confidence (0–1), source_refs_json, created_by (agent_id|user_id), status (draft|approved|retired), updated_at)
kg_edges(id, tenant_id, type, from_id, to_id, props_json, confidence, source_refs_json, created_by, status, updated_at)
```

### 6.2 Node types

`Goal, Capability, Application, Vendor, Contract, API, Integration, Repo, CloudResource, Dataset, Pipeline, BIAsset, AIUseCase, AIAsset, Project, Standard, Pattern, ADR, Policy, Risk, Decision, Person, Team, CostCenter, Regulation`

### 6.3 Edge types

`SUPPORTS (Capability→Goal)`, `REALIZES (Application→Capability)`, `OWNS (Person→Application|Dataset|AIAsset|Capability)`, `DEPENDS_ON (Application→Application; props: declared, actual)`, `EXPOSES (Application→API)`, `CONSUMES (Application→API)`, `INTEGRATES_WITH (Application→Application; props: pattern, approved)`, `IMPLEMENTED_IN (Application→Repo)`, `RUNS_ON (Application→CloudResource)`, `LICENSED_UNDER (Application→Contract)`, `SOLD_BY (Application→Vendor)`, `PRODUCES (Pipeline→Dataset)`, `CONSUMES_DATA (Pipeline|BIAsset|AIAsset→Dataset)`, `STORED_IN (Dataset→Application)`, `USES_DATA (AIUseCase→Dataset)`, `IMPLEMENTS (AIAsset→AIUseCase)`, `FUNDS (Project→Capability)`, `TARGETS (Project→Goal)`, `CHANGES (Project→Application)`, `GOVERNED_BY (Dataset|AIUseCase|Application→Policy|Regulation|Standard)`, `VIOLATES (Integration|Design|Dataset|Pipeline→Standard|Policy)`, `DECIDED_BY (ADR→Person)`, `AFFECTS (ADR|Decision→Application|API)`, `OVERLAPS_WITH (Application→Application; props: capability_id, similarity)`, `DUPLICATES (API→API)`, `SUCCEEDS (Application→Application; for consolidation targets)`

### 6.4 Graph build

`kg/build.py` builds the graph from the raw tables deterministically (no LLM) on `make data`, then agents enrich it. `kg/queries.py` provides: `neighbors`, `lineage_upstream/downstream`, `impact(node_id, depth)`, `path(a,b)`, `subgraph_for_capability`, `orphans`, `violations`. `kg/export.py` renders Mermaid/C4-like text for the Diagram Generator.

### 6.5 Confidence and provenance

- Deterministic facts from a single system: confidence 0.9.
- Reconciled across two or more systems that agree: 0.95–1.0.
- Inferred (e.g., alias matching by fuzzy name): 0.5–0.85 with the matching method in `props_json.inference`.
- Any node/edge with confidence < 0.7 shows an amber badge in the UI and is routed to the owner for confirmation (Application Discovery flow).

---

## 7. Agents

### 7.1 Common agent contract

```python
class Evidence(BaseModel):
    record_id: str          # e.g. "INV-01822", "APP-0042", "DOC-003"
    table: str
    excerpt: str | None     # short quote or field summary

class AgentOutput(BaseModel):
    agent_id: str
    tenant_id: str
    run_id: str
    summary: str                           # 1–3 sentences, plain language
    findings: list[Finding]                # typed per agent (see below); each Finding has source_refs: list[Evidence] (min 1)
    proposed_actions: list[ProposedAction] # each creates an Approval item when the agent is at L2+
    confidence: float
    cost: LLMCost | None                   # tokens in/out, usd (None in mock mode)
    duration_ms: int

class ProposedAction(BaseModel):
    action_type: str        # e.g. "set_disposition", "publish_adr", "set_risk_tier", "retire_app", "merge_cmdb_ci", "create_ticket"
    target_id: str
    payload: dict
    rationale: str
    source_refs: list[Evidence]
    approver_role: str      # from Section 4
```

- `Agent.run(ctx)` → gathers data via `ctx.repo` (typed DB access), calls `ctx.llm` (mock or live) with a prompt from `llm/prompts/{agent_id}.md`, validates output against the agent's `Finding` schema, enforces `source_refs` non-empty, writes `agent_runs` and `audit_events`, and creates `approvals` rows for each `ProposedAction` if autonomy ≥ L2.
- In **mock mode**, each agent has a `mock_run(ctx)` that computes findings with deterministic rules over the data (these rules are also what live mode uses as "tools" before the LLM writes the narrative). The LLM in live mode adds explanation and ranks; it never invents facts beyond the tool results.
- Every agent exposes: `id, name, domain, description, inputs (tables), outputs (finding type), approver_role, default_autonomy, demo_trigger (UI button label)`. `registry.py` is the single source of truth and generates `docs/AGENT_CATALOG.md`.

### 7.2 Enterprise Architecture agents

| id | Name | Deterministic logic (mock and tool layer) | Finding schema | Proposed actions | Approver |
|---|---|---|---|---|---|
| `ea.strategy_capability_mapper` | Strategy-to-Capability Mapper | Extract goals from `strategy_docs` (mock: `goals` table seeded with doc refs; live: LLM extracts and matches to seeded goals by id). Link each goal to capabilities via keyword map in catalog. Flag goals with 0 capabilities and capabilities with importance ≥4 and maturity ≤2. | `GoalCapabilityLink{goal_id, capability_ids, strength, gap_flag}` | `link_goal_capability` | principal_architect |
| `ea.capability_curator` | Capability Map Curator | Compute capability heat map: importance × (5 − maturity); count realizing apps; flag capabilities with 0 or >6 apps. | `CapabilityAssessment{capability_id, heat_score, app_count, flags[]}` | `update_capability_scores` | principal_architect |
| `ea.investment_traceability` | Investment Traceability | For each project: linked goals/capabilities; sum budget per goal; list orphan projects (no goals) and unfunded goals (0 projects); compute % of budget aligned. | `InvestmentAlignment{goal_id?, project_ids, budget_usd, status: aligned/orphan/unfunded}` | `flag_orphan_project`, `propose_funding_review` | cio |
| `ea.roadmap_drafter` | Roadmap Drafter | Build 3 scenarios (cost-first, risk-first, speed-first) sequencing: EOS apps, consolidations from Portfolio, unfunded strategic capabilities. Each scenario: 4–6 quarters, items with dependencies. | `RoadmapScenario{name, quarters[{label, items[{title, type, ref_ids}]}], tradeoffs}` | `adopt_roadmap_scenario` | cio |
| `ea.impact_analyst` | Impact Analyst | Given a trigger (vendor exit, regulation, M&A, capability change): traverse graph depth 3; list affected capabilities, apps, datasets, AI assets, teams; estimate cost from `annual_cost_usd`. Preset triggers per tenant (Section 11). | `ImpactReport{trigger, affected{capabilities[], applications[], datasets[], ai_assets[], people[]}, est_cost_usd, hotspots[]}` | none (informational) | — |
| `ea.board_assistant` | Architecture Board Assistant | Collect pending approvals, open violations, new ADRs since last board; check each design submission against `standards` (reuse `app.design_review`); produce pack and decision log entries. | `BoardPack{agenda[], submissions[{id, principle_checks[]}], decisions_pending[]}` | `record_board_decision` | principal_architect |

### 7.3 Application Architecture agents

| id | Name | Deterministic logic | Finding schema | Proposed actions | Approver |
|---|---|---|---|---|---|
| `app.design_review` | Design Review Agent | For a `design_doc`: rule checks against `standards` (keyword/regex rules defined in catalog, e.g. "direct database" + billing → STD-INT-02 violation; vendor not in approved GenAI list → STD-AI-01; missing "classification" → STD-DATA-01; "synchronous" chain ≥4 → STD-NFR-03). Live mode: LLM reviews full text and must map every concern to a standard id. Verdict: pass / pass_with_conditions / changes_required. | `DesignReview{design_id, verdict, concerns[{standard_id, severity, excerpt, recommendation}], reuse_suggestions[api_ids]}` | `publish_review`, `request_exception` | tech_lead (exceptions: security_architect) |
| `app.adr_writer` | ADR Writer | From a `discussion`: extract context, options, decision, consequences (mock: discussion records carry hidden structured fields; live: LLM extracts). Link to apps mentioned by name. | `ADRDraft{title, context, options[], decision, consequences, app_ids, source_discussion_id}` | `publish_adr` | tech_lead |
| `app.pattern_advisor` | Pattern Advisor | Match a short feature description to `patterns` by capability/keywords and NFRs; return top 2 with the pattern's Mermaid diagram and standards; list existing APIs to reuse. | `PatternRecommendation{pattern_id, fit_score, why, starter_diagram_mermaid, reuse_api_ids}` | none | — |
| `app.drift_detector` | Drift Detector | Compare `repos.declared_dependencies` vs `actual_dependencies`; compare `integrations` not `approved`; detect `db_link` patterns across restricted boundaries (OT/IT or BSS/OSS). Render actual vs intended Mermaid. | `DriftFinding{app_id, type: undeclared_dependency/unapproved_integration/boundary_violation, details, standard_id}` | `create_remediation_ticket`, `approve_exception` | security_architect |
| `app.integration_api_architect` | Integration and API Architect | Find `duplicate_group` APIs; APIs with `auth=none` or `apikey` on confidential data; propose canonical API and consumers to migrate; draft OpenAPI stub for new requests. | `APIFinding{type: duplicate/insecure/missing_gateway, api_ids, recommendation}` | `designate_canonical_api`, `deprecate_api` | principal_architect |
| `app.tech_debt_radar` | Tech Debt Radar | Score per app: eol framework (30), framework age (0–20), critical vulns (0–25), incidents/90d weighted by severity (0–25). Rank; estimate fix effort bands (S/M/L) from repo count and LOC proxy. | `DebtItem{app_id, score, drivers[], effort_band, incident_cost_est}` | `add_to_debt_register` | tech_lead |
| `app.threat_model_assistant` | Threat Model Assistant | For a design or app: STRIDE table over components and data flows; pull data classification; mitigations mapped to standards. Mock: template filled from components. | `ThreatModel{subject_id, threats[{component, stride_category, description, likelihood, impact, mitigation, standard_id?}]}` | `publish_threat_model` | security_architect |

### 7.4 Portfolio Architecture agents

| id | Name | Deterministic logic | Finding schema | Proposed actions | Approver |
|---|---|---|---|---|---|
| `pf.app_discovery` | Application Discovery | Reconcile `sso_usage.app_name_raw`, `invoice_lines.vendor`, `cloud_resources.tags.app`, `cmdb_cis` into applications using normalization + fuzzy match (rapidfuzz, threshold 85) + alias catalog. Output: confirmed apps, new candidates (shadow IT), CMDB duplicates/stale, confidence per match. | `DiscoveryFinding{type: new_app/alias_merge/cmdb_duplicate/cmdb_stale, app_id?, raw_names[], evidence, confidence}` | `confirm_app`, `merge_cmdb_ci`, `retire_cmdb_ci`, `assign_owner` | app_owner (owner confirmation), principal_architect |
| `pf.cost_license_optimizer` | Cost and License Optimizer | Per app: TCO = contract share + tagged cloud + 15% overhead. Flags: seat utilization < 50%; auto-renew within 90 days; untagged cloud spend; apps with cost > 0 and `user_count_90d` = 0. Savings estimate per flag. | `CostFinding{app_id?, type, current_cost_usd, est_savings_usd, evidence}` | `renegotiate_contract`, `cancel_renewal`, `tag_resources` | cio (finance validates) |
| `pf.overlap_finder` | Overlap Finder | Group apps by capability + category; where ≥2 apps realize the same L2 capability with overlapping features (catalog feature tags), create clusters; propose survivor by (usage, cost, debt score, strategic fit). | `OverlapCluster{capability_id, app_ids, survivor_app_id, rationale, est_savings_usd}` | `propose_consolidation` | principal_architect → app_owner |
| `pf.time_classifier` | TIME Classifier | Business fit = f(capability importance, usage, owner survey proxy); Technical health = f(debt score, EOS, incidents). Quadrant: Tolerate/Invest/Migrate/Eliminate with thresholds in config. | `TimeDisposition{app_id, business_fit, tech_health, quadrant, rationale}` | `set_disposition` | app_owner |
| `pf.lifecycle_watcher` | Lifecycle Watcher | Apps with `vendor_eos_date` within 12 months; contracts renewing within 180 days; EOL frameworks. Severity by days remaining and criticality. | `LifecycleAlert{type, app_id/contract_id, days_remaining, severity, recommended_action}` | `create_renewal_task`, `plan_upgrade` | principal_architect |
| `pf.business_case_builder` | Rationalization Business Case Builder | For a selected cluster or disposition set: savings (3-year), one-time migration cost (effort band × rate), risk notes, timeline; NPV simple. Outputs a one-page markdown case. | `BusinessCase{title, scope_app_ids, savings_3y_usd, one_time_cost_usd, payback_months, risks[], timeline[], body_md}` | `approve_business_case` | cio |

### 7.5 Data & AI Architecture agents

| id | Name | Deterministic logic | Finding schema | Proposed actions | Approver |
|---|---|---|---|---|---|
| `dai.lineage_mapper` | Lineage Mapper | Build lineage from `pipelines` and `bi_assets`, `ai_assets`; answer "upstream of X / downstream of Y"; flag datasets consumed by AI assets that have `quality_score` < 0.6. | `LineageReport{root_id, upstream[], downstream[], quality_flags[]}` | none | — |
| `dai.data_product_designer` | Data Product Designer | Group datasets by domain; propose data products (name, owner, schema summary, SLAs, quality rules) for domains with ≥3 datasets and ≥2 consuming teams; draft data contract YAML. | `DataProductProposal{domain, dataset_ids, owner_user_id, contract_yaml, consumers[]}` | `approve_data_contract` | data_governance_lead |
| `dai.governance_policy_checker` | Governance Policy Checker | Evaluate `data_policies` predicates: PII without retention; retention > policy; restricted data in non-prod pipelines; BI assets reading PII directly; datasets without owner; subscriber data outside residency region (telecom). | `PolicyFinding{policy_id, subject_id, subject_type, severity, fix}` | `apply_masking`, `set_retention`, `assign_owner`, `block_pipeline` | data_governance_lead |
| `dai.ai_usecase_intake` | AI Use-Case Intake | Score value (value_estimate, sponsor priority) and feasibility (datasets exist, quality, owner, pattern maturity); check data readiness; rank backlog. | `UseCaseScore{usecase_id, value_score, feasibility_score, data_readiness, blockers[], rank}` | `prioritize_usecase` | principal_architect (AI steering) |
| `dai.ai_risk_classifier` | AI Risk Classifier | Rule-based tiering modeled on EU AI Act-style categories: **unacceptable** (covert biometric/emotion surveillance of employees, social scoring) → block; **high** (credit/eligibility decisions, employment screening, safety-relevant control of critical infrastructure, automated decisions with legal effect) ; **limited** (customer-facing chatbots, content generation with disclosure duty); **minimal** (internal productivity, forecasting without individual effect). Required controls per tier from catalog (e.g., human oversight, DPIA, bias testing, logging, registry entry, incident process). Live mode: LLM explains and must cite the rule ids. | `RiskClassification{usecase_id, tier, triggers[], required_controls[], documentation_checklist[]}` | `set_risk_tier` | risk_officer |
| `dai.ai_ref_arch_generator` | AI Reference Architecture Generator | For a use case's `pattern`: emit reference design (components, approved platforms from catalog, data flow Mermaid, security controls, eval plan, cost band). Patterns: rag, agent_tools, fine_tune, classic_ml, vision. | `ReferenceArchitecture{usecase_id, pattern, components[], diagram_mermaid, controls[], eval_plan[], cost_band}` | `approve_reference_design` | principal_architect |
| `dai.model_agent_registry_steward` | Model and Agent Registry Steward | Inventory `ai_assets`; flag unregistered, no eval, unknown data, expense-report vendors; compute monthly AI spend by department; link to use cases and risk tiers. | `RegistryFinding{asset_id, flags[], monthly_cost_usd, linked_usecase_id?, risk_tier?}` | `register_asset`, `require_eval`, `suspend_asset` | risk_officer |

### 7.6 Shared agents

| id | Name | Logic | Notes |
|---|---|---|---|
| `shared.orchestrator` | Orchestrator | Routes a natural-language request or UI trigger to one or more agents; merges outputs; creates approvals; handles autonomy gating. Mock: keyword router. Live: LLM tool-selection over registry descriptions. | Exposes `POST /agents/run` and `POST /orchestrate`. |
| `shared.graph_curator` | Knowledge Graph Curator | Applies approved actions to the graph; resolves conflicts (two sources disagree → keep higher confidence, log conflict); recomputes derived props. | Runs after every approval decision. |
| `shared.copilot` | Architecture Copilot | Answers questions over the graph. Mock: 25–30 canned Q→A pairs per tenant plus pattern-matched queries (owner of X, apps for capability Y, downstream of Z, is there a pattern for W, cost of V). Live: LLM with tools `kg.query`, `kg.lineage`, `kg.impact`, `search_standards`, `search_patterns`; must cite record ids. | Chat UI; shows cited records as chips. |
| `shared.diagram_generator` | Diagram Generator | Produces Mermaid: capability map (treemap-style via mindmap), C4 context for an app, data flow for a dataset, integration map for a capability. | Rendered client-side with Mermaid. |
| `shared.evidence_audit` | Evidence and Audit Agent | Assembles an evidence pack: for a regulation or policy, list controls, findings, approvals, timestamps, approvers; export markdown + JSON. | Button "Generate evidence pack" on AI Governance and Data pages. |
| `shared.exec_briefing` | Executive Briefing Agent | Monthly summary markdown: inventory accuracy, savings identified/approved/realized, AI use cases by tier, design review SLA, debt trend, roadmap progress, top 3 decisions needed. Mock: template over metrics. Live: LLM narrative over metrics JSON. | Dashboard "Generate briefing". |

### 7.7 Prompts (live mode)

`llm/prompts/{agent_id}.md` for each agent with: role, inputs (JSON schema), tool results provided, output JSON schema, rules: *only use provided records; every finding must include `source_refs`; if evidence is insufficient, say so in `summary` and return no findings rather than guessing; plain language; no marketing tone.* Use Anthropic prompt caching for the static parts. Max output tokens per agent in config. Retries: 1 on schema validation failure, with the validation error appended.

---

## 8. Human-in-the-loop, approvals, audit, autonomy

### 8.1 Tables

```
agent_runs(id, tenant_id, agent_id, trigger (ui|orchestrator|scheduled), input_json, output_json, status, started_at, finished_at, cost_json)
approvals(id, tenant_id, run_id, action_type, target_id, target_type, payload_json, rationale, source_refs_json, approver_role, status (pending|approved|rejected|edited), decided_by_user_id, decided_at, decision_note, edited_payload_json)
audit_events(id, tenant_id, ts, actor_type (agent|user|system), actor_id, event_type, subject_type, subject_id, details_json)
agent_settings(tenant_id, agent_id, autonomy_level (1–4), enabled, acceptance_rate_30d, last_run_at)
```

### 8.2 Approval flow

1. Agent run creates `approvals` (status pending) for each proposed action when autonomy ≥ L2. At L1, actions are shown as "observations" only (no approval row).
2. Approvals page lists pending items filtered by the current user's role; each shows rationale, evidence chips (click → record detail), and the diff of what will change.
3. Decide: approve / edit-and-approve / reject with note. On approve, `graph_curator` applies the change (e.g., `set_disposition` updates `kg_nodes.props.disposition` and `status=approved`), writes audit events, and updates `acceptance_rate_30d`.
4. At L3, approving triggers the downstream effect immediately (e.g., `create_remediation_ticket` writes to a `tickets` table shown as "Jira (simulated)").

### 8.3 Audit

Audit page: timeline filterable by actor, agent, subject; export JSON/CSV. Every row links to the run and approval.

### 8.4 Autonomy levels

| Level | Behavior in prototype |
|---|---|
| L1 Observe | Findings only; no approval rows |
| L2 Propose | Approval rows created; nothing applied until decided |
| L3 Act with approval | On approval, side effects execute (graph write, simulated ticket, ADR publish) |
| L4 Act and notify | Display-only toggle; UI explains "not enabled in prototype" |

Agents page lets the principal architect change a level per agent per tenant; show `acceptance_rate_30d` and the promotion rule text (80%/4 weeks to L2; 90%/8 weeks to L3) as guidance. Seed `acceptance_rate_30d` with plausible values so some agents qualify for promotion in the demo.

---

## 9. Backend API (FastAPI)

Prefix all with `/api/v1`, header or query `tenant_id` required.

| Method | Path | Purpose |
|---|---|---|
| GET | `/tenants` | list tenants with summary stats |
| GET | `/users` | users for "Acting as" |
| GET | `/metrics/dashboard` | KPIs (Section 10.1) |
| GET | `/kg/nodes?type=&q=` ; `/kg/nodes/{id}` ; `/kg/nodes/{id}/neighbors?depth=` | graph browsing |
| GET | `/kg/impact?node_id=&depth=` ; `/kg/lineage?dataset_id=&direction=` | analysis |
| GET | `/kg/diagram?kind=capability_map|c4_context|data_flow|integration_map&id=` | Mermaid text |
| GET | `/portfolio/applications?quadrant=&flag=&capability=` ; `/portfolio/applications/{id}` | inventory with cost, usage, debt, disposition, evidence |
| GET | `/portfolio/overlaps` ; `/portfolio/lifecycle` ; `/portfolio/savings` | portfolio views |
| GET | `/ai/usecases` ; `/ai/usecases/{id}` ; `/ai/assets` ; `/ai/risk-summary` | AI governance |
| GET | `/app/designs` ; `/app/designs/{id}` ; `/app/adrs` ; `/app/drift` ; `/app/debt` ; `/app/apis` | application architecture |
| GET | `/ea/capabilities` ; `/ea/goals` ; `/ea/investment-alignment` ; `/ea/roadmaps` | enterprise architecture |
| GET | `/data/datasets` ; `/data/policy-findings` ; `/data/products` | data architecture |
| POST | `/agents/run` `{agent_id, params}` | run one agent; returns `AgentOutput` |
| POST | `/orchestrate` `{request_text}` | route to agents; returns combined outputs |
| GET | `/agents` ; `PATCH /agents/{id}/settings` | registry and autonomy |
| GET | `/runs` ; `/runs/{id}` | run history |
| GET | `/approvals?status=&role=` ; `POST /approvals/{id}/decide` `{decision, note, edited_payload?}` | approvals |
| GET | `/audit?actor=&agent=&subject=&from=&to=` ; `/audit/export` | audit |
| POST | `/copilot/ask` `{question, history[]}` | Copilot; returns answer + citations + optional Mermaid |
| POST | `/evidence/pack` `{regulation_or_policy_id}` | evidence pack markdown + JSON |
| POST | `/briefing/generate` | executive briefing markdown |
| GET | `/raw/{source}` | raw ingested source sample (first 200 rows) for "what we ingested" |
| POST | `/admin/reset?tenant=` | regenerate data from seed |

All responses include `source_refs` where facts are stated. Pydantic schemas in `backend/app/schemas`; OpenAPI used to generate the TS client.

---

## 10. Frontend

### 10.1 Global

- Top bar: tenant switcher (NorthGrid Energy / Meridian Telecom), "Acting as" user selector, LLM mode badge (Mock / Live), pending approvals count.
- Left nav: Dashboard, Portfolio, AI Governance, Application Architecture, Enterprise Architecture, Data Architecture, Copilot, Approvals, Audit, Graph Explorer, Agents, Ingested Sources.
- Evidence chips everywhere: `[INV-01822]` style chips open a drawer with the raw record and which agent used it.
- Confidence badges: green ≥0.9, amber 0.7–0.9, red <0.7.
- Every agent-generated panel shows: agent name, run time, "Propose / Observe" state, and a "Re-run" button.

### 10.2 Pages

**Dashboard** — KPI tiles: Inventory accuracy (% apps confirmed by owner), Savings identified / approved / realized (USD), AI use cases by tier (stacked bar), Design review median turnaround (hours), Open policy violations, Tech debt score trend (line, 6 months synthetic), Upcoming EOS/renewals (next 180 days), Agent acceptance rate. Button: Generate executive briefing → markdown modal. Panel: "Decisions needed this week" (top 5 pending approvals).

**Portfolio** — Tabs: Inventory (table: app, capability, owner, cost, users 90d, confidence, disposition, flags; filters; row drawer with evidence and cost breakdown), Discovery (reconciliation results: shadow IT candidates, CMDB duplicates; "Send to owners for confirmation" creates approvals), Overlaps (clusters with survivor recommendation and savings; "Build business case"), TIME (2×2 scatter: business fit × technical health; dots colored by quadrant; click → app), Lifecycle (timeline of EOS and renewals), Savings (waterfall by lever).

**AI Governance** — Tabs: Intake backlog (ranked table with value/feasibility/data readiness; "Classify risk"), Risk register (tier badges, triggers, required controls checklist, approve tier), AI asset registry (registered vs shadow AI, spend by department), Reference architectures (select use case → Mermaid design + controls), Evidence pack button.

**Application Architecture** — Tabs: Design reviews (list of submissions; open → full text with inline concern highlights, standard ids, verdict; approve/exception), ADRs (drafts from discussions; publish), Drift (declared vs actual Mermaid side by side; boundary violations highlighted; create ticket), APIs (duplicates, insecure, canonical designation), Tech debt (ranked bars; drivers), Threat models (STRIDE table), Pattern advisor (text box → recommendation + diagram).

**Enterprise Architecture** — Capability heat map (treemap or grid, color = heat score, size = app count), Goal→capability→project sankey (or 3-column linkage view), Investment alignment (aligned / orphan / unfunded), Roadmap scenarios (3 side-by-side quarter grids with tradeoffs; adopt), Impact analysis (preset triggers dropdown + custom node; results grouped), Board pack generator.

**Data Architecture** — Lineage explorer (select dataset → upstream/downstream graph), Policy findings (table with fix actions), Data products (proposals with contract YAML).

**Copilot** — Chat with suggested questions per tenant; answers show citations and optional diagram. Example suggestions in Section 11.

**Approvals** — Inbox filtered by current role; card per item with diff view; bulk approve for low-risk types (`tag_resources`, `assign_owner`).

**Audit** — Timeline + filters + export.

**Graph Explorer** — Force-directed graph with type filters, search, node detail drawer, "explain this node" (Copilot).

**Agents** — Registry cards grouped by domain: description, inputs, approver, autonomy slider (L1–L3 live, L4 disabled), acceptance rate, last run, Run button, link to runs.

**Ingested Sources** — Cards per source system with row counts, sample rows, and planted-anomaly notes (toggle "show what we planted" for demo narration; hidden by default).

### 10.3 Visual style

Clean, neutral, professional (gray/white, one accent color). No marketing imagery. Tables dense. Monospace for record ids. Mermaid rendered with default neutral theme.

---

## 11. Demo script (15 minutes) — also written to `docs/DEMO_SCRIPT.md`

**Setup:** `make demo` → opens UI at `http://localhost:5173`, tenant NorthGrid Energy, acting as Principal Architect, Mock mode.

1. **Problem (1 min)** — Ingested Sources page: "Here is what we connected read-only: SSO logs, invoices, cloud, CMDB, repos, data catalog. Note the inconsistent names and the apps missing from the CMDB."
2. **Portfolio discovery (3 min)** — Portfolio › Discovery: run `pf.app_discovery`. Show 22 shadow IT candidates (3 are GenAI tools paid on expenses), 9 CMDB duplicates, confidence badges. Click an evidence chip to show the invoice line. "Send to owners for confirmation" → switch Acting-as to an app owner → approve two, reject one (it's a retired tool) → Audit shows it.
3. **Savings (2 min)** — Portfolio › Overlaps: 3 document management systems, survivor recommended; Lifecycle: OMS vendor EOS in 7 months, auto-renewing analytics contract at 18% utilization in 64 days. Run `pf.business_case_builder` on the doc-management cluster → one-page case. Switch to CIO → approve. Dashboard savings tile updates.
4. **AI governance (3 min)** — AI Governance › Intake: ranked backlog. Open "Dynamic pricing recommendation" → `dai.ai_risk_classifier` → **High** (automated decision affecting customers; regulated tariff) with required controls. Open "Grid operator GenAI assistant" → High (safety-relevant). Open "Covert employee sentiment monitoring" → **Blocked**. Show "Vegetation encroachment detection" → Minimal. Switch to Risk Officer → approve two tiers. Registry tab: 11 AI assets, 5 unregistered. Generate evidence pack for "PUC customer data privacy rule".
5. **Application architecture (3 min)** — Design reviews: open "Customer Usage Insights service" → `app.design_review` flags direct DB link to CIS billing DB (STD-INT-02), unapproved GenAI vendor (STD-AI-01), missing classification; suggests reusing the existing Customer Lookup API. Drift tab: 2 IT/OT boundary violations highlighted in red on the actual-vs-intended diagram → create remediation ticket (simulated). ADRs: publish a draft generated from a Slack thread.
6. **Enterprise architecture (2 min)** — Capability heat map: "Outage Management" high importance, low maturity, 4 overlapping apps. Investment alignment: 25% of project budget has no goal; "Wildfire Mitigation" goal unfunded. Impact analysis preset: "GIS vendor exits market" → affected apps, datasets, AI use cases, crews. Roadmap: 3 scenarios; adopt "risk-first".
7. **Copilot + switch tenant (1 min)** — Ask "Who owns meter data and what AI uses it?" → cited answer and lineage diagram. Switch to Meridian Telecom: same agents, different story — two billing systems post-merger, BSS/OSS shared-DB violations, next-best-offer tiered High, legacy mediation EOS. Show Dashboard for Meridian.

**Copilot suggested questions per tenant (seed at least 10 each):**
- NorthGrid: Who owns the Meter Data Management system? Which applications support Outage Management? What depends on the GIS platform? Which AI use cases use customer PII? Is there an approved pattern for streaming meter events? Which contracts renew in the next 90 days? What would break if we retired the legacy document system? Which integrations cross the IT/OT boundary? How much do we spend on BI tools? Which projects have no strategic goal?
- Meridian: Which systems realize Billing & Revenue Management? Show lineage for the subscriber usage dataset. Which AI use cases are high risk and why? Where do BSS and OSS share a database? Which APIs are duplicated? What is the cost of the two CRMs combined? What depends on the legacy mediation platform? Which datasets violate residency? Which design reviews are pending? What does the 5G monetization strategy need that we don't have?

**Preset impact triggers:** NorthGrid: GIS vendor exit; new PUC data-access mandate; acquire a neighboring co-op (adds 300k customers); OMS end of support. Meridian: merge the two billing systems; regulator bans fully automated credit decisions; legacy mediation retirement; new data residency law.

---

## 12. Mock LLM design

- `MockLLM.complete(prompt, schema)` returns outputs from `llm/mock_responses/{agent_id}/{key}.json` when a key matches (`key` derived from params, e.g., design_id), else from the agent's `mock_run` deterministic output serialized through a narrative template (`templates/{agent_id}.jinja`).
- Narrative templates must produce readable summaries, e.g., "Found 22 applications in invoices and SSO logs that are not in the CMDB; 3 are generative-AI tools paid through expense reports (see INV-01822, INV-02017, INV-02211)."
- Copilot mock: pattern matchers (regex over question) → graph queries → templated answers with citations; fallback: "I can answer questions about owners, dependencies, costs, lineage, policies and patterns in the knowledge graph. Try: …".
- Live mode uses the same deterministic tool results as inputs; the LLM only writes the narrative, ranks, and maps to standards/rules with ids. Mock and live outputs must share schemas so the UI is identical.

---

## 13. Non-functional requirements

- `make setup` installs everything (uv or pip + npm). `make demo` generates data if missing, starts API (port 8000) and UI (port 5173), and prints the demo URL. `make reset` regenerates data.
- Cold start to UI-ready ≤ 60 seconds on a laptop. Data generation per tenant ≤ 20 seconds.
- Agent runs in mock mode ≤ 2 seconds each; live mode ≤ 30 seconds with a visible progress state.
- No network calls in mock mode. Live mode reads `ANTHROPIC_API_KEY` only from env.
- Logging: structured JSON logs for agent runs with run_id correlation.
- Security: no real PII; all names and emails synthetic; `.env` gitignored.
- Code quality: type hints, ruff, mypy (basic), eslint; pytest coverage ≥ 70% on `agents/`, `kg/`, `data_gen/`.

---

## 14. Build phases and acceptance criteria

### Phase 1 — Data and graph (first)
- [ ] `data_gen` generates both tenants deterministically; all tables and volumes in 5.1; planted anomalies in 5.3 verified by tests (`tests/test_planted_anomalies.py` asserts counts within ranges).
- [ ] `kg/build.py` builds nodes/edges; `kg/queries.py` passes tests for lineage, impact, orphans, violations.
- [ ] `data_gen/README.md` lists every table and planted anomaly with counts per tenant.

### Phase 2 — Backend skeleton and portfolio agents
- [ ] FastAPI with tenants, users, metrics, kg, portfolio, approvals, audit, agents, runs endpoints.
- [ ] Agents: all six `pf.*` with `mock_run`, schemas, prompts; approvals created at L2; graph_curator applies approved actions.
- [ ] Test: discovery finds ≥ 90% of ground-truth aliases; ≥ 18 shadow IT candidates for NorthGrid; TIME quadrants non-empty for all four quadrants.

### Phase 3 — Data & AI agents
- [ ] All seven `dai.*` agents; risk tiers distribution per 5.3; at least one blocked use case per tenant; evidence pack generation.
- [ ] Test: every `RiskClassification` cites rule ids and every control has a source.

### Phase 4 — Application and Enterprise agents + shared
- [ ] All `app.*` and `ea.*` agents; copilot (mock); diagram generator; exec briefing; board assistant; orchestrator keyword routing.
- [ ] Test: design review flags the planted violations with correct standard ids for all planted design docs; drift detector finds all planted boundary violations.

### Phase 5 — Frontend
- [ ] All pages in 10.2 wired to the API; evidence chips and confidence badges; approvals and audit flows; tenant and role switching; Mermaid rendering.
- [ ] Demo script executes end to end in mock mode without errors; `docs/DEMO_SCRIPT.md` matches UI labels.

### Phase 6 — Live mode and polish
- [ ] `LLM_MODE=live` works for all agents and copilot with schema validation and one retry; prompt caching enabled.
- [ ] Executive briefing and business case read well in live mode; costs displayed per run.
- [ ] README with architecture overview, how to run, how to add an agent, how to add a tenant catalog.

### Definition of done for the prototype
- A new user can run `make setup && make demo` and complete the 15-minute script in mock mode.
- Every number on the Dashboard can be traced to approvals and records through the UI.
- No agent output anywhere lacks `source_refs`.
- Both tenants tell a coherent industry story (Section 5.2 catalogs fully present).

---

## 15. Out of scope (do not build)

Authentication/SSO, multi-tenant hosting, real connectors to Jira/ServiceNow/cloud APIs, real LeanIX/Ardoq sync (show as "planned integration" placeholder), L4 autonomy execution, mobile layout, billing/metering, i18n, production hardening.

---

## 16. Open decisions for the implementer (record in `docs/DECISIONS.md`)

1. uv vs pip; Alembic vs create_all for the prototype (recommend create_all).
2. Whether to store Mermaid diagrams or render on request (recommend on request, cache in memory).
3. Rapidfuzz threshold and alias catalog size for discovery (start at 85; tune until ≥ 90% recall on ground truth).
4. TIME quadrant thresholds (start: business fit ≥ 3.0 and tech health ≥ 3.0 → Invest; low/low → Eliminate; high fit/low health → Migrate; low fit/high health → Tolerate).
5. Risk classifier rule table location (recommend `catalogs/ai_risk_rules.yaml`, shared by both tenants, with tenant-specific regulation names).
