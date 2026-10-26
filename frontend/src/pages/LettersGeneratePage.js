import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckSquare, FileText, Loader2, MailPlus, Printer, Square } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api, getErrorMessage } from "../lib/api";

const currentYear = () => new Date().getFullYear();
const ymOf = (y, m) => `${y}-${String(m).padStart(2, "0")}`;

export default function LettersGeneratePage() {
  const { id } = useParams();
  const [department, setDepartment] = useState(null);
  const [governorates, setGovernorates] = useState([]);
  const [committeesByGov, setCommitteesByGov] = useState({});
  const [governorate, setGovernorate] = useState("");
  const [selectedCommittees, setSelectedCommittees] = useState([]);
  const [year, setYear] = useState(String(currentYear() - 1));
  const [fromMonth, setFromMonth] = useState(ymOf(currentYear() - 1, 1));
  const [toMonth, setToMonth] = useState(ymOf(currentYear() - 1, 12));
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: deps }, { data: cls }] = await Promise.all([
          api.get("/departments"),
          api.get(`/classifications?department_id=${id}`),
        ]);
        setDepartment(deps.find((d) => d.id === id) || null);
        setGovernorates(cls.governorates || []);
        setCommitteesByGov(cls.committees_by_governorate || {});
      } catch (err) { setError(getErrorMessage(err)); }
    })();
  }, [id]);

  // Auto-sync from/to with year
  useEffect(() => {
    if (year && /^\d{4}$/.test(year)) {
      setFromMonth(`${year}-01`);
      setToMonth(`${year}-12`);
    }
  }, [year]);

  const committeesOfGov = useMemo(() => (governorate ? committeesByGov[governorate] || [] : []), [governorate, committeesByGov]);

  const toggleCommittee = (c) => {
    setSelectedCommittees((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };
  const selectAll = () => setSelectedCommittees(committeesOfGov);
  const clearAll = () => setSelectedCommittees([]);

  const generate = async () => {
    if (!governorate && selectedCommittees.length) { setError("اختر المحافظة أولاً"); return; }
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({
        department_id: id,
        from_month: fromMonth,
        to_month: toMonth,
        year_label: year,
        issue_date: issueDate,
      });
      if (governorate) params.set("governorate", governorate);
      if (selectedCommittees.length) params.set("committees", selectedCommittees.join(","));
      // Use token in URL fetch with auth
      const token = localStorage.getItem("archive_token");
      const url = `${api.defaults.baseURL}/letters/generate?${params.toString()}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const html = await res.text();
      const w = window.open("", "_blank");
      if (!w) { setError("المتصفح حظر النافذة المنبثقة. اسمح بالنوافذ المنبثقة لهذا الموقع."); return; }
      w.document.write(html); w.document.close();
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <AppShell title="توليد خطابات اللجان">
      <div className="space-y-7" data-testid="letters-generate-page">
        <GatewayHero
          icon={MailPlus}
          badge=""
          title="توليد خطابات اللجان"
          subtitle={`توليد خطابات رسمية للجان ${department?.name || "المشروع"} مع بيانات حجم العضوية وفرق المستحقات تلقائيًا.`}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { to: `/project/${id}/financial`, label: "الموقف المالي" },
            { to: `/project/${id}/financial/letters`, label: "الخطابات" },
            { label: "توليد خطاب" },
          ]}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5" data-testid="letters-form">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">السنة المالية (تظهر في نص الخطاب)</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} data-testid="letters-year" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">من شهر</Label>
              <Input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} data-testid="letters-from" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">إلى شهر</Label>
              <Input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} data-testid="letters-to" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">تاريخ تحرير الخطاب</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} data-testid="letters-issue-date" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-slate-600">المحافظة</Label>
            <select
              value={governorate}
              onChange={(e) => { setGovernorate(e.target.value); setSelectedCommittees([]); }}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm md:max-w-md"
              data-testid="letters-gov"
            >
              <option value="">كل المحافظات (يولّد لكل لجنة على مستوى المشروع)</option>
              {governorates.map((g) => (<option key={g} value={g}>{g}</option>))}
            </select>
          </div>

          {governorate && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-950">اللجان النقابية في {governorate}</h3>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={selectAll} data-testid="letters-select-all">تحديد الكل</Button>
                  <Button size="sm" variant="outline" onClick={clearAll} data-testid="letters-clear-all">إلغاء التحديد</Button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {committeesOfGov.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleCommittee(c)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-start text-sm transition ${
                      selectedCommittees.includes(c)
                        ? "border-[#0f3a73] bg-[#0f3a73]/5 text-[#0f3a73] font-bold"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    data-testid={`letters-com-${c}`}
                  >
                    {selectedCommittees.includes(c) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-400" />}
                    {c}
                  </button>
                ))}
                {!committeesOfGov.length && (
                  <p className="text-xs text-slate-500">لا توجد لجان مسجلة في هذه المحافظة.</p>
                )}
              </div>
              {selectedCommittees.length === 0 && committeesOfGov.length > 0 && (
                <p className="mt-2 text-[11px] text-slate-500">لم تحدد أي لجنة → سيولّد الخطاب لجميع لجان {governorate}.</p>
              )}
            </div>
          )}

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="letters-error">{error}</div>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={busy} className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="letters-generate-btn">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              توليد وفتح الخطابات للطباعة
            </Button>
            <span className="self-center text-[11px] text-slate-500"><FileText className="inline h-3.5 w-3.5 ms-1" /> ستُفتح صفحة جديدة بحجم A4 جاهزة للطباعة.</span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
