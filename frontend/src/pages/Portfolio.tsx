import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/Layout";
import { DiscoveryTab } from "../components/portfolio/DiscoveryTab";
import { InventoryTab } from "../components/portfolio/InventoryTab";
import { LifecycleTab } from "../components/portfolio/LifecycleTab";
import { OverlapsTab } from "../components/portfolio/OverlapsTab";
import { SavingsTab } from "../components/portfolio/SavingsTab";
import { Tabs, useTab } from "../components/ui";
import { useApp } from "../state/AppState";

const TABS = [
  { id: "savings", label: "Savings" },
  { id: "discovery", label: "Shadow IT" },
  { id: "lifecycle", label: "Renewals & EOS" },
  { id: "overlaps", label: "Overlapping tools" },
  { id: "inventory", label: "App inventory" },
];

export default function Portfolio() {
  const { tenantName } = useApp();
  const [tab, setTab] = useTab("savings", "tab");
  const [params, setParams] = useSearchParams();

  // keep ?tab= in the URL so tabs are linkable (Dashboard tiles deep-link here)
  useEffect(() => {
    const t = params.get("tab");
    if (t && t !== tab && TABS.some((x) => x.id === t)) setTab(t);
  }, [params]);
  const change = (id: string) => {
    setTab(id);
    const p = new URLSearchParams(params);
    p.set("tab", id);
    setParams(p, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="SaaS & Cloud Savings"
        subtitle={<>Shadow IT, unused licences, auto-renewal traps and overlapping tools for {tenantName} — every number backed by an invoice, login or contract record.</>}
      />
      <Tabs tabs={TABS} active={TABS.some((t) => t.id === tab) ? tab : "savings"} onChange={change} />
      {tab === "inventory" && <InventoryTab />}
      {tab === "discovery" && <DiscoveryTab />}
      {tab === "overlaps" && <OverlapsTab />}
      {tab === "lifecycle" && <LifecycleTab />}
      {(tab === "savings" || !TABS.some((t) => t.id === tab)) && <SavingsTab />}
    </div>
  );
}
