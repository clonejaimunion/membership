import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, FileSpreadsheet, HandCoins, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api, downloadFile, getErrorMessage } from "../lib/api";

const fmtNum = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const aidTypeBadge = (t) =>
  t === "وفاة"
    ? "bg-slate-200 text-slate-700 border-slate-300"
    : "bg-purple-100 text-purple-700 border-purple-200";

export default function AidDisbursedPage() {
  const { id } = useParams();
  const [department, setDepartment] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const params = new URLSearchParams({ department_id: id, status: "disbursed" });
    if (search.trim()) params.set("search", search.trim());
    const { data } = await api.get(`/aids?${params.toString()}`);
    setItems(data);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: deps } = await api.get("/departments");
        setDepartment(deps.find((d) => d.id === id) || null);
        await load();
      } catch (err) { setError(getErrorMessage(err)); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => { load().catch((err) => setError(getErrorMessage(err))); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totals = useMemo(() => {
    const total_amount = items.reduce((s, it) => s + Number(it.amount || 0), 0);
    return { count: items.length, total_amount };
  }, [items]);

  const currentUser = JSON.parse(localStorage.getItem("archive_user") || "{}");
  const isAdmin = currentUser.role === "super_admin" || currentUser.role === "admin";

  const restoreMember = async (aid) => {
    const memberName = aid.member_name || "العضو";
    if (!isAdmin) {
      toast.error("هذه العملية متاحة للأدمن فقط على الإعانات المصروفة");
      return;
    }
    if (!window.confirm(`تحذير ⚠️\n\nستقوم بإلغاء إعانة مصروفة وردّ ${memberName} لحالة "فعّال".\n\nمبلغ الإعانة: ${fmtNum(aid.amount)} ج.م\nرقم الشيك: ${aid.cheque_number || "-"}\n\nهل تريد المتابعة؟`)) return;
    const tId = toast.loading(`جاري التنفيذ — استرجاع ${memberName}...`);
    try {
      const { data } = await api.post(`/aids/${aid.id}/restore-member`);
      toast.success(data.message || "تم استرجاع العضو", { id: tId, duration: 3500 });
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
      setError(getErrorMessage(err));
    }
  };

  const deleteAid = async (aid) => {
    const memberName = aid.member_name || "العضو";
    if (!isAdmin) return;
    if (!window.confirm(`⚠️ ستقوم بحذف إعانة مصروفة نهائياً\n\nالعضو: ${memberName}\nالمبلغ: ${fmtNum(aid.amount)} ج.م\nرقم الشيك: ${aid.cheque_number || "-"}\n\nملاحظة: لن يتم استرجاع العضو لحالة "فعّال" (يبقى متوفي/عجز).\n\nمتابعة؟`)) return;
    const tId = toast.loading("جاري التنفيذ — حذف الإعانة المصروفة...");
    try {
      await api.delete(`/aids/${aid.id}`);
      toast.success("تم حذف سجل الإعانة المصروفة", { id: tId, duration: 2000 });
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
      setError(getErrorMessage(err));
    }
  };

  const recalcAid = async (aid) => {
    const memberName = aid.member_name || "العضو";
    const tId = toast.loading(`جاري إعادة احتساب مستحقات ${memberName}...`);
    try {
      const { data } = await api.post(`/aids/${aid.id}/recalculate`);
      const dues = data?.committee_dues || {};
      const owed = Number(dues.owed_amount || 0);
      setItems((prev) => prev.map((it) => (
        it.id === aid.id ? { ...it, ...(data?.aid || {}), committee_dues: dues } : it
      )));
      toast.success(
        owed > 0
          ? `تم التحديث — مديونية حالية ${fmtNum(owed)} ج.م`
          : "تم التحديث — لا توجد متأخرات على هذا العضو.",
        { id: tId, duration: 3500 },
      );
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
      setError(getErrorMessage(err));
    }
  };

  return (
    <AppShell title="إعانات تم صرفها" subtitle="أرشيف الإعانات التي تم اعتمادها وصرفها للمستحقين.">
      <div className="space-y-7" data-testid="aid-disbursed-page">
        <GatewayHero
          icon={CheckCircle2}
          badge="بوابة فرعية"
          title="إعانات تم صرفها"
          subtitle={`أرشيف الإعانات المصروفة لأعضاء ${department?.name || "المشروع"} والمستفيدين منها.`}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { to: `/project/${id}/financial`, label: "الموقف المالي" },
            { to: `/project/${id}/financial/aid`, label: "الإعانات" },
            { label: "تم صرفها" },
          ]}
          stats={[
            { key: "count", label: "عدد الإعانات المصروفة", value: totals.count },
            { key: "amount", label: "إجمالي المصروف (ج.م)", value: fmtNum(totals.total_amount) },
          ]}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
              <HandCoins className="h-4 w-4 text-[#0f3a73]" />
              سجل الإعانات المصروفة
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => downloadFile(`/exports/aids?department_id=${id}&status=disbursed`, `aids-disbursed-${id.slice(0,8)}.xlsx`).catch((e) => setError(getErrorMessage(e)))} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" data-testid="aid-disbursed-export">
                <FileSpreadsheet className="h-4 w-4" /> تصدير Excel
              </Button>
              <div className="relative w-full max-w-xs">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="بحث بالاسم/الرقم القومي/رقم العضوية"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pe-9"
                  data-testid="aid-disbursed-search"
                />
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="aid-disbursed-error">{error}</div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <Table data-testid="aid-disbursed-table">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-start">نوع الإعانة</TableHead>
                  <TableHead className="text-start">اسم العضو</TableHead>
                  <TableHead className="text-start">الرقم القومي</TableHead>
                  <TableHead className="text-start">رقم العضوية</TableHead>
                  <TableHead className="text-start">المحافظة</TableHead>
                  <TableHead className="text-start">اللجنة النقابية</TableHead>
                  <TableHead className="text-start">رقم الشيك</TableHead>
                  <TableHead className="text-start">تاريخ الشيك</TableHead>
                  <TableHead className="text-start">على بنك</TableHead>
                  <TableHead className="text-start">المبلغ (ج.م)</TableHead>
                  <TableHead className="text-start">المستفيدون</TableHead>
                  <TableHead className="text-start">مستحقات اللجنة</TableHead>
                  <TableHead className="text-start">تاريخ الصرف</TableHead>
                  <TableHead className="text-start">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const dues = it.committee_dues || {};
                  const owed = Number(dues.owed_amount || 0);
                  return (
                  <TableRow key={it.id} data-testid={`aid-disbursed-row-${it.id}`}>
                    <TableCell><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${aidTypeBadge(it.aid_type)}`}>{it.aid_type}</span></TableCell>
                    <TableCell className="font-bold text-slate-950">{it.member_name || "-"}</TableCell>
                    <TableCell className="tabular-nums">{it.member_national_id || "-"}</TableCell>
                    <TableCell className="tabular-nums">{it.member_membership_number || "-"}</TableCell>
                    <TableCell>{it.member_governorate || "-"}</TableCell>
                    <TableCell>{it.member_union_committee || "-"}</TableCell>
                    <TableCell className="tabular-nums font-bold">{it.cheque_number || "-"}</TableCell>
                    <TableCell className="tabular-nums">{it.cheque_date || "-"}</TableCell>
                    <TableCell>{it.cheque_bank || "-"}</TableCell>
                    <TableCell className="tabular-nums font-bold text-emerald-700">{fmtNum(it.amount)}</TableCell>
                    <TableCell>
                      {(it.beneficiaries || []).length > 0 ? (
                        <ul className="list-decimal space-y-0.5 ps-5 text-xs">
                          {(it.beneficiaries || []).map((b, idx) => (<li key={idx}>{b}</li>))}
                        </ul>
                      ) : "-"}
                    </TableCell>
                    <TableCell data-testid={`aid-disb-dues-${it.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                        {owed > 0 ? (
                          <div className="space-y-0.5 leading-tight">
                            <div className="font-bold text-rose-700 tabular-nums">{fmtNum(owed)} ج.م</div>
                            <div className="text-[10px] text-slate-500 tabular-nums">{dues.from_month} → {dues.to_month}</div>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">لا توجد</span>
                        )}
                        </div>
                        <button
                          type="button"
                          onClick={() => recalcAid(it)}
                          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0f3a73]"
                          title="إعادة احتساب المستحقات من البيانات الحالية"
                          data-testid={`aid-disb-recalc-btn-${it.id}`}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{(it.disbursed_at || "").slice(0, 10) || "-"}</TableCell>
                    <TableCell data-testid={`aid-disb-actions-${it.id}`}>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50" disabled={!isAdmin} onClick={() => restoreMember(it)} data-testid={`aid-disb-restore-${it.id}`} title={isAdmin ? "رد العضو لحالة فعّال (يحذف الإعانة المصروفة)" : "متاح للأدمن فقط"}>
                          <RotateCcw className="h-3.5 w-3.5" /> رد العضو
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => deleteAid(it)} data-testid={`aid-disb-delete-${it.id}`} title="حذف الإعانة المصروفة دون تغيير حالة العضو">
                            <Trash2 className="h-3.5 w-3.5" /> حذف
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {!items.length && (
                  <TableRow>
                    <TableCell colSpan={14} className="py-10 text-center text-slate-500" data-testid="aid-disbursed-empty">
                      لا توجد إعانات مصروفة بعد.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
