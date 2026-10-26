import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeDollarSign, FileBarChart2, FileMinus, FolderArchive, HandCoins, Mail, ReceiptText, Scale, ScrollText, UserMinus, Wallet } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import GatewayCard from "../components/GatewayCard";
import { api, getErrorMessage } from "../lib/api";

const gateways = [
  { key: "pension", label: "المعاش", path: "pension", icon: BadgeDollarSign, accent: "emerald", description: "" },
  { key: "resignations", label: "استقالات", path: "resignations", icon: FileMinus, accent: "amber", description: "" },
  { key: "dropout", label: "إسقاط", path: "dropout", icon: UserMinus, accent: "rose", description: "" },
  { key: "letters", label: "الخطابات", path: "letters", icon: Mail, accent: "sky", description: "" },
  { key: "subscriptions", label: "الاشتراكات", path: "subscriptions", icon: ReceiptText, accent: "blue", description: "" },
  { key: "dues_settlements", label: "تسوية المستحقات", path: "dues-settlements", icon: ScrollText, accent: "indigo", description: "" },
  { key: "aid", label: "الإعانات", path: "aid", icon: HandCoins, accent: "violet", description: "" },
  { key: "dues", label: "مستحقات اللجان", path: "dues", icon: Scale, accent: "emerald", description: "" },
  { key: "disclosure", label: "الكشوف التفريغية", path: "disclosure", icon: FileBarChart2, accent: "slate", description: "تقارير مالية وعضوية للطباعة A4" },
];

const LETTER_KEYS = ["letters_received", "letters_sent"];
const AID_KEYS = ["aid_pending", "aid_disbursed"];

export default function FinancialGatewayPage() {
  const { id } = useParams();
  const [department, setDepartment] = useState(null);
  const [summary, setSummary] = useState({ counts: {}, labels: {} });
  const [allowed, setAllowed] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: deps }, { data: sum }, { data: meData }] = await Promise.all([
          api.get("/departments"),
          api.get(`/category-records/summary?department_id=${id}`),
          api.get("/auth/me"),
        ]);
        setDepartment(deps.find((d) => d.id === id) || null);
        setSummary(sum);
        setAllowed(meData.allowed_portals || null);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    })();
  }, [id]);

  const canAccess = (key) => {
    if (!allowed) return true;
    const portalKey = `financial.${key === "aid" ? "aid" : key}`;
    return allowed.includes(portalKey);
  };
  const visibleGateways = useMemo(() => gateways.filter((g) => canAccess(g.key)), [allowed]);

  const totalRecords = useMemo(
    () => Object.values(summary.counts || {}).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [summary]
  );

  const countFor = useMemo(
    () => (key) => {
      if (key === "letters") return LETTER_KEYS.reduce((s, k) => s + (summary.counts?.[k] || 0), 0);
      if (key === "aid") return AID_KEYS.reduce((s, k) => s + (summary.counts?.[k] || 0), 0);
      return summary.counts?.[key] || 0;
    },
    [summary]
  );

  return (
    <AppShell title="الموقف المالي">
      <div className="space-y-7" data-testid="financial-gateway-page">
        <GatewayHero
          icon={Wallet}
          badge="بوابة رئيسية"
          title="الموقف المالي"
          subtitle={`إدارة قرارات الموقف المالي والخطابات الخاصة بأعضاء ${department?.name || "المشروع"}.`}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { label: "الموقف المالي" },
          ]}
          stats={[
            { key: "total", label: "إجمالي السجلات", value: totalRecords },
            { key: "gateways", label: "البوابات الفرعية", value: gateways.length },
          ]}
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="financial-gateway-error">{error}</div>
        )}

        <section data-testid="financial-gateway-grid-section">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500" data-testid="financial-gateway-section-title">
            <FolderArchive className="h-4 w-4 text-[#0f3a73]" />
            <span>البوابات الفرعية</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" data-testid="financial-gateway-grid">
            {visibleGateways.map((gw) => (
              <GatewayCard
                key={gw.key}
                testIdKey={gw.key}
                to={`/project/${id}/financial/${gw.path}`}
                label={gw.label}
                description={gw.description}
                icon={gw.icon}
                accent={gw.accent}
                count={countFor(gw.key)}
                countSuffix={gw.key === "letters" ? "خطاب" : gw.key === "subscriptions" ? "إذن" : gw.key === "aid" ? "إعانة" : gw.key === "dues" ? "لجنة" : "سجل"}
              />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
