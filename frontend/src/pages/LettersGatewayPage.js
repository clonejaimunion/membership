import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Inbox, Mail, MailPlus, Send } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import GatewayCard from "../components/GatewayCard";
import { api, getErrorMessage } from "../lib/api";

const subGateways = [
  { key: "letters_generate", label: "توليد خطابات اللجان", path: "generate", icon: MailPlus, accent: "emerald", description: "" },
];

export default function LettersGatewayPage() {
  const { id } = useParams();
  const [department, setDepartment] = useState(null);
  const [summary, setSummary] = useState({ counts: {} });
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: deps }, { data: sum }] = await Promise.all([
          api.get("/departments"),
          api.get(`/category-records/summary?department_id=${id}`),
        ]);
        setDepartment(deps.find((d) => d.id === id) || null);
        setSummary(sum);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    })();
  }, [id]);

  const countFor = useMemo(() => (key) => summary.counts?.[key] || 0, [summary]);
  const total = useMemo(() => subGateways.reduce((s, g) => s + countFor(g.key), 0), [countFor]);

  return (
    <AppShell title="الخطابات" subtitle="إدارة الخطابات المستلمة والمرسلة">
      <div className="space-y-7" data-testid="letters-gateway-page">
        <GatewayHero
          icon={Mail}
          badge="بوابة فرعية"
          title="الخطابات"
          subtitle={`خطابات الموقف المالي لأعضاء ${department?.name || "المشروع"} — توليد خطابات اللجان.`}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { to: `/project/${id}/financial`, label: "الموقف المالي" },
            { label: "الخطابات" },
          ]}
          stats={[{ key: "total", label: "إجمالي الخطابات", value: total }]}
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="letters-gateway-error">{error}</div>
        )}

        <section data-testid="letters-gateway-grid-section">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500" data-testid="letters-gateway-section-title">
            <Mail className="h-4 w-4 text-[#0f3a73]" />
            <span>اختر نوع الخطاب</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="letters-gateway-grid">
            {subGateways.map((gw) => (
              <GatewayCard
                key={gw.key}
                testIdKey={gw.key}
                to={`/project/${id}/financial/letters/${gw.path}`}
                label={gw.label}
                description={gw.description}
                icon={gw.icon}
                accent={gw.accent}
                count={gw.key === "letters_generate" ? null : countFor(gw.key)}
                countSuffix={gw.key === "letters_generate" ? "" : "خطاب"}
              />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
