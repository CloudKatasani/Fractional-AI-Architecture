import { Drift } from "../components/arch/AppTabs";
import { setUrlParam } from "../components/arch/common";
import { DesignReviews } from "../components/arch/DesignReviews";
import { PageHeader } from "../components/Layout";
import { Tabs, useTab } from "../components/ui";
import { useApp } from "../state/AppState";

const TABS = [
  { id: "designs", label: "Design reviews" },
  { id: "drift", label: "Architecture drift" },
];

export default function AppArchitecture() {
  const { tenantName } = useApp();
  const [tab, setTab] = useTab("designs", "tab");
  const change = (t: string) => {
    setTab(t);
    setUrlParam("tab", t);
  };
  return (
    <div className="[&_button]:whitespace-nowrap">
      <PageHeader
        title="Design Reviews & Drift"
        subtitle={`${tenantName} — every design checked against your standards in seconds; runtime drift and boundary violations caught before the auditor does.`}
      />
      <Tabs tabs={TABS} active={tab} onChange={change} />
      {tab === "designs" && <DesignReviews />}
      {tab === "drift" && <Drift />}
    </div>
  );
}
