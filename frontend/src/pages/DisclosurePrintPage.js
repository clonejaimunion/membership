import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";
import { Button } from "../components/ui/button";
import "../styles/disclosure.css";

/** Today as ISO yyyy-mm-dd. */
const today = () => new Date().toISOString().slice(0, 10);
const fmtNum = (v, dec = 2) => Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtInt = (v) => Number(v || 0).toLocaleString("ar-EG");

// Format a YYYY-MM marker for display: "2025-06" → "يونيو ٢٠٢٥".
const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const toArabicDigits = (s) => String(s).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
const fmtArabicMonth = (ym) => {
  if (!ym) return "—";
  const m = String(ym).match(/^(\d{4})-(\d{1,2})/);
  if (!m) return ym;
  const year = m[1];
  const monthIdx = Math.max(1, Math.min(12, parseInt(m[2], 10))) - 1;
  return `${AR_MONTHS[monthIdx]} ${toArabicDigits(year)}`;
};

/**
 * Splits a long row list into chunks that fit on an A4 sheet so we can
 * paginate cleanly with `page-break-after`. We use a conservative rows-per-
 * page value tuned for ~12px tables; the operator can resize if needed.
 */
const ROWS_PER_PAGE = 28;
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out.length ? out : [[]];
};

const reportMeta = {
  "gov-detailed": {
    title: "التقرير المالي المفصّل للمحافظة",
    needsDates: true,
    needsGov: true,
    needsCommittee: false,
    path: "/reports/disclosure/governorate-detailed",
  },
  "committee-detailed": {
    title: "التقرير المالي المفصّل للجنة",
    needsDates: true,
    needsGov: true,
    needsCommittee: true,
    path: "/reports/disclosure/committee-detailed",
  },
  "gov-summary": {
    title: "التقرير المالي للمحافظة (ملخّص حسب اللجنة)",
    needsDates: true,
    needsGov: true,
    path: "/reports/disclosure/governorate-summary",
  },
  "membership-overall": {
    title: "تقرير العضوية العام",
    needsDates: false,
    needsGov: false,
    path: "/reports/disclosure/membership-overall",
  },
  "membership-detailed": {
    title: "تقرير العضوية المفصّل",
    needsDates: false,
    needsGov: false,
    path: "/reports/disclosure/membership-detailed",
  },
  "gov-overdue": {
    title: "تقرير المستحقات المتأخرة للمحافظة",
    needsDates: true,
    needsGov: true,
    needsCommittee: false,
    path: "/reports/disclosure/governorate-overdue",
  },
  "all-govs-overdue": {
    title: "تقرير المستحقات المتأخرة لجميع المحافظات بالتفصيل",
    needsDates: true,
    needsGov: false,
    needsCommittee: false,
    path: "/reports/disclosure/all-governorates-overdue",
  },
  "committee-overdue": {
    title: "تقرير المستحقات المتأخرة للجنة",
    needsDates: true,
    needsGov: true,
    needsCommittee: true,
    path: "/reports/disclosure/committee-overdue",
  },
};

