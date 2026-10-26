import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, FileSpreadsheet, Building2, Users, AlertTriangle } from "lucide-react";
import AppShell from "../components/AppShell";
import { Button } from "../components/ui/button";

/**
 * Disclosure-statement gateway page.
 *
 * Four printable A4 reports — the operator picks one and lands on the
 * corresponding /print/* route which contains its own date / governorate
 * inputs and the browser-print layout.
 */
const cards = [
  { to: "gov-detailed", title: "التقرير المالي المفصّل للمحافظة", desc: "كل سجل اشتراك تم تحصيله في الفترة لمحافظة محددة", icon: FileSpreadsheet, color: "from-blue-500 to-blue-700" },
  { to: "committee-detailed", title: "التقرير المالي المفصّل للجنة", desc: "نفس تفاصيل التقرير لمحافظة، لكن محصور بلجنة واحدة فقط", icon: FileSpreadsheet, color: "from-sky-500 to-sky-700" },
  { to: "gov-summary", title: "التقرير المالي للمحافظة (ملخّص)", desc: "ملخص حجم العضوية والمحصّل والمستحق لكل لجنة في المحافظة", icon: Building2, color: "from-emerald-500 to-emerald-700" },
  { to: "membership-overall", title: "تقرير العضوية العام", desc: "أعداد العضوية لكل محافظة + إجمالي عام", icon: Users, color: "from-amber-500 to-amber-700" },
  { to: "membership-detailed", title: "تقرير العضوية المفصّل", desc: "أعداد العضوية لكل لجنة داخل كل محافظة + إجماليات", icon: FileText, color: "from-rose-500 to-rose-700" },
  { to: "gov-overdue", title: "المستحقات المتأخرة للمحافظة", desc: "تقرير لجنة بلجنة داخل محافظة محددة بالمتأخر وعدد شهور التأخر", icon: AlertTriangle, color: "from-orange-500 to-orange-700" },
  { to: "all-govs-overdue", title: "المستحقات المتأخرة لجميع المحافظات", desc: "تقرير تفصيلي لكل المحافظات واللجان مع الإجماليات", icon: AlertTriangle, color: "from-red-500 to-red-700" },
  { to: "committee-overdue", title: "المستحقات المتأخرة للجنة", desc: "تقرير متأخرات لجنة واحدة محددة", icon: AlertTriangle, color: "from-pink-500 to-pink-700" },
];

export default function DisclosureReportsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  return (
    <AppShell>
      <div className="space-y-6" dir="rtl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-950">الكشوف التفريغية</h1>
            <p className="text-sm text-slate-500">تقارير قابلة للطباعة على ورق A4 مع ترقيم تلقائي للصفحات.</p>
          </div>
          <Button variant="outline" onClick={() => nav(`/project/${id}/financial`)} data-testid="disclosure-back-btn">← رجوع للموقف المالي</Button>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.to}
                type="button"
                onClick={() => nav(`/project/${id}/financial/disclosure/${c.to}`)}
                className="group text-start rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                data-testid={`disclosure-card-${c.to}`}
              >
                <div className={`mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${c.color} text-white shadow`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-950">{c.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{c.desc}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-slate-700 group-hover:text-[#0f3a73]">
                  افتح التقرير ←
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
