import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useApi, useApp } from "../state/AppState";
import { usdShort } from "../components/ui";

const MODULES = [
  {
    name: "SaaS & Cloud Savings",
    tag: "Pays for itself",
    points: [
      "Finds shadow IT and AI tools hiding in invoices, expense reports and SSO logs",
      "Flags auto-renewals with unused seats before the notice window closes",
      "Spots overlapping tools and builds the consolidation business case",
      "Allocates untagged cloud spend",
    ],
    to: "/portfolio",
  },
  {
    name: "AI Governance & Compliance",
    tag: "EU AI Act-ready",
    points: [
      "One intake and risk register for every AI use case, tiered with cited rules",
      "Registry of models, agents and vendor copilots — including the unregistered ones",
      "Data-privacy policy checks with fixes routed to the right owner",
      "One-click evidence packs for auditors and regulators",
    ],
    to: "/ai-governance",
  },
  {
    name: "Design Reviews & Drift",
    tag: "Minutes, not weeks",
    points: [
      "Every design checked against your standards, each concern mapped to a rule",
      "Suggests existing APIs to reuse instead of new point-to-point links",
      "Detects runtime drift and boundary violations (IT/OT, BSS/OSS)",
      "Opens remediation tickets once a human approves",
    ],
    to: "/application",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$2,500",
    per: "/month",
    who: "Scale-ups up to 500 employees",
    features: ["SaaS & Cloud Savings", "Copilot over your estate", "Approvals inbox & audit trail", "Up to 5 read-only connectors", "Monthly executive briefing"],
  },
  {
    name: "Growth",
    price: "$5,000",
    per: "/month",
    who: "Mid-market, 500–5,000 employees",
    highlight: true,
    features: ["Everything in Starter", "AI Governance & Compliance + evidence packs", "Design Reviews & Drift", "Unlimited connectors", "Fractional principal architect: 2 days/month"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    who: "Regulated industries & multi-entity groups",
    features: ["Everything in Growth", "Live LLM mode in your cloud tenancy", "Custom standards & policy packs", "SSO, data residency, private deployment", "Dedicated architecture team"],
  },
];

export default function Landing() {
  const { tenantName } = useApp();
  const { data: m } = useApi<any>("/metrics/dashboard");
  const { data: disc } = useApi<any>("/portfolio/discovery");
  const shadow = disc?.items?.filter((f: any) => f.type === "new_app").length;
  const fee = m?.roi?.annual_fee_usd;
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent-600 text-xs font-bold text-white">FA</div>
          <span className="font-semibold text-gray-900">Fractional AI Architecture</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#product" className="text-gray-600 hover:text-gray-900">Product</a>
          <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
          <a href="#trust" className="text-gray-600 hover:text-gray-900">Trust</a>
          <Link to="/" className="btn-primary">Open live demo</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-14 pt-10">
        <div className="max-w-3xl">
          <div className="mb-3 inline-block rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700">
            AI agents propose · your people decide
          </div>
          <h1 className="text-4xl font-bold leading-tight text-gray-900">
            An architecture office in a box: cut SaaS waste, govern AI risk and review designs — with evidence for every number.
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Connect read-only to invoices, SSO, cloud billing, CMDB and Git. Our agents build a living map of your estate in hours and send every
            recommendation to the right owner for approval. Nothing changes without a human decision, and everything is audited.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/" className="btn-primary px-4 py-2 text-base">See the live demo</Link>
            <a href="#pricing" className="btn px-4 py-2 text-base">Start a 2-week savings assessment</a>
          </div>
        </div>

        {m && (
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Proof label="Savings identified / yr" value={usdShort(m.savings.identified)} sub={`in the ${tenantName} demo`} />
            <Proof label="Shadow IT tools found" value={shadow ?? "—"} sub="from invoices, expenses & SSO" />
            <Proof label="AI use cases risk-tiered" value={Object.values<any>(m.ai_tiers).reduce((n, t) => n + t.approved + t.proposed, 0)} sub="with cited rule ids" />
            <Proof label="Return on subscription" value={m.roi.multiple ? `${m.roi.multiple}x` : "—"} sub={fee ? `savings vs ${usdShort(fee)}/yr ${m.roi.plan} plan` : ""} />
          </div>
        )}
      </section>

      <section id="product" className="border-t border-gray-100 bg-gray-50 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-semibold">Three products, one platform</h2>
          <p className="mt-1 text-gray-600">Start with savings — it funds the rest.</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {MODULES.map((mod) => (
              <div key={mod.name} className="card flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base">{mod.name}</h3>
                  <span className="rounded bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-700">{mod.tag}</span>
                </div>
                <ul className="mt-3 flex-1 space-y-2 text-sm text-gray-700">
                  {mod.points.map((p) => <li key={p} className="flex gap-2"><span className="text-accent-600">✓</span>{p}</li>)}
                </ul>
                <Link to={mod.to} className="btn mt-4 justify-center">Explore in the demo</Link>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {[
              ["1. Connect", "Read-only connectors to invoices, SSO, cloud billing, CMDB, Git and your data catalogue."],
              ["2. Agents analyse", "Specialised agents reconcile sources, score risk and draft proposals — each fact cites a source record."],
              ["3. Humans decide", "Proposals land in the inbox of the right owner, CIO or risk officer. Approve, edit or reject."],
              ["4. Prove it", "Dashboard, executive briefing, evidence packs and a full audit trail for every decision."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="font-semibold text-gray-900">{t}</div>
                <div className="mt-1 text-sm text-gray-600">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-14">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-semibold">Pricing</h2>
          <p className="mt-1 text-gray-600">Annual subscription. Every plan starts with a fixed-fee 2-week savings assessment ($9,500, credited against year one).</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={`card p-5 ${p.highlight ? "border-accent-500 ring-2 ring-accent-100" : ""}`}>
                {p.highlight && <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-accent-700">Most popular</div>}
                <h3 className="text-lg">{p.name}</h3>
                <div className="mt-1 text-xs muted">{p.who}</div>
                <div className="mt-3"><span className="text-3xl font-bold">{p.price}</span><span className="muted">{p.per}</span></div>
                <ul className="mt-4 space-y-2 text-sm text-gray-700">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><span className="text-accent-600">✓</span>{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="border-t border-gray-100 bg-gray-50 py-14">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 lg:grid-cols-3">
          <Trust title="Read-only by default" text="Connectors only read. Agents write drafts; side effects (tickets, ADRs) run only after an approval at the autonomy level you choose." />
          <Trust title="Grounded, not guessed" text="Every finding must cite source records or it is rejected. The LLM writes narrative over computed facts — it cannot invent numbers." />
          <Trust title="Audit-ready" text="Every agent run and human decision is logged and exportable. Evidence packs map controls to findings, approvers and timestamps." />
        </div>
        <div className="mx-auto mt-10 max-w-6xl px-6 text-center">
          <Link to="/" className="btn-primary px-5 py-2 text-base">Open the live demo</Link>
        </div>
      </section>
      <footer className="py-6 text-center text-xs muted">© Fractional AI Architecture · demo data is synthetic</footer>
    </div>
  );
}

function Proof({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="label">{label}</div>
      <div className="mt-1 text-3xl font-bold text-accent-600">{value}</div>
      {sub && <div className="mt-0.5 text-xs muted">{sub}</div>}
    </div>
  );
}

function Trust({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="font-semibold text-gray-900">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{text}</div>
    </div>
  );
}
