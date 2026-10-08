import { Fragment, useMemo, useState } from "react";
import { useApi } from "../../state/AppState";
import { AgentPanel, ApprovalControls } from "../AgentPanel";
import { EvidenceChip, EvidenceList, TextWithChips } from "../Evidence";
import { Mermaid } from "../Mermaid";
import { Badge, Card, Empty, ErrorBox, Loading, SeverityBadge, Toggle } from "../ui";
import { NamedChip } from "./common";

const DRIFT_ORDER = ["boundary_violation", "unapproved_integration", "undeclared_dependency"];
const DRIFT_LABEL: Record<string, string> = {
  boundary_violation: "Boundary violations",
  unapproved_integration: "Unapproved integrations",
  undeclared_dependency: "Undeclared dependencies",
};

export function Drift() {
  const { data, loading, error } = useApi<any>("/app/drift");
  const [stacked, setStacked] = useState(false);
  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    (data?.items || []).forEach((x: any) => (g[x.type] = g[x.type] || []).push(x));
    return [...DRIFT_ORDER, ...Object.keys(g).filter((k) => !DRIFT_ORDER.includes(k))].filter((k) => g[k]).map((k) => [k, g[k]] as const);
  }, [data]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const tickets: any[] = data.tickets || [];
  return (
    <div className="space-y-4">
      <AgentPanel agentId="app.drift_detector" run={data.run}>
        <div className="mb-3 flex flex-wrap gap-2">
          {groups.map(([k, xs]) => (
            <Badge key={k} color={k === "boundary_violation" ? "red" : "amber"}>{DRIFT_LABEL[k] || k}: {xs.length}</Badge>
          ))}
          <span className="ml-auto"><Toggle checked={stacked} onChange={setStacked} label="Stack diagrams vertically" /></span>
        </div>
        <div className={`grid gap-4 ${stacked ? "" : "xl:grid-cols-2"}`}>
          <div className="rounded border border-gray-200 p-2 min-w-0">
            <div className="label mb-1">Intended — declared &amp; approved integrations</div>
            <Mermaid chart={data.diagrams?.intended} />
          </div>
          <div className="rounded border border-red-200 p-2 min-w-0">
            <div className="label mb-1 text-red-700">Actual — observed at runtime (red = boundary-crossing DB link, dashed = undeclared)</div>
            <Mermaid chart={data.diagrams?.actual} />
          </div>
        </div>
      </AgentPanel>

      <Card title="Drift findings" subtitle="Approving a remediation ticket at L3 creates a ticket in Jira (simulated).">
        <div className="-m-4 overflow-auto">
          <table className="tbl">
            <thead><tr><th>Flow (from → to)</th><th>Details</th><th>Standard</th><th>Severity</th><th>Evidence</th><th>Approval</th></tr></thead>
            <tbody>
              {groups.map(([k, xs]) => (
                <Fragment key={k}>
                  <tr>
                    <td colSpan={6} className={`text-xs font-semibold uppercase tracking-wide ${k === "boundary_violation" ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"}`}>
                      {DRIFT_LABEL[k] || k} ({xs.length})
                    </td>
                  </tr>
                  {xs.map((f: any, i: number) => (
                    <tr key={`${k}-${i}`} className={k === "boundary_violation" ? "bg-red-50/60" : ""}>
                      <td className="whitespace-nowrap">
                        <div><NamedChip id={f.app_id} name={f.app_name} /></div>
                        <div className="pl-3 text-gray-400">↳ <NamedChip id={f.to_app_id} name={f.to_app_name} /></div>
                      </td>
                      <td className={`text-xs min-w-[18rem] ${k === "boundary_violation" ? "font-medium text-red-800" : ""}`}>
                        {f.integration_id && <EvidenceChip id={f.integration_id} />}<TextWithChips text={f.details} />
                      </td>
                      <td className="whitespace-nowrap">{f.standard_id && <EvidenceChip id={f.standard_id} />}</td>
                      <td><SeverityBadge severity={f.severity} /></td>
                      <td className="min-w-[8rem]"><EvidenceList refs={f.source_refs} max={3} /></td>
                      <td className="whitespace-nowrap"><ApprovalControls approval={f.approval} compact /></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Remediation tickets — Jira (simulated)" subtitle="Created automatically when a remediation is approved at autonomy L3">
        {tickets.length === 0 ? (
          <Empty>No tickets yet. Approve a boundary violation as Security Architect (or Principal Architect) to create one.</Empty>
        ) : (
          <div className="-m-4">
            <table className="tbl">
              <thead><tr><th>Key</th><th>Title</th><th>Status</th><th>Assignee</th><th>Target</th><th>Approval</th><th>Created</th></tr></thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs font-semibold">{t.key}</td>
                    <td>{t.title}<div className="text-xs muted"><TextWithChips text={t.description || ""} /></div></td>
                    <td><Badge color={t.status === "open" ? "amber" : "green"}>{t.status}</Badge></td>
                    <td className="text-xs">{t.assignee || "—"}</td>
                    <td>{t.target_id && <EvidenceChip id={t.target_id} />}</td>
                    <td>{t.approval_id && <EvidenceChip id={t.approval_id} />}</td>
                    <td className="text-xs whitespace-nowrap">{(t.created_at || "").replace("T", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---- APIs ----------------------------------------------------------------------------------------
