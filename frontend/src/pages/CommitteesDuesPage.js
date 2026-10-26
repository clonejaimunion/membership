import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Building2, Calculator, CalendarRange, FileSpreadsheet, Loader2, Plus, Printer, RefreshCcw, Scale, Trash2, X } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { api, downloadFile, getErrorMessage } from "../lib/api";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const currentYear = () => new Date().getFullYear();
const fmtNum = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PERIODS = [
  { value: "monthly", label: "شهر معيّن" },
  { value: "yearly", label: "سنة كاملة" },
  { value: "custom", label: "فترة مخصصة (من / إلى)" },
];

export default function CommitteesDuesPage() {
  const { id } = useParams();
  const [department, setDepartment] = useState(null);
  const [period, setPeriod] = useState("monthly");
  const [singleMonth, setSingleMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());
  const [fromMonth, setFromMonth] = useState(currentMonth());
  const [toMonth, setToMonth] = useState(currentMonth());
  const [governorate, setGovernorate] = useState("");
  const [governorateOptions, setGovernorateOptions] = useState([]);
  const [data, setData] = useState({ rows: [], totals: {}, governorate_totals: [], months: 0, monthly_rate: 3, from_month: "", to_month: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Prior arrears (مستحقات سابقة)
  const currentUser = JSON.parse(localStorage.getItem("archive_user") || "{}");
  const isAdmin = currentUser.role === "super_admin" || currentUser.role === "admin";
  const [priorOpen, setPriorOpen] = useState(false);
  const [priors, setPriors] = useState([]);
  const [priorForm, setPriorForm] = useState({ governorate: "", union_committee: "", period_label: "", amount: "", note: "" });
  const [priorBusy, setPriorBusy] = useState(false);
  const committeeOptions = useMemo(() => {
    const set = new Set();
    (data.rows || []).forEach((r) => r.union_committee && set.add(`${r.governorate}|${r.union_committee}`));
    return Array.from(set).map((k) => { const [g, c] = k.split("|"); return { governorate: g, union_committee: c }; });
  }, [data.rows]);

  const loadPriors = async () => {
    try {
      const { data: rows } = await api.get(`/committees/prior-arrears?department_id=${id}`);
      setPriors(rows || []);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };
  const submitPrior = async () => {
    if (!priorForm.governorate || !priorForm.union_committee || !priorForm.amount) {
      setError("الرجاء اختيار المحافظة واللجنة وإدخال المبلغ");
      return;
    }
    setPriorBusy(true);
    try {
      await api.post(`/committees/prior-arrears`, {
        department_id: id,
        governorate: priorForm.governorate.trim(),
        union_committee: priorForm.union_committee.trim(),
        period_label: priorForm.period_label.trim(),
        amount: Number(priorForm.amount),
        note: priorForm.note.trim(),
      });
      setPriorForm({ governorate: "", union_committee: "", period_label: "", amount: "", note: "" });
      await loadPriors();
      await loadDues();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPriorBusy(false);
    }
  };
  const deletePrior = async (arrearId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المستحق السابق؟")) return;
    try {
      await api.delete(`/committees/prior-arrears/${arrearId}`);
      await loadPriors();
      await loadDues();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };
  useEffect(() => { if (priorOpen) loadPriors(); }, [priorOpen]); // eslint-disable-line

  const range = useMemo(() => {
    if (period === "monthly") return { from: singleMonth, to: singleMonth };
    if (period === "yearly") return { from: `${year}-01`, to: `${year}-12` };
    return { from: fromMonth, to: toMonth };
  }, [period, singleMonth, year, fromMonth, toMonth]);

  const loadDues = async () => {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ department_id: id, from_month: range.from, to_month: range.to });
      if (governorate) params.set("governorate", governorate);
      const { data: res } = await api.get(`/committees/dues?${params.toString()}`);
      setData(res);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const [{ data: deps }, { data: cls }] = await Promise.all([
          api.get("/departments"),
          api.get(`/classifications?department_id=${id}`),
        ]);
        setDepartment(deps.find((d) => d.id === id) || null);
        setGovernorateOptions(cls.governorates || []);
        await loadDues();
      } catch (err) { setError(getErrorMessage(err)); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const printReport = () => {
    const html = renderReportHtml(department?.name || "المشروع", data, governorate);
    const w = window.open("", "_blank");
    if (!w) { setError("المتصفح حظر النافذة المنبثقة."); return; }
    w.document.write(html); w.document.close();
  };

  const printGovernorateReport = () => {
    const html = renderGovernorateReportHtml(department?.name || "المشروع", data);
    const w = window.open("", "_blank");
    if (!w) { setError("المتصفح حظر النافذة المنبثقة."); return; }
    w.document.write(html); w.document.close();
  };

  return (
    <AppShell title="مستحقات واستحقاقات اللجان" subtitle="حساب أوتوماتيكي للمدفوع والمستحق على كل لجنة نقابية.">
      <div className="space-y-7" data-testid="dues-page">
        <GatewayHero
          icon={Scale}
          badge="بوابة محاسبية"
          title="مستحقات واستحقاقات اللجان"
          subtitle={`حساب أوتوماتيكي للمستحق على كل لجنة نقابية بناءً على حجم العضوية الفعلي وما تم تحصيله في ${department?.name || "المشروع"}.`}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { to: `/project/${id}/financial`, label: "الموقف المالي" },
            { label: "مستحقات اللجان" },
          ]}
          stats={[
            { key: "expected", label: "المستحق الكلي (ج.م)", value: fmtNum(data.totals?.expected_amount) },
            { key: "paid", label: "المُحصَّل (ج.م)", value: fmtNum(data.totals?.paid_amount) },
            { key: "owed", label: "المتبقي على اللجان (ج.م)", value: fmtNum(data.totals?.owed_amount) },
          ]}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="dues-filter-section">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600">
            <CalendarRange className="h-4 w-4 text-[#0f3a73]" />
            معايير الحساب
            <span className="text-xs font-normal text-slate-400">— القيمة الاشتراك الشهري لكل عضو: <strong className="text-slate-700 tabular-nums">{data.monthly_rate || 3} ج.م</strong></span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">الفترة</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger data-testid="dues-period-select"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">{PERIODS.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            {period === "monthly" && (
              <div className="grid gap-1.5">
                <Label htmlFor="dues-month" className="text-xs font-bold text-slate-600">الشهر</Label>
                <Input id="dues-month" type="month" value={singleMonth} onChange={(e) => setSingleMonth(e.target.value)} data-testid="dues-input-month" />
              </div>
            )}
            {period === "yearly" && (
              <div className="grid gap-1.5">
                <Label htmlFor="dues-year" className="text-xs font-bold text-slate-600">السنة</Label>
                <Input id="dues-year" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} data-testid="dues-input-year" />
              </div>
            )}
            {period === "custom" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="dues-from" className="text-xs font-bold text-slate-600">من شهر</Label>
                  <Input id="dues-from" type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} data-testid="dues-input-from" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dues-to" className="text-xs font-bold text-slate-600">إلى شهر</Label>
                  <Input id="dues-to" type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} data-testid="dues-input-to" />
                </div>
              </>
            )}
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">المحافظة</Label>
              <select value={governorate} onChange={(e) => setGovernorate(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="dues-input-gov">
                <option value="">كل المحافظات</option>
                {governorateOptions.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600 opacity-0 select-none">.</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGovernorate("")}
                className="h-9 border-slate-300 text-slate-700 hover:bg-slate-50"
                data-testid="dues-clear-filters"
                title="عرض كافة المحافظات"
              >
                إلغاء التصفية
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500" data-testid="dues-range-label">الفترة المحسوبة: <strong>{range.from}</strong> إلى <strong>{range.to}</strong> ({data.months || 0} شهر)</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadDues} disabled={busy} data-testid="dues-recalc">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} إعادة الحساب
              </Button>
              <Button onClick={printReport} className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="dues-print">
                <Printer className="h-4 w-4" /> طباعة تقرير اللجان
              </Button>
              <Button onClick={printGovernorateReport} variant="outline" className="border-[#0f3a73] text-[#0f3a73] hover:bg-[#0f3a73]/5" data-testid="dues-print-governorates">
                <Printer className="h-4 w-4" /> طباعة تقرير المحافظات
              </Button>
              {isAdmin && (
                <Button variant="outline" onClick={() => setPriorOpen(true)} className="border-amber-300 text-amber-700 hover:bg-amber-50" data-testid="prior-arrears-button">
                  <Plus className="h-4 w-4" /> مستحقات سابقة
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => downloadFile(`/exports/dues?department_id=${id}&from_month=${period.from}&to_month=${period.to}`, `dues-${period.from}-${period.to}.xlsx`).catch((e) => setError(getErrorMessage(e)))}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                data-testid="dues-export-excel"
              >
                <FileSpreadsheet className="h-4 w-4" /> تصدير Excel
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="dues-error">{error}</div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="dues-gov-section">
          <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-950"><Building2 className="h-5 w-5 text-[#0f3a73]" /> الإجمالي العام موزّعاً على المحافظات</h2>
            <p className="text-xs text-slate-500" data-testid="dues-gov-count">{data.governorate_totals?.length || 0} محافظة</p>
          </div>
          <div className="overflow-x-auto">
            <Table data-testid="dues-gov-table">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-start">المحافظة</TableHead>
                  <TableHead className="text-start">عدد اللجان</TableHead>
                  <TableHead className="text-start">حجم العضوية</TableHead>
                  <TableHead className="text-start">المستحق (ج.م)</TableHead>
                  <TableHead className="text-start">المُحصَّل (ج.م)</TableHead>
                  <TableHead className="text-start">المتبقي</TableHead>
                  <TableHead className="text-start">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.governorate_totals || []).map((g) => (
                  <TableRow key={g.governorate} data-testid={`dues-gov-row-${g.governorate}`}>
                    <TableCell className="font-bold text-slate-950" data-testid={`dues-gov-name-${g.governorate}`}>{g.governorate}</TableCell>
                    <TableCell className="tabular-nums" data-testid={`dues-gov-coms-${g.governorate}`}>{g.committees_count}</TableCell>
                    <TableCell className="tabular-nums" data-testid={`dues-gov-size-${g.governorate}`}>{g.membership_size}</TableCell>
                    <TableCell className="tabular-nums" data-testid={`dues-gov-expected-${g.governorate}`}>{fmtNum(g.expected_amount)}</TableCell>
                    <TableCell className="tabular-nums text-emerald-700" data-testid={`dues-gov-paid-${g.governorate}`}>{fmtNum(g.paid_amount)}</TableCell>
                    <TableCell className="tabular-nums" data-testid={`dues-gov-balance-${g.governorate}`}>
                      {g.owed_amount > 0 ? <span className="font-bold text-rose-700">−{fmtNum(g.owed_amount)}</span> : g.credit_amount > 0 ? <span className="font-bold text-blue-700">+{fmtNum(g.credit_amount)}</span> : <span className="text-slate-500">0.00</span>}
                    </TableCell>
                    <TableCell data-testid={`dues-gov-status-${g.governorate}`}>
                      {g.owed_amount > 0 ? <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">عليها متأخرات</span> : g.credit_amount > 0 ? <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">دفع زائد</span> : <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">مسددة</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data.governorate_totals || !data.governorate_totals.length) && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-slate-500" data-testid="dues-gov-empty">لا توجد محافظات لعرضها في هذه الفترة.</TableCell>
                  </TableRow>
                )}
                {data.governorate_totals && data.governorate_totals.length > 0 && (
                  <TableRow className="bg-[#0f3a73]/5 font-extrabold" data-testid="dues-gov-totals-row">
                    <TableCell className="text-end">الإجمالي العام</TableCell>
                    <TableCell className="tabular-nums" data-testid="dues-gov-total-coms">{data.governorate_totals.reduce((s, g) => s + (g.committees_count || 0), 0)}</TableCell>
                    <TableCell className="tabular-nums" data-testid="dues-gov-total-size">{data.totals?.membership_size || 0}</TableCell>
                    <TableCell className="tabular-nums" data-testid="dues-gov-total-expected">{fmtNum(data.totals?.expected_amount)}</TableCell>
                    <TableCell className="tabular-nums text-emerald-700" data-testid="dues-gov-total-paid">{fmtNum(data.totals?.paid_amount)}</TableCell>
                    <TableCell className="tabular-nums text-rose-700" data-testid="dues-gov-total-owed">{fmtNum(data.totals?.owed_amount)}</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="dues-table-section">
          <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-950"><Calculator className="h-5 w-5 text-[#0f3a73]" /> تفاصيل المستحقات على كل لجنة</h2>
            <p className="text-xs text-slate-500" data-testid="dues-row-count">{data.rows?.length || 0} لجنة</p>
          </div>
          <div className="overflow-x-auto">
            <Table data-testid="dues-table">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-start">المحافظة</TableHead>
                  <TableHead className="text-start">اللجنة النقابية</TableHead>
                  <TableHead className="text-start">حجم العضوية</TableHead>
                  <TableHead className="text-start">المستحق (ج.م)</TableHead>
                  <TableHead className="text-start">مستحقات سابقة</TableHead>
                  <TableHead className="text-start">المُحصَّل (ج.م)</TableHead>
                  <TableHead className="text-start">المتبقي</TableHead>
                  <TableHead className="text-start">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.rows || []).map((r) => (
                  <TableRow key={`${r.governorate}-${r.union_committee}`} data-testid={`dues-row-${r.governorate}-${r.union_committee}`}>
                    <TableCell data-testid={`dues-gov-${r.governorate}-${r.union_committee}`}>{r.governorate}</TableCell>
                    <TableCell className="font-bold text-slate-950" data-testid={`dues-com-${r.governorate}-${r.union_committee}`}>{r.union_committee}</TableCell>
                    <TableCell className="tabular-nums" data-testid={`dues-size-${r.governorate}-${r.union_committee}`}>{r.membership_size}</TableCell>
                    <TableCell className="tabular-nums" data-testid={`dues-expected-${r.governorate}-${r.union_committee}`}>{fmtNum(r.expected_amount)}</TableCell>
                    <TableCell className="tabular-nums text-amber-700" data-testid={`dues-prior-${r.governorate}-${r.union_committee}`}>{r.prior_arrears > 0 ? fmtNum(r.prior_arrears) : "—"}</TableCell>
                    <TableCell className="tabular-nums text-emerald-700" data-testid={`dues-paid-${r.governorate}-${r.union_committee}`}>{fmtNum(r.paid_amount)}</TableCell>
                    <TableCell className="tabular-nums" data-testid={`dues-balance-${r.governorate}-${r.union_committee}`}>
                      {r.owed_amount > 0 ? <span className="font-bold text-rose-700">−{fmtNum(r.owed_amount)}</span> : r.credit_amount > 0 ? <span className="font-bold text-blue-700">+{fmtNum(r.credit_amount)}</span> : <span className="text-slate-500">0.00</span>}
                    </TableCell>
                    <TableCell data-testid={`dues-status-${r.governorate}-${r.union_committee}`}>
                      {r.owed_amount > 0 ? <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">عليها متأخرات</span> : r.credit_amount > 0 ? <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">دفع زائد</span> : <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">مسددة</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data.rows || !data.rows.length) && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-500" data-testid="dues-empty">لا توجد لجان لعرضها في هذه الفترة.</TableCell>
                  </TableRow>
                )}
                {data.rows && data.rows.length > 0 && (
                  <TableRow className="bg-[#0f3a73]/5 font-extrabold" data-testid="dues-totals-row">
                    <TableCell colSpan={2} className="text-end">الإجمالي</TableCell>
                    <TableCell className="tabular-nums" data-testid="dues-total-size">{data.totals?.membership_size || 0}</TableCell>
                    <TableCell className="tabular-nums" data-testid="dues-total-expected">{fmtNum(data.totals?.expected_amount)}</TableCell>
                    <TableCell className="tabular-nums text-amber-700" data-testid="dues-total-prior">{fmtNum(data.totals?.prior_arrears)}</TableCell>
                    <TableCell className="tabular-nums text-emerald-700" data-testid="dues-total-paid">{fmtNum(data.totals?.paid_amount)}</TableCell>
                    <TableCell className="tabular-nums text-rose-700" data-testid="dues-total-owed">{fmtNum(data.totals?.owed_amount)}</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Prior Arrears Dialog */}
        <Dialog open={priorOpen} onOpenChange={setPriorOpen}>
          <DialogContent className="max-w-2xl" data-testid="prior-arrears-dialog">
            <DialogHeader>
              <DialogTitle>إضافة مستحقات سابقة على لجنة</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3">
              <div>
                <Label>المحافظة</Label>
                <Input value={priorForm.governorate} onChange={(e) => setPriorForm({ ...priorForm, governorate: e.target.value })} placeholder="مثلاً: القاهرة" data-testid="prior-input-gov" />
              </div>
              <div>
                <Label>اللجنة النقابية</Label>
                <Input value={priorForm.union_committee} onChange={(e) => setPriorForm({ ...priorForm, union_committee: e.target.value })} placeholder="اسم اللجنة بالضبط كما هو مسجل" data-testid="prior-input-com" />
              </div>
              <div>
                <Label>عن الفترة (عام أو شهر)</Label>
                <Input value={priorForm.period_label} onChange={(e) => setPriorForm({ ...priorForm, period_label: e.target.value })} placeholder="مثلاً: 2022 أو 2023-05 أو ما قبل النظام" data-testid="prior-input-period" />
              </div>
              <div>
                <Label>المبلغ (ج.م)</Label>
                <Input type="number" step="0.01" min="0" value={priorForm.amount} onChange={(e) => setPriorForm({ ...priorForm, amount: e.target.value })} data-testid="prior-input-amount" />
              </div>
              <div className="md:col-span-2">
                <Label>ملاحظات</Label>
                <Input value={priorForm.note} onChange={(e) => setPriorForm({ ...priorForm, note: e.target.value })} placeholder="اختياري" data-testid="prior-input-note" />
              </div>
              {committeeOptions.length > 0 && (
                <div className="md:col-span-2 text-xs text-slate-500">
                  💡 اقتراحات سريعة:
                  <div className="mt-1 flex flex-wrap gap-1">
                    {committeeOptions.slice(0, 8).map((c, i) => (
                      <button key={i} type="button" className="rounded-md bg-slate-100 px-2 py-0.5 hover:bg-slate-200" onClick={() => setPriorForm({ ...priorForm, governorate: c.governorate, union_committee: c.union_committee })}>
                        {c.governorate} - {c.union_committee}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 border-t pt-3">
              <h3 className="font-bold mb-2 text-sm">المستحقات السابقة المسجلة</h3>
              <div className="max-h-60 overflow-y-auto text-xs">
                {priors.length === 0 ? (
                  <p className="text-slate-500">لا توجد سجلات بعد.</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr><th className="p-1 text-start">المحافظة</th><th className="p-1 text-start">اللجنة</th><th className="p-1 text-start">الفترة</th><th className="p-1 text-start">المبلغ</th><th className="p-1 text-start">ملاحظة</th><th className="p-1"></th></tr>
                    </thead>
                    <tbody>
                      {priors.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="p-1">{p.governorate}</td>
                          <td className="p-1 font-bold">{p.union_committee}</td>
                          <td className="p-1">{p.period_label || "—"}</td>
                          <td className="p-1 tabular-nums text-amber-700">{fmtNum(p.amount)}</td>
                          <td className="p-1 text-slate-600">{p.note || "—"}</td>
                          <td className="p-1"><Button size="sm" variant="ghost" className="text-red-600" onClick={() => deletePrior(p.id)} data-testid={`prior-delete-${p.id}`}><Trash2 className="h-3 w-3" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPriorOpen(false)} data-testid="prior-close"><X className="h-4 w-4" /> إغلاق</Button>
              <Button onClick={submitPrior} disabled={priorBusy} className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="prior-submit">
                {priorBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} حفظ المستحق السابق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function renderReportHtml(deptName, data, governorate) {
  const rows = (data.rows || []).map((r) => `
    <tr>
      <td>${r.governorate}</td>
      <td><strong>${r.union_committee}</strong></td>
      <td class="num">${r.membership_size}</td>
      <td class="num">${Number(r.expected_amount).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
      <td class="num">${Number(r.paid_amount).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
      <td class="num ${r.owed_amount > 0 ? "owed" : r.credit_amount > 0 ? "credit" : ""}">${r.owed_amount > 0 ? "−" + Number(r.owed_amount).toLocaleString("ar-EG", { minimumFractionDigits: 2 }) : r.credit_amount > 0 ? "+" + Number(r.credit_amount).toLocaleString("ar-EG", { minimumFractionDigits: 2 }) : "0.00"}</td>
    </tr>`).join("");
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
  <title>تقرير مستحقات اللجان - ${deptName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Cairo','Tahoma',sans-serif; margin:0; padding:18px; color:#111; }
    h1 { color:#0f3a73; font-size:20px; margin:0; }
    h2 { color:#0f3a73; font-size:14px; margin:4px 0 14px; font-weight:600; }
    .meta { display:flex; justify-content:space-between; font-size:12px; color:#444; margin-bottom:10px; border-top:1px solid #ccc; border-bottom:1px solid #ccc; padding:6px 0; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th, td { border:1px solid #94a3b8; padding:6px 8px; text-align:center; }
    th { background:#e8eef7; color:#0f3a73; font-weight:700; }
    td.num { font-variant-numeric: tabular-nums; }
    td.owed { color:#be123c; font-weight:700; }
    td.credit { color:#1d4ed8; font-weight:700; }
    tfoot td { background:#f1f5f9; font-weight:800; }
    .actions { position:fixed; top:8px; left:8px; }
    .actions button { background:#0f3a73; color:#fff; border:0; border-radius:6px; padding:8px 12px; font-weight:700; cursor:pointer; font-family: inherit; }
    @media print { .actions { display:none; } }
  </style></head><body>
  <div class="actions"><button onclick="window.print()">طباعة</button> <button onclick="window.close()" style="background:#1f2937; margin-inline-start:8px;">إغلاق</button></div>
  <h1>تقرير مستحقات واستحقاقات اللجان النقابية</h1>
  <h2>${deptName}</h2>
  <div class="meta">
    <span>الفترة: <strong>${data.from_month}</strong> إلى <strong>${data.to_month}</strong> (${data.months} شهر)</span>
    <span>قيمة الاشتراك الشهري لكل عضو: <strong>${data.monthly_rate} ج.م</strong></span>
    ${governorate ? `<span>المحافظة: <strong>${governorate}</strong></span>` : ""}
  </div>
  <table>
    <thead><tr>
      <th>المحافظة</th><th>اللجنة النقابية</th><th>حجم العضوية</th><th>المستحق (ج.م)</th><th>المُحصَّل (ج.م)</th><th>المتبقي</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="6">لا توجد بيانات.</td></tr>`}</tbody>
    <tfoot><tr>
      <td colspan="2">الإجمالي</td>
      <td class="num">${data.totals?.membership_size || 0}</td>
      <td class="num">${Number(data.totals?.expected_amount || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
      <td class="num">${Number(data.totals?.paid_amount || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
      <td class="num owed">${Number(data.totals?.owed_amount || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</td>
    </tr></tfoot>
  </table>
  </body></html>`;
}


function renderGovernorateReportHtml(deptName, data) {
  const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totals = data.governorate_totals || [];
  const rows = totals.map((g) => `
    <tr>
      <td><strong>${g.governorate}</strong></td>
      <td class="num">${g.committees_count}</td>
      <td class="num">${g.membership_size}</td>
      <td class="num">${fmt(g.expected_amount)}</td>
      <td class="num">${fmt(g.paid_amount)}</td>
      <td class="num ${g.owed_amount > 0 ? "owed" : g.credit_amount > 0 ? "credit" : ""}">${g.owed_amount > 0 ? "−" + fmt(g.owed_amount) : g.credit_amount > 0 ? "+" + fmt(g.credit_amount) : "0.00"}</td>
    </tr>`).join("");
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
  <title>تقرير إجمالي المحافظات - ${deptName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Cairo','Tahoma',sans-serif; margin:0; padding:18px; color:#111; }
    h1 { color:#0f3a73; font-size:20px; margin:0; }
    h2 { color:#0f3a73; font-size:14px; margin:4px 0 14px; font-weight:600; }
    .meta { display:flex; flex-wrap:wrap; gap:14px; justify-content:space-between; font-size:12px; color:#444; margin-bottom:12px; border-top:1px solid #ccc; border-bottom:1px solid #ccc; padding:6px 0; }
    .summary-cards { display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:14px; }
    .card { border:1px solid #cbd5e1; border-radius:8px; padding:10px 12px; background:#f8fafc; }
    .card .lbl { font-size:11px; color:#475569; margin-bottom:4px; }
    .card .val { font-size:16px; font-weight:800; color:#0f3a73; font-variant-numeric: tabular-nums; }
    table { width:100%; border-collapse:collapse; font-size:12.5px; }
    th, td { border:1px solid #94a3b8; padding:7px 8px; text-align:center; }
    th { background:#e8eef7; color:#0f3a73; font-weight:700; }
    td.num { font-variant-numeric: tabular-nums; }
    td.owed { color:#be123c; font-weight:700; }
    td.credit { color:#1d4ed8; font-weight:700; }
    tfoot td { background:#f1f5f9; font-weight:800; }
    .actions { position:fixed; top:8px; left:8px; }
    .actions button { background:#0f3a73; color:#fff; border:0; border-radius:6px; padding:8px 12px; font-weight:700; cursor:pointer; font-family: inherit; }
    @media print { .actions { display:none; } }
  </style></head><body>
  <div class="actions"><button onclick="window.print()">طباعة</button> <button onclick="window.close()" style="background:#1f2937; margin-inline-start:8px;">إغلاق</button></div>
  <h1>تقرير الإجمالي العام لمستحقات اللجان حسب المحافظات</h1>
  <h2>${deptName}</h2>
  <div class="meta">
    <span>الفترة: <strong>${data.from_month}</strong> إلى <strong>${data.to_month}</strong> (${data.months} شهر)</span>
    <span>قيمة الاشتراك الشهري لكل عضو: <strong>${data.monthly_rate} ج.م</strong></span>
    <span>عدد المحافظات: <strong>${totals.length}</strong></span>
  </div>
  <div class="summary-cards">
    <div class="card"><div class="lbl">إجمالي المستحق على جميع المحافظات</div><div class="val">${fmt(data.totals?.expected_amount)} ج.م</div></div>
    <div class="card"><div class="lbl">إجمالي المُحصَّل</div><div class="val">${fmt(data.totals?.paid_amount)} ج.م</div></div>
    <div class="card"><div class="lbl">إجمالي المتبقي</div><div class="val">${fmt(data.totals?.owed_amount)} ج.م</div></div>
  </div>
  <table>
    <thead><tr>
      <th>المحافظة</th><th>عدد اللجان</th><th>حجم العضوية</th><th>المستحق (ج.م)</th><th>المُحصَّل (ج.م)</th><th>المتبقي</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="6">لا توجد بيانات.</td></tr>`}</tbody>
    <tfoot><tr>
      <td>الإجمالي العام</td>
      <td class="num">${totals.reduce((s, g) => s + (g.committees_count || 0), 0)}</td>
      <td class="num">${data.totals?.membership_size || 0}</td>
      <td class="num">${fmt(data.totals?.expected_amount)}</td>
      <td class="num">${fmt(data.totals?.paid_amount)}</td>
      <td class="num owed">${fmt(data.totals?.owed_amount)}</td>
    </tr></tfoot>
  </table>
  </body></html>`;
}
