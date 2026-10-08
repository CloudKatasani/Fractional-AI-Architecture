import { useState } from "react";
import { ApprovalRef } from "../../api/client";
import { AgentPanel, ApprovalControls } from "../AgentPanel";
import { EvidenceList } from "../Evidence";
import { Empty, ErrorBox, Loading, SeverityBadge, Stat, Toggle } from "../ui";
import { IdChip } from "./shared";
import { useApi } from "../../state/AppState";

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Data-privacy & policy findings (moved from the former Data Architecture page). */
export function PrivacyTab() {
  const { data, loading, error } = useApi<any>("/data/policy-findings");
  const [pol, setPol] = useState("");
  const [sev, setSev] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const items: any[] = [...data.items].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || a.policy_id.localeCompare(b.policy_id));
  const shown = items.filter((f) => (!pol || f.policy_id === pol) && (!sev || f.severity === sev) && (!openOnly || !f.approval || f.approval.status === "pending"));
  const bySev = ["critical", "high", "medium", "low"].map((s) => ({ s, n: items.filter((f) => f.severity === s).length }));
  const policies: any[] = data.policies || [];
  const pending = items.filter((f) => f.approval?.status === "pending").length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {bySev.map(({ s, n }) => (
          <Stat key={s} label={s} value={<span className={s === "critical" ? "text-red-700" : ""}>{n}</span>} onClick={() => setSev(sev === s ? "" : s)} />
        ))}
        <Stat label="Fixes awaiting decision" value={pending} sub="data governance lead" />
      </div>
      <AgentPanel agentId="dai.governance_policy_checker" run={data.run}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select className="input" value={pol} onChange={(e) => setPol(e.target.value)} data-testid="policy-filter">
            <option value="">All policies</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>{p.id} · {p.title} ({items.filter((f) => f.policy_id === p.id).length})</option>
            ))}
          </select>
          <select className="input" value={sev} onChange={(e) => setSev(e.target.value)} data-testid="severity-filter">
            <option value="">All severities</option>
            {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Toggle checked={openOnly} onChange={setOpenOnly} label="open only" />
          <span className="text-xs muted ml-auto">{shown.length} of {items.length} findings</span>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl" data-testid="policy-table">
            <thead>
              <tr><th>Sev.</th><th>Policy</th><th>Subject</th><th>Fix</th><th>Evidence</th><th>Decision</th></tr>
            </thead>
            <tbody>
              {shown.map((f, i) => (
                <tr key={`${f.policy_id}-${f.subject_id}-${i}`} className={f.severity === "critical" ? "bg-red-50/50" : ""}>
                  <td><SeverityBadge severity={f.severity} /></td>
                  <td className="min-w-[14rem]">
                    <div className="flex items-start gap-1"><IdChip id={f.policy_id} /><span className="text-gray-900">{f.policy_title}</span></div>
                    <div className="text-[11px] muted">{f.regulation}</div>
                  </td>
                  <td className="min-w-[12rem]">
                    <div className="flex items-start gap-1"><IdChip id={f.subject_id} /><span className="break-words">{f.subject_name}</span></div>
                    <div className="text-[11px] muted">{f.subject_type}{f.check ? ` · ${f.check}` : ""}</div>
                  </td>
                  <td className="min-w-[14rem] text-xs text-gray-700">{f.fix}</td>
                  <td className="min-w-[9rem] max-w-[12rem]"><EvidenceList refs={f.source_refs} max={4} /></td>
                  <td className="min-w-[12rem] whitespace-nowrap">
                    {f.approval?.action_type && <div className="mb-0.5 font-mono text-[11px] text-gray-600">{f.approval.action_type.replace(/_/g, " ")}</div>}
                    <ApprovalControls approval={f.approval as ApprovalRef} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && <Empty>No findings match the filters.</Empty>}
      </AgentPanel>
    </div>
  );
}
