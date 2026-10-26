import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BarChart3, Building2, CalendarRange, FileSpreadsheet, HandCoins, Loader2, Printer, RefreshCcw, Tag } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api, downloadFile, getErrorMessage } from "../lib/api";

const today = () => new Date().toISOString().slice(0, 10);
const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); };
const fmtNum = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AID_TYPES = ["", "وفاة", "عجز كلي أو جزئي منهي للخدمة"];

export default function AidsReportPage() {
  const { id } = useParams();
  const [department, setDepartment] = useState(null);
  const [fromDate, setFromDate] = useState(monthsAgo(12));
  const [toDate, setToDate] = useState(today());
  const [governorate, setGovernorate] = useState("");
  const [aidType, setAidType] = useState("");
  const [governorateOptions, setGovernorateOptions] = useState([]);
  const [data, setData] = useState({ totals: {}, by_governorate: [], by_aid_type: [], by_month: [], rows: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ department_id: id, from_date: fromDate, to_date: toDate });
      if (governorate) params.set("governorate", governorate);
      if (aidType) params.set("aid_type", aidType);
      const { data: res } = await api.get(`/aids/report?${params.toString()}`);
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
        await load();
      } catch (err) { setError(getErrorMessage(err)); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const printReport = () => {
    const html = renderReportHtml(department?.name || "المشروع", data, { fromDate, toDate, governorate, aidType });
    const w = window.open("", "_blank");
    if (!w) { setError("المتصفح حظر النافذة المنبثقة."); return; }
    w.document.write(html); w.document.close();
  };

  const exportExcel = async () => {
    try {
      const params = new URLSearchParams({ department_id: id, from_date: fromDate, to_date: toDate });
      if (governorate) params.set("governorate", governorate);
      if (aidType) params.set("aid_type", aidType);
      await downloadFile(`/exports/aids-report?${params.toString()}`, `aids-report-${fromDate}-${toDate}.xlsx`);
    } catch (err) { setError(getErrorMessage(err)); }
  };

  const totals = data.totals || {};

  return (
    <AppShell title="تقرير الإعانات" subtitle="تقرير دوري بإجمالي الإعانات المصروفة حسب الفترة والمحافظة والنوع.">
      <div className="space-y-7" data-testid="aids-report-page">
        <GatewayHero
          icon={BarChart3}
          badge="تقرير محاسبي"
          title="تقرير الإعانات المصروفة"
          subtitle={`إجمالي وتوزيعات الإعانات المصروفة لأعضاء ${department?.name || "المشروع"}.`}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { to: `/project/${id}/financial`, label: "الموقف المالي" },
            { to: `/project/${id}/financial/aid`, label: "الإعانات" },
            { label: "التقرير الدوري" },
          ]}
          stats={[
            { key: "count", label: "عدد الإعانات", value: totals.count || 0 },
            { key: "amount", label: "إجمالي المصروف (ج.م)", value: fmtNum(totals.amount) },
            { key: "benef", label: "إجمالي المستفيدين", value: totals.beneficiaries || 0 },
          ]}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="aids-report-filters">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600">
            <CalendarRange className="h-4 w-4 text-[#0f3a73]" />
            معايير التقرير
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">من تاريخ</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} data-testid="aids-report-from" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">إلى تاريخ</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} data-testid="aids-report-to" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">المحافظة</Label>
              <select value={governorate} onChange={(e) => setGovernorate(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="aids-report-gov">
                <option value="">كل المحافظات</option>
                {governorateOptions.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">نوع الإعانة</Label>
              <select value={aidType} onChange={(e) => setAidType(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="aids-report-type">
                {AID_TYPES.map((t) => (<option key={t || "all"} value={t}>{t || "كل الأنواع"}</option>))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={load} disabled={busy} data-testid="aids-report-recalc" className="flex-1">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} تحديث
              </Button>
              <Button
                variant="outline"
                onClick={() => { setGovernorate(""); setAidType(""); }}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                data-testid="aids-report-clear-filters"
                title="عرض كافة البيانات بدون تصفية"
              >
                إلغاء التصفية
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={printReport} className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="aids-report-print">
              <Printer className="h-4 w-4" /> طباعة A4
            </Button>
            <Button onClick={exportExcel} variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" data-testid="aids-report-excel">
              <FileSpreadsheet className="h-4 w-4" /> تصدير Excel
            </Button>
          </div>
        </section>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="aids-report-error">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-2">
          <ReportTable
            title="حسب المحافظة"
            icon={Building2}
            rows={data.by_governorate || []}
            testIdKey="gov"
            totalAmount={totals.amount || 0}
            totalCount={totals.count || 0}
          />
          <ReportTable
            title="حسب نوع الإعانة"
            icon={Tag}
            rows={data.by_aid_type || []}
            testIdKey="type"
            totalAmount={totals.amount || 0}
            totalCount={totals.count || 0}
          />
        </div>

        <ReportTable
          title="حسب الشهر"
          icon={CalendarRange}
          rows={data.by_month || []}
          testIdKey="month"
          totalAmount={totals.amount || 0}
          totalCount={totals.count || 0}
        />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="aids-report-rows-section">
          <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-950"><HandCoins className="h-5 w-5 text-[#0f3a73]" /> تفاصيل الإعانات المصروفة</h2>
            <p className="text-xs text-slate-500">{(data.rows || []).length} سجل</p>
          </div>
          <div className="overflow-x-auto">
            <Table data-testid="aids-report-rows">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-start">نوع الإعانة</TableHead>
                  <TableHead className="text-start">اسم العضو</TableHead>
                  <TableHead className="text-start">المحافظة</TableHead>
                  <TableHead className="text-start">اللجنة</TableHead>
                  <TableHead className="text-start">رقم الشيك</TableHead>
                  <TableHead className="text-start">تاريخ الشيك</TableHead>
                  <TableHead className="text-start">البنك</TableHead>
                  <TableHead className="text-start">المبلغ (ج.م)</TableHead>
                  <TableHead className="text-start">عدد المستفيدين</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.rows || []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><span className="text-xs font-bold text-slate-700">{r.aid_type}</span></TableCell>
                    <TableCell className="font-bold">{r.member_name}</TableCell>
                    <TableCell>{r.member_governorate}</TableCell>
                    <TableCell>{r.member_union_committee}</TableCell>
                    <TableCell className="tabular-nums">{r.cheque_number}</TableCell>
                    <TableCell className="tabular-nums">{r.cheque_date}</TableCell>
                    <TableCell>{r.cheque_bank}</TableCell>
                    <TableCell className="tabular-nums font-bold text-emerald-700">{fmtNum(r.amount)}</TableCell>
                    <TableCell className="tabular-nums">{(r.beneficiaries || []).length}</TableCell>
                  </TableRow>
                ))}
                {(!data.rows || !data.rows.length) && (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-slate-500" data-testid="aids-report-empty">لا توجد إعانات مصروفة ضمن المعايير المحددة.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ReportTable({ title, icon: Icon, rows, testIdKey, totalAmount, totalCount }) {
  const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid={`aids-report-table-${testIdKey}`}>
      <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-950"><Icon className="h-4 w-4 text-[#0f3a73]" /> {title}</h3>
        <p className="text-xs text-slate-500">{rows.length} مجموعة</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-start">الاسم</TableHead>
              <TableHead className="text-start">العدد</TableHead>
              <TableHead className="text-start">المبلغ (ج.م)</TableHead>
              <TableHead className="text-start">النسبة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const pct = totalAmount > 0 ? ((r.amount / totalAmount) * 100).toFixed(1) : "0.0";
              return (
                <TableRow key={r.name} data-testid={`aids-report-${testIdKey}-row-${r.name}`}>
                  <TableCell className="font-bold text-slate-950">{r.name}</TableCell>
                  <TableCell className="tabular-nums">{r.count}</TableCell>
                  <TableCell className="tabular-nums text-emerald-700 font-bold">{fmt(r.amount)}</TableCell>
                  <TableCell className="tabular-nums">{pct}%</TableCell>
                </TableRow>
              );
            })}
            {!rows.length && (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-slate-500">لا توجد بيانات.</TableCell></TableRow>
            )}
            {rows.length > 0 && (
              <TableRow className="bg-[#0f3a73]/5 font-extrabold">
                <TableCell className="text-end">الإجمالي</TableCell>
                <TableCell className="tabular-nums">{totalCount}</TableCell>
                <TableCell className="tabular-nums text-emerald-700">{fmt(totalAmount)}</TableCell>
                <TableCell className="tabular-nums">100.0%</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function renderReportHtml(deptName, data, filters) {
  const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totals = data.totals || {};
  const block = (title, rows) => `
    <h3>${title}</h3>
    <table><thead><tr><th>الاسم</th><th>العدد</th><th>المبلغ (ج.م)</th><th>النسبة</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${r.name}</td><td class="num">${r.count}</td><td class="num">${fmt(r.amount)}</td><td class="num">${totals.amount > 0 ? ((r.amount/totals.amount)*100).toFixed(1) : "0.0"}%</td></tr>`).join("") || `<tr><td colspan="4">لا توجد بيانات.</td></tr>`}</tbody>
    <tfoot><tr><td>الإجمالي</td><td class="num">${totals.count || 0}</td><td class="num">${fmt(totals.amount)}</td><td class="num">100.0%</td></tr></tfoot>
    </table>
  `;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
  <title>تقرير الإعانات المصروفة - ${deptName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family:'Cairo','Tahoma',sans-serif; margin:0; padding:18px; color:#111; }
    h1 { color:#0f3a73; font-size:20px; margin:0; }
    h2 { color:#0f3a73; font-size:14px; margin:4px 0 12px; font-weight:600; }
    h3 { color:#0f3a73; font-size:13px; margin:14px 0 6px; }
    .meta { display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; font-size:12px; color:#444; margin-bottom:10px; border-top:1px solid #ccc; border-bottom:1px solid #ccc; padding:6px 0; }
    .summary { display:grid; grid-template-columns: repeat(3,1fr); gap:10px; margin-bottom:14px; }
    .card { border:1px solid #cbd5e1; border-radius:8px; padding:10px 12px; background:#f8fafc; }
    .card .lbl { font-size:11px; color:#475569; }
    .card .val { font-size:16px; font-weight:800; color:#0f3a73; font-variant-numeric: tabular-nums; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:6px; }
    th, td { border:1px solid #94a3b8; padding:5px 7px; text-align:center; }
    th { background:#e8eef7; color:#0f3a73; font-weight:700; }
    td.num { font-variant-numeric: tabular-nums; }
    tfoot td { background:#f1f5f9; font-weight:800; }
    .actions { position:fixed; top:8px; left:8px; }
    .actions button { background:#0f3a73; color:#fff; border:0; border-radius:6px; padding:8px 12px; font-weight:700; cursor:pointer; font-family: inherit; }
    @media print { .actions { display:none; } }
  </style></head><body>
  <div class="actions"><button onclick="window.print()">طباعة</button> <button onclick="window.close()" style="background:#1f2937; margin-inline-start:8px;">إغلاق</button></div>
  <h1>تقرير الإعانات المصروفة</h1>
  <h2>${deptName}</h2>
  <div class="meta">
    <span>من: <strong>${filters.fromDate || "—"}</strong> إلى: <strong>${filters.toDate || "—"}</strong></span>
    ${filters.governorate ? `<span>المحافظة: <strong>${filters.governorate}</strong></span>` : ""}
    ${filters.aidType ? `<span>نوع الإعانة: <strong>${filters.aidType}</strong></span>` : ""}
  </div>
  <div class="summary">
    <div class="card"><div class="lbl">عدد الإعانات</div><div class="val">${totals.count || 0}</div></div>
    <div class="card"><div class="lbl">إجمالي المصروف</div><div class="val">${fmt(totals.amount)} ج.م</div></div>
    <div class="card"><div class="lbl">إجمالي المستفيدين</div><div class="val">${totals.beneficiaries || 0}</div></div>
  </div>
  ${block("التوزيع حسب المحافظة", data.by_governorate || [])}
  ${block("التوزيع حسب نوع الإعانة", data.by_aid_type || [])}
  ${block("التوزيع حسب الشهر", data.by_month || [])}
  </body></html>`;
}
