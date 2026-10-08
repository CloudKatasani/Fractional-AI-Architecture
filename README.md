# Fractional AI Architecture

**An architecture office in a box for growing companies.** AI agents find SaaS waste, govern AI risk and review designs;
your people approve; every number cites its source record.

*Agents propose, humans decide.* Nothing changes without a human approval, and every decision goes into the audit log.

## What we sell

| Product | Buyer | Outcome |
|---|---|---|
| **SaaS & Cloud Savings** | CFO / CIO | Finds shadow IT and AI tools in invoices, expenses and SSO; flags auto-renewals with unused seats; finds overlapping tools and builds the consolidation business case. *Usually pays for the subscription in the first quarter.* |
| **AI Governance & Compliance** | Risk / Legal / CISO | AI use-case intake and risk register (EU AI Act-style tiers with cited rules), registry of models, agents and copilots including unregistered ones, data-privacy policy checks, one-click evidence packs for auditors. |
| **Design Reviews & Drift** | CTO / engineering leads | Reviews designs against your standards in minutes, suggests APIs to reuse, detects runtime drift and boundary violations, and opens remediation tickets once someone approves. |

Also on every plan: the **Copilot** (cited answers about your estate, with follow-up questions), the **Approvals inbox** (roles
and separation of duties), the **Audit trail** (CSV/JSON export), the **Executive briefing**, and per-agent **automation levels**.

Pricing and go-to-market: [`docs/PRICING.md`](docs/PRICING.md). Sales demo: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) (12 minutes).

## Run the demo

```bash
make setup     # Python deps + npm install, creates .env
make demo      # generates data if missing, starts API :8000 and UI :5173
```

Open http://localhost:5173/welcome for the product page or http://localhost:5173 for the app. Two synthetic customers are
included: **NorthGrid Energy** (utility) and **Meridian Telecom** (telco). The demo runs offline in **mock mode** (deterministic,
no API key needed). For **live mode** set `LLM_MODE=live` and `ANTHROPIC_API_KEY` in `.env`.

| Command | What it does |
|---|---|
| `make setup` | install Python requirements and frontend packages, create `.env` from `.env.example` |
| `make data` / `make reset` | generate both tenants if missing / regenerate from the seed and regenerate the docs |
| `make api` / `make ui` | FastAPI backend (http://localhost:8000/docs) / Vite dev server |
| `make demo` / `make stop` | data + API in the background + UI in the foreground / stop the API |
| `make build` | build the static UI into `frontend/dist` (served by the API at http://localhost:8000) |
| `make test` / `make lint` | pytest with coverage / ruff + TypeScript + eslint |
| `make docs` | regenerate `docs/AGENT_CATALOG.md`, `docs/DEMO_SCRIPT.md`, `data_gen/README.md` |

Configuration (`.env`): `LLM_MODE`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `SEED`, `DEMO_TODAY`, `DATA_DIR`, and
`PLAN_NAME` / `PLAN_FEE_USD` (the plan the **Return on subscription** tile compares savings against; default Growth, $60,000/yr).
Requires Python 3.12+ and Node 18+.

## Architecture

```
 data_gen/ (catalogs + seeded generators) ──► data/{tenant}.db  (SQLite, one per tenant)
                                               source tables · knowledge graph · runs · approvals · audit · tickets
 backend/app/
   kg/          deterministic graph build · NetworkX queries · Mermaid export
   agents/      portfolio/ (savings) · data_ai/ (AI governance) · application/ (design reviews & drift) · shared/ (platform)
   llm/         MockLLM | AnthropicLLM (prompt caching, validated JSON, retry, fallback) · prompts · templates
   orchestrator/approval_gate.py (drafts first, roles, de-duplication) · agents/shared/graph_curator.py (applies decisions)
   routers/     /api/v1 … metrics, portfolio, ai, app, data, agents, runs, approvals, audit, copilot, evidence, briefing, raw
 frontend/      React 18 + Vite + TS + Tailwind + Recharts + Mermaid
```

**Agent contract.** `mock_run` computes typed findings from the data; each finding must cite `source_refs` or it is rejected.
The LLM (template or Claude) writes the narrative over those computed facts only. At automation level ≥ L2 each proposed action
becomes a pending approval; at L3 an approved action also runs its side effect (a simulated ticket). See
[`docs/AGENT_CATALOG.md`](docs/AGENT_CATALOG.md) and [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Adding an agent or an industry

- **Agent:** add a `Finding` + `Agent` subclass under `backend/app/agents/<domain>/`, a narrative template in
  `backend/app/llm/templates/<agent_id>.jinja`, register it in `registry.py`, then run `make docs` (this creates the live-mode prompt)
  and `make test`. The grounding test covers new agents automatically.
- **Industry:** copy `data_gen/catalogs/utilities.yaml`, add the tenant id in `backend/app/config.py`,
  `data_gen/generators/core.py` and `frontend/src/state/AppState.tsx`, then `make reset && make test`.

## Not built yet (roadmap to production)

SSO/authentication, hosted multi-tenancy, real connectors (Okta/Entra, NetSuite/QuickBooks, Ramp/Brex, AWS/Azure/GCP billing,
Jira, ServiceNow), billing, and production hardening. The product cut from the original prototype is described in
[`docs/DECISIONS.md`](docs/DECISIONS.md#startup-edition-product-cut).
