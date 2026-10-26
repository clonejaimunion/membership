import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Building2, IdCard, ShieldCheck, Wallet } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import GatewayCard from "../components/GatewayCard";
import { api, getErrorMessage } from "../lib/api";

const FINANCIAL_KEYS = ["pension", "resignations", "dropout", "letters_received", "letters_sent"];

export default function ProjectPage() {
  const { id } = useParams();
  const [department, setDepartment] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [financialCount, setFinancialCount] = useState(0);
  const [allowed, setAllowed] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: deps }, { data: report }, { data: sum }, { data: meData }] = await Promise.all([
          api.get("/departments"),
          api.get(`/reports/membership?department_id=${id}`),
          api.get(`/category-records/summary?department_id=${id}`),
          api.get("/auth/me"),
        ]);
        setDepartment(deps.find((d) => d.id === id) || null);
        setMemberCount(report.total_members || 0);
        const total = FINANCIAL_KEYS.reduce((s, k) => s + (sum.counts?.[k] || 0), 0);
        setFinancialCount(total);
        setAllowed(meData.allowed_portals || null);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    })();
  }, [id]);

  const canAccess = (key) => !allowed || allowed.includes(key);

  const gateways = useMemo(
    () => [
      {
        key: "membership",
        to: `/project/${id}/membership`,
        label: "العضوية",
        description: "",
        icon: IdCard,
        accent: "blue",
        count: memberCount,
        countSuffix: "عضو",
      },
      {
        key: "financial",
        to: `/project/${id}/financial`,
        label: "الموقف المالي",
        description: "",
        icon: Wallet,
        accent: "amber",
        count: financialCount,
        countSuffix: "سجل",
      },
    ].filter((g) => canAccess(g.key)),
    [id, memberCount, financialCount, allowed]
  );

  return (
    <AppShell title={department?.name || "مشروع التكافل الاجتماعي"}>
      <div className="space-y-7" data-testid="project-hub-page">
        <GatewayHero
          icon={Building2}
          badge=""
          title={department?.name || "مشروع التكافل الاجتماعي"}
          subtitle={department?.description || ""}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { label: department?.name || "مشروع التكافل الاجتماعي" },
          ]}
          stats={[
            { key: "members", label: "إجمالي العضوية", value: memberCount },
            { key: "financial", label: "سجلات مالية", value: financialCount },
          ]}
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="project-hub-error">{error}</div>
        )}

        <section data-testid="project-hub-grid-section">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500" data-testid="project-hub-section-title">
            <ShieldCheck className="h-4 w-4 text-[#0f3a73]" />
            <span>بوابات المشروع</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2" data-testid="project-hub-grid">
            {gateways.map((gw) => (
              <GatewayCard
                key={gw.key}
                testIdKey={gw.key}
                to={gw.to}
                label={gw.label}
                description={gw.description}
                icon={gw.icon}
                accent={gw.accent}
                count={gw.count}
                countSuffix={gw.countSuffix}
              />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
