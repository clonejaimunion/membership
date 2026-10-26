import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BarChart3, CheckCircle2, Clock, HandCoins } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import GatewayCard from "../components/GatewayCard";
import { api, getErrorMessage } from "../lib/api";

const subGateways = [
  { key: "aid_pending", label: "إعانات في انتظار الموافقة", path: "pending", icon: Clock, accent: "amber", description: "" },
  { key: "aid_disbursed", label: "إعانات تم صرفها", path: "disbursed", icon: CheckCircle2, accent: "emerald", description: "" },
  { key: "aid_report", label: "تقرير دوري للإعانات", path: "report", icon: BarChart3, accent: "blue", description: "" },
];

export default function AidGatewayPage() {
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
  const total = useMemo(() => subGateways.filter((g) => g.key !== "aid_report").reduce((s, g) => s + countFor(g.key), 0), [countFor]);

  return (
    <AppShell title="الإعانات" subtitle="إدارة الإعانات في انتظار الموافقة وتلك التي تم صرفها">
      <div className="space-y-7" data-testid="aid-gateway-page">
        <GatewayHero
          icon={HandCoins}
          badge="بوابة فرعية"
          title="الإعانات"
          subtitle={`إعانات أعضاء ${department?.name || "المشروع"} — في انتظار الموافقة والتي تم صرفها.`}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { to: `/project/${id}/financial`, label: "الموقف المالي" },
            { label: "الإعانات" },
          ]}
          stats={[{ key: "total", label: "إجمالي الإعانات", value: total }]}
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="aid-gateway-error">{error}</div>
        )}

        <section data-testid="aid-gateway-grid-section">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500" data-testid="aid-gateway-section-title">
            <HandCoins className="h-4 w-4 text-[#0f3a73]" />
            <span>اختر نوع الإعانة</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="aid-gateway-grid">
            {subGateways.map((gw) => (
              <GatewayCard
                key={gw.key}
                testIdKey={gw.key}
                to={`/project/${id}/financial/aid/${gw.path}`}
                label={gw.label}
                description={gw.description}
                icon={gw.icon}
                accent={gw.accent}
                count={gw.key === "aid_report" ? null : countFor(gw.key)}
                countSuffix={gw.key === "aid_report" ? "" : "إعانة"}
              />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