export default function DisclosurePrintPage() {
  const { id, kind } = useParams();
  const nav = useNavigate();
  const meta = reportMeta[kind];
  const [from, setFrom] = useState("2025-01-01");
  const [to, setTo] = useState(today());
  const [governorates, setGovernorates] = useState([]);
  const [govMap, setGovMap] = useState({});
  const [gov, setGov] = useState("");
  const [committee, setCommittee] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const departmentName = "مشروع التكافل الاجتماعي";

  // Load list of governorates for the dropdown.
  useEffect(() => {
    api.get(`/classifications?department_id=${id}`)
      .then(({ data: c }) => {
        setGovernorates(c.governorates || []);
        setGovMap(c.committees_by_governorate || {});
        if (!gov && (c.governorates || []).length) setGov(c.governorates[0]);
      })
      .catch(() => { /* non-critical */ });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the operator switches governorate, refresh the committee list and
  // reset the committee selection so we don't carry over an unrelated value.
  const committeesForGov = (govMap[gov] || []);
  useEffect(() => {
    if (meta?.needsCommittee) {
      setCommittee(committeesForGov[0] || "");
    }
  }, [gov, meta?.needsCommittee, committeesForGov.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    if (!meta) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ department_id: id });
      if (meta.needsDates) { params.set("from_date", from); params.set("to_date", to); }
      if (meta.needsGov) { params.set("governorate", gov); }
      if (meta.needsCommittee) { params.set("union_committee", committee); }
      const { data: resp } = await api.get(`${meta.path}?${params.toString()}`);
      setData(resp);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Auto-load whenever the inputs needed for this report kind are ready.
  // For reports without dates/governorate this fires immediately. For
  // committee/governorate reports we wait until the relevant dropdown has
  // been populated.
  useEffect(() => {
    if (!meta) return;
    if (meta.needsGov && !gov) return;
    if (meta.needsCommittee && !committee) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, gov, committee]);

  if (!meta) {
    return <div className="p-6 text-center text-slate-600">تقرير غير معروف</div>;
  }

  return (
    <div className="disclosure-shell">
      <div className="disclosure-toolbar print-hide">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => nav(`/project/${id}/financial/disclosure`)} data-testid="report-back-btn">← رجوع</Button>
          <strong className="text-base">{meta.title}</strong>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meta.needsGov && (
            <select value={gov} onChange={(e) => setGov(e.target.value)} data-testid="report-gov-select">
              {governorates.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          {meta.needsCommittee && (
            <select value={committee} onChange={(e) => setCommittee(e.target.value)} data-testid="report-committee-select">
              {committeesForGov.length === 0 && <option value="">— لا توجد لجان —</option>}
              {committeesForGov.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {meta.needsDates && (
            <>
              <label className="text-xs">من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="report-from-input" /></label>
              <label className="text-xs">إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="report-to-input" /></label>
            </>
          )}
          <Button size="sm" onClick={load} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700" data-testid="report-load-btn">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "تحديث"}
          </Button>
          <Button size="sm" onClick={() => window.print()} className="bg-[#0f3a73] hover:bg-[#0a2a55]" data-testid="report-print-btn">
            <Printer className="h-3 w-3" /> طباعة
          </Button>
        </div>
      </div>

      {/* Each report kind delegates to its own renderer. They all share the
          A4 sheet + page-break helpers so the print output is consistent. */}
      {kind === "gov-detailed" && <GovDetailed data={data} from={from} to={to} gov={gov} departmentName={departmentName} />}
      {kind === "committee-detailed" && <CommitteeDetailed data={data} from={from} to={to} gov={gov} committee={committee} departmentName={departmentName} />}
      {kind === "gov-summary" && <GovSummary data={data} from={from} to={to} gov={gov} departmentName={departmentName} />}
      {kind === "membership-overall" && <MembershipOverall data={data} departmentName={departmentName} />}
      {kind === "membership-detailed" && <MembershipDetailed data={data} departmentName={departmentName} />}
      {kind === "gov-overdue" && <GovOverdue data={data} from={from} to={to} gov={gov} departmentName={departmentName} />}
      {kind === "all-govs-overdue" && <AllGovsOverdue data={data} from={from} to={to} departmentName={departmentName} />}
      {kind === "committee-overdue" && <CommitteeOverdue data={data} from={from} to={to} gov={gov} committee={committee} departmentName={departmentName} />}
    </div>
  );
}

// ─── Renderers ─────────────────────────────────────────────────────────────
function ReportHeader({ title, subtitle, departmentName }) {
  return (
    <div className="a4-header">
      <h1>{title}</h1>
      <div className="meta">
        <span>الإدارة: {departmentName}</span>
        {subtitle && <span>{subtitle}</span>}
        <span>تاريخ الطباعة: {new Date().toLocaleDateString("ar-EG")}</span>
      </div>
    </div>
  );
}

function ReportFooter({ pageIndex, totalPages }) {
  return (
    <div className="a4-footer">
      <span className="page-num" data-page={`صفحة ${pageIndex} من ${totalPages}`}></span>
    </div>
  );
}

function GovDetailed({ data, from, to, gov, departmentName, title, subtitle }) {
  if (!data) return <div className="a4-sheet text-center text-slate-500">جاري التحميل...</div>;
  const pages = chunk(data.rows || [], ROWS_PER_PAGE);
  const finalSubtitle = subtitle || `محافظة: ${gov} • الفترة: ${from} → ${to}`;
  const finalTitle = title || "التقرير المالي المفصّل للمحافظة";
  return (
    <>
      {pages.map((rows, pi) => {
        const isLast = pi === pages.length - 1;
        return (
          <div className="a4-sheet" key={pi} data-testid={`sheet-${pi}`}>
            <ReportHeader title={finalTitle} subtitle={finalSubtitle} departmentName={departmentName} />
            <table className="a4-table">
              <thead>
                <tr>
                  <th style={{ width: "4%" }}>#</th>
                  <th style={{ width: "11%" }}>رقم الإذن</th>
                  <th style={{ width: "11%" }}>تاريخ الإذن</th>
                  <th style={{ width: "11%" }}>اشتراكات عن شهر</th>
                  <th>اللجنة</th>
                  <th style={{ width: "12%" }}>طريقة الدفع</th>
                  <th style={{ width: "16%" }}>مرجع الدفع</th>
                  <th style={{ width: "11%" }}>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "#94a3b8" }}>لا توجد سجلات في هذه الفترة</td></tr>
                )}
                {rows.map((r, i) => {
                  // Resolve the human-readable payment reference per method:
                  // electronic → reference / text label, cheque → cheque#
                  // (plus the cheque date on a second line when present),
                  // else dash.
                  const isElectronic = r.payment_method === "دفع الكتروني";
                  const isCheque = r.payment_method === "شيك";
                  let refCell = "—";
                  if (isElectronic) {
                    refCell = r.electronic_reference || "—";
                  } else if (isCheque) {
                    const num = r.cheque_number || "—";
                    refCell = r.cheque_date ? (
                      <div className="leading-tight">
                        <div>{num}</div>
                        <div style={{ fontSize: "10px", color: "#475569" }}>
                          تاريخ الشيك: {r.cheque_date}
                        </div>
                      </div>
                    ) : num;
                  }
                  return (
                    <tr key={r.id || i}>
                      <td className="num">{pi * ROWS_PER_PAGE + i + 1}</td>
                      <td>{r.permit_number || "—"}</td>
                      <td>{r.issued_at || "—"}</td>
                      <td>{fmtArabicMonth(r.subscription_month)}</td>
                      <td>{r.union_committee || "—"}</td>
                      <td>{r.payment_method || "—"}</td>
                      <td>{refCell}</td>
                      <td className="num">{fmtNum(r.amount)}</td>
                    </tr>
                  );
                })}
                {isLast && (
                  <tr className="grand">
                    <td colSpan={7} style={{ textAlign: "center" }}>الإجمالي العام</td>
                    <td className="num">{fmtNum(data.total)} ج.م</td>
                  </tr>
                )}
              </tbody>
            </table>
            <ReportFooter pageIndex={pi + 1} totalPages={pages.length} />
          </div>
        );
      })}
    </>
  );
}

function CommitteeDetailed({ data, from, to, gov, committee, departmentName }) {
  // Reuses the same row layout as GovDetailed — only the title and subtitle
  // change so the operator immediately sees the committee scope on the sheet.
  const subtitle = `محافظة: ${gov} • لجنة: ${committee} • الفترة: ${from} → ${to}`;
  return (
    <GovDetailed
      data={data}
      from={from}
      to={to}
      gov={gov}
      departmentName={departmentName}
      title="التقرير المالي المفصّل للجنة"
      subtitle={subtitle}
    />
  );
}

function GovSummary({ data, from, to, gov, departmentName }) {
  if (!data) return <div className="a4-sheet text-center text-slate-500">جاري التحميل...</div>;
  const pages = chunk(data.rows || [], ROWS_PER_PAGE);
  const subtitle = `محافظة: ${gov} • الفترة: ${from} → ${to} (${data.months} شهر)`;
  return (
    <>
      {pages.map((rows, pi) => {
        const isLast = pi === pages.length - 1;
        return (
          <div className="a4-sheet" key={pi} data-testid={`sheet-${pi}`}>
            <ReportHeader title="التقرير المالي للمحافظة (ملخّص حسب اللجنة)" subtitle={subtitle} departmentName={departmentName} />
            <table className="a4-table">
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>#</th>
                  <th>اللجنة</th>
                  <th style={{ width: "12%" }}>حجم العضوية</th>
                  <th style={{ width: "14%" }}>المستحق (ج.م)</th>
                  <th style={{ width: "14%" }}>المُحصَّل (ج.م)</th>
                  <th style={{ width: "14%" }}>المتبقي (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="num">{pi * ROWS_PER_PAGE + i + 1}</td>
                    <td>{r.union_committee}</td>
                    <td className="num">{fmtInt(r.members)}</td>
                    <td className="num">{fmtNum(r.expected)}</td>
                    <td className="num">{fmtNum(r.collected)}</td>
                    <td className="num">{fmtNum(r.owed)}</td>
                  </tr>
                ))}
                {isLast && (
                  <tr className="grand">
                    <td colSpan={2} style={{ textAlign: "center" }}>الإجمالي العام</td>
                    <td className="num">{fmtInt(data.totals.members)}</td>
                    <td className="num">{fmtNum(data.totals.expected)}</td>
                    <td className="num">{fmtNum(data.totals.collected)}</td>
                    <td className="num">{fmtNum(data.totals.owed)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <ReportFooter pageIndex={pi + 1} totalPages={pages.length} />
          </div>
        );
      })}
    </>
  );
}

function MembershipOverall({ data, departmentName }) {
  if (!data) return <div className="a4-sheet text-center text-slate-500">جاري التحميل...</div>;
  const pages = chunk(data.rows || [], ROWS_PER_PAGE);
  return (
    <>
      {pages.map((rows, pi) => {
        const isLast = pi === pages.length - 1;
        return (
          <div className="a4-sheet" key={pi} data-testid={`sheet-${pi}`}>
            <ReportHeader title="تقرير العضوية العام لكل المحافظات" subtitle={`${data.rows.length} محافظة`} departmentName={departmentName} />
            <table className="a4-table">
              <thead>
                <tr>
                  <th style={{ width: "10%" }}>#</th>
                  <th>المحافظة</th>
                  <th style={{ width: "25%" }}>إجمالي العضوية</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="num">{pi * ROWS_PER_PAGE + i + 1}</td>
                    <td>{r.governorate}</td>
                    <td className="num">{fmtInt(r.total)}</td>
                  </tr>
                ))}
                {isLast && (
                  <tr className="grand">
                    <td colSpan={2} style={{ textAlign: "center" }}>الإجمالي العام</td>
                    <td className="num">{fmtInt(data.grand_total.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <ReportFooter pageIndex={pi + 1} totalPages={pages.length} />
          </div>
        );
      })}
    </>
  );
}

function MembershipDetailed({ data, departmentName }) {
  if (!data) return <div className="a4-sheet text-center text-slate-500">جاري التحميل...</div>;
  // Flatten governorates + their committees into a single row list with
  // subtotal markers so we can paginate the same way as the other reports.
  const flatRows = [];
  (data.governorates || []).forEach((gov) => {
    gov.committees.forEach((c) => flatRows.push({ kind: "row", governorate: gov.governorate, ...c }));
    flatRows.push({ kind: "subtotal", governorate: gov.governorate, ...gov.subtotal });
  });
  flatRows.push({ kind: "grand", ...data.grand_total });
  const pages = chunk(flatRows, ROWS_PER_PAGE);

  return (
    <>
      {pages.map((rows, pi) => (
        <div className="a4-sheet" key={pi} data-testid={`sheet-${pi}`}>
          <ReportHeader title="تقرير العضوية المفصّل (لجان × محافظات)" subtitle={`${data.governorates.length} محافظة`} departmentName={departmentName} />
          <table className="a4-table">
            <thead>
              <tr>
                <th style={{ width: "25%" }}>المحافظة</th>
                <th>اللجنة</th>
                <th style={{ width: "20%" }}>حجم العضوية</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                if (r.kind === "subtotal") {
                  return (
                    <tr key={i} className="subtotal">
                      <td colSpan={2}>إجمالي محافظة {r.governorate}</td>
                      <td className="num">{fmtInt(r.total)}</td>
                    </tr>
                  );
                }
                if (r.kind === "grand") {
                  return (
                    <tr key={i} className="grand">
                      <td colSpan={2} style={{ textAlign: "center" }}>الإجمالي العام</td>
                      <td className="num">{fmtInt(r.total)}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={i}>
                    <td>{r.governorate}</td>
                    <td>{r.union_committee}</td>
                    <td className="num">{fmtInt(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ReportFooter pageIndex={pi + 1} totalPages={pages.length} />
        </div>
      ))}
    </>
  );
}


// ─── Late-dues (overdue) renderers ─────────────────────────────────────────
// All three follow the same column shape requested by the user:
// #, اللجنة, الفترة, حجم العضوية, المُحصَّل, المتأخر, شهور التأخر.

function GovOverdue({ data, from, to, gov, departmentName }) {
  if (!data) return <div className="a4-sheet text-center text-slate-500">جاري التحميل...</div>;
  const pages = chunk(data.rows || [], ROWS_PER_PAGE);
  const periodTxt = `من ${data.from_date} إلى ${data.to_date} (${toArabicDigits(data.months)} شهر)`;
  const subtitle = `محافظة: ${gov} • الفترة: ${from} → ${to}`;
  return (
    <>
      {pages.map((rows, pi) => {
        const isLast = pi === pages.length - 1;
        return (
          <div className="a4-sheet" key={pi} data-testid={`sheet-${pi}`}>
            <ReportHeader title="تقرير المستحقات المتأخرة للمحافظة" subtitle={subtitle} departmentName={departmentName} />
            <table className="a4-table">
              <thead>
                <tr>
                  <th style={{ width: "4%" }}>#</th>
                  <th>اللجنة</th>
                  <th style={{ width: "18%" }}>الفترة</th>
                  <th style={{ width: "10%" }}>حجم العضوية</th>
                  <th style={{ width: "13%" }}>المُحصَّل (ج.م)</th>
                  <th style={{ width: "13%" }}>المتأخر (ج.م)</th>
                  <th style={{ width: "11%" }}>شهور التأخر</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8" }}>لا توجد متأخرات في هذه الفترة</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="num">{pi * ROWS_PER_PAGE + i + 1}</td>
                    <td>{r.union_committee}</td>
                    <td className="num" style={{ fontSize: "11px" }}>{periodTxt}</td>
                    <td className="num">{fmtInt(r.members)}</td>
                    <td className="num">{fmtNum(r.collected)}</td>
                    <td className="num" style={{ color: "#b91c1c", fontWeight: 600 }}>{fmtNum(r.owed)}</td>
                    <td className="num">{fmtNum(r.owed_months, 1)}</td>
                  </tr>
                ))}
                {isLast && (
                  <tr className="grand">
                    <td colSpan={3} style={{ textAlign: "center" }}>الإجمالي العام</td>
                    <td className="num">{fmtInt(data.totals.members)}</td>
                    <td className="num">{fmtNum(data.totals.collected)}</td>
                    <td className="num">{fmtNum(data.totals.owed)}</td>
                    <td className="num">{fmtNum(data.totals.owed_months, 1)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <ReportFooter pageIndex={pi + 1} totalPages={pages.length} />
          </div>
        );
      })}
    </>
  );
}

function AllGovsOverdue({ data, from, to, departmentName }) {
  if (!data) return <div className="a4-sheet text-center text-slate-500">جاري التحميل...</div>;
  // Flatten governorate → committee + subtotals into one paginated list.
  const flat = [];
  (data.governorates || []).forEach((g) => {
    g.committees.forEach((c) => flat.push({ kind: "row", governorate: g.governorate, ...c }));
    flat.push({ kind: "subtotal", governorate: g.governorate, ...g.subtotal });
  });
  flat.push({ kind: "grand", ...data.grand_total });
  const pages = chunk(flat, ROWS_PER_PAGE);
  const periodTxt = `من ${data.from_date} إلى ${data.to_date} (${toArabicDigits(data.months)} شهر)`;
  const subtitle = `الفترة: ${from} → ${to} • عدد المحافظات: ${toArabicDigits((data.governorates || []).length)}`;
  return (
    <>
      {pages.map((rows, pi) => (
        <div className="a4-sheet" key={pi} data-testid={`sheet-${pi}`}>
          <ReportHeader title="تقرير المستحقات المتأخرة لجميع المحافظات بالتفصيل" subtitle={subtitle} departmentName={departmentName} />
          <table className="a4-table">
            <thead>
              <tr>
                <th style={{ width: "14%" }}>المحافظة</th>
                <th>اللجنة</th>
                <th style={{ width: "16%" }}>الفترة</th>
                <th style={{ width: "9%" }}>حجم العضوية</th>
                <th style={{ width: "12%" }}>المُحصَّل (ج.م)</th>
                <th style={{ width: "12%" }}>المتأخر (ج.م)</th>
                <th style={{ width: "10%" }}>شهور التأخر</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                if (r.kind === "subtotal") {
                  return (
                    <tr key={i} className="subtotal">
                      <td colSpan={3}>إجمالي محافظة {r.governorate}</td>
                      <td className="num">{fmtInt(r.members)}</td>
                      <td className="num">{fmtNum(r.collected)}</td>
                      <td className="num">{fmtNum(r.owed)}</td>
                      <td className="num">{fmtNum(r.owed_months, 1)}</td>
                    </tr>
                  );
                }
                if (r.kind === "grand") {
                  return (
                    <tr key={i} className="grand">
                      <td colSpan={3} style={{ textAlign: "center" }}>الإجمالي العام</td>
                      <td className="num">{fmtInt(r.members)}</td>
                      <td className="num">{fmtNum(r.collected)}</td>
                      <td className="num">{fmtNum(r.owed)}</td>
                      <td className="num">{fmtNum(r.owed_months, 1)}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={i}>
                    <td>{r.governorate}</td>
                    <td>{r.union_committee}</td>
                    <td className="num" style={{ fontSize: "11px" }}>{periodTxt}</td>
                    <td className="num">{fmtInt(r.members)}</td>
                    <td className="num">{fmtNum(r.collected)}</td>
                    <td className="num" style={{ color: "#b91c1c", fontWeight: 600 }}>{fmtNum(r.owed)}</td>
                    <td className="num">{fmtNum(r.owed_months, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ReportFooter pageIndex={pi + 1} totalPages={pages.length} />
        </div>
      ))}
    </>
  );
}

function CommitteeOverdue({ data, from, to, gov, committee, departmentName }) {
  if (!data) return <div className="a4-sheet text-center text-slate-500">جاري التحميل...</div>;
  const periodTxt = `من ${data.from_date} إلى ${data.to_date} (${toArabicDigits(data.months)} شهر)`;
  const subtitle = `محافظة: ${gov} • لجنة: ${committee} • الفترة: ${from} → ${to}`;
  // Single-committee → single sheet; no need to chunk.
  return (
    <div className="a4-sheet" data-testid="sheet-0">
      <ReportHeader title="تقرير المستحقات المتأخرة للجنة" subtitle={subtitle} departmentName={departmentName} />
      <table className="a4-table">
        <thead>
          <tr>
            <th>اللجنة</th>
            <th style={{ width: "22%" }}>الفترة</th>
            <th style={{ width: "13%" }}>حجم العضوية</th>
            <th style={{ width: "14%" }}>المُحصَّل (ج.م)</th>
            <th style={{ width: "14%" }}>المتأخر (ج.م)</th>
            <th style={{ width: "12%" }}>شهور التأخر</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{data.union_committee}</td>
            <td className="num" style={{ fontSize: "11px" }}>{periodTxt}</td>
            <td className="num">{fmtInt(data.members)}</td>
            <td className="num">{fmtNum(data.collected)}</td>
            <td className="num" style={{ color: "#b91c1c", fontWeight: 600 }}>{fmtNum(data.owed)}</td>
            <td className="num">{fmtNum(data.owed_months, 1)}</td>
          </tr>
          <tr className="grand">
            <td colSpan={2} style={{ textAlign: "center" }}>الإجمالي</td>
            <td className="num">{fmtInt(data.members)}</td>
            <td className="num">{fmtNum(data.collected)}</td>
            <td className="num">{fmtNum(data.owed)}</td>
            <td className="num">{fmtNum(data.owed_months, 1)}</td>
          </tr>
        </tbody>
      </table>
      <ReportFooter pageIndex={1} totalPages={1} />
    </div>
  );
}
