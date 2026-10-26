import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Banknote, CircleSlash, Clock4, Eye, FileBadge, FileSpreadsheet, Loader2, Pencil, Plus, Printer, ReceiptText, Save, Search, Trash2 } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { api, downloadFile, getErrorMessage } from "../lib/api";
import useLiveChanges from "../lib/useLiveChanges";

const PAYMENT_METHODS = ["دفع الكتروني", "شيك"];
const NOT_TAKAFUL_TARGETS = ["النقابة العامة", "جهة أخرى"];
const STATUSES = [
  { value: "تم التحصيل", label: "تم التحصيل", className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Banknote },
  { value: "تحت التحصيل", label: "تحت التحصيل", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock4 },
  { value: "لا يخص مشروع التكافل", label: "لا يخص المشروع", className: "bg-sky-100 text-sky-700 border-sky-200", icon: FileBadge },
  { value: "لاغي", label: "لاغي", className: "bg-rose-100 text-rose-700 border-rose-200", icon: CircleSlash },
];

const statusStyle = (status) => STATUSES.find((s) => s.value === status)?.className || "bg-slate-100 text-slate-700 border-slate-200";

const emptyForm = {
  permit_number: "",
  amount: "",
  governorate: "",
  union_committee: "",
  payment_method: "دفع الكتروني",
  electronic_reference: "",
  electronic_reference_kind: "number",  // "number" → unique. "text" → allowed to repeat.
  cheque_number: "",
  cheque_bank: "",
  cheque_date: "",
  subscription_month: new Date().toISOString().slice(0, 7),
  issued_at: new Date().toISOString().slice(0, 10),
  status: "تحت التحصيل",
  not_takaful_target: "",
  not_takaful_other: "",
  notes: "",
};

export default function SubscriptionsPage({ settlementMode = false } = {}) {
  const { id } = useParams();
  const [department, setDepartment] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ counts: {}, totals: {} });
  const [governorates, setGovernorates] = useState([]);
  const [committeesByGov, setCommitteesByGov] = useState({});
  const [allCommittees, setAllCommittees] = useState([]);
  const [form, setForm] = useState(() => settlementMode ? { ...emptyForm, status: "تم التحصيل" } : emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);  // null = create mode, else update mode
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialogStatus, setDialogStatus] = useState("");
  const [notTakafulOpen, setNotTakafulOpen] = useState(false);
  const [notTakafulCtx, setNotTakafulCtx] = useState({ id: "", target: "النقابة العامة", other: "" });
  // Duplicate electronic_reference detection
  const [dupOpen, setDupOpen] = useState(false);
  const [dupRecord, setDupRecord] = useState(null);
  const [dupRef, setDupRef] = useState("");
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const loadList = async () => {
    const params = new URLSearchParams({ 
      department_id: id, 
      is_dues_settlement: settlementMode ? "true" : "false",
      page: currentPage.toString(),
      page_size: pageSize.toString()
    });
    if (statusFilter) params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    const { data } = await api.get(`/subscriptions?${params.toString()}`);
    setItems(data.data || []);
    setTotal(data.total || 0);
    setTotalPages(data.total_pages || 1);
  };
  const loadSummary = async () => {
    const { data } = await api.get(`/subscriptions/summary?department_id=${id}`);
    setSummary(data);
  };

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
        setAllCommittees(cls.union_committees || []);
        await Promise.all([loadList(), loadSummary()]);
      } catch (err) { setError(getErrorMessage(err)); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => { 
      setCurrentPage(1); // Reset to page 1 when search/filter changes
      loadList().catch((err) => setError(getErrorMessage(err))); 
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  useEffect(() => {
    loadList().catch((err) => setError(getErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Live-sync: refresh the subscriptions table when a peer writes — but
  // only if the user is NOT currently editing a subscription dialog.
  useLiveChanges(["subscriptions"], () => {
    if (open) return;
    loadList().catch(() => {});
    loadSummary().catch(() => {});
    toast.info("تم تحديث الاشتراكات من مستخدم آخر", { id: "live-sync-subs", duration: 2000 });
  });

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setError(""); setDialogStatus(""); setOpen(true); };

  const openEdit = (item) => {
    setEditingId(item.id);
    // Preserve all editable fields from the record. Fall back to empty strings.
    setForm({
      permit_number: item.permit_number || "",
      amount: item.amount != null ? String(item.amount) : "",
      governorate: item.governorate || "",
      union_committee: item.union_committee || "",
      payment_method: item.payment_method || "دفع الكتروني",
      electronic_reference: item.electronic_reference || "",
      electronic_reference_kind: item.electronic_reference_kind === "text" ? "text" : "number",
      cheque_number: item.cheque_number || "",
      cheque_bank: item.cheque_bank || "",
      cheque_date: item.cheque_date || "",
      subscription_month: item.subscription_month || new Date().toISOString().slice(0, 7),
      issued_at: item.issued_at || new Date().toISOString().slice(0, 10),
      status: item.status || "تحت التحصيل",
      not_takaful_target: item.not_takaful_target || "",
      not_takaful_other: item.not_takaful_other || "",
      notes: item.notes || "",
    });
    setError(""); setDialogStatus(""); setOpen(true);
  };

  const openView = (item) => { setViewItem(item); setViewOpen(true); };

  const printRow = (item) => {
    const token = localStorage.getItem("archive_token") || "";
    const url = `${process.env.REACT_APP_BACKEND_URL || ""}/api/subscriptions/${item.id}/print`;
    // We need to send Authorization header → fetch as blob then open
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error("تعذر فتح بيان الطباعة");
        const blob = await r.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      })
      .catch((e) => toast.error(e.message || "فشل الطباعة"));
  };

  // Two save flows:
  //  • "حفظ" (Save): close dialog. Used for edit, or one-off add.
  //  • "حفظ وإضافة آخر" (Save and add another): in CREATE mode only — keeps the
  //     dialog open and clears the form so the user can keep entering records.
  //  `kindOverride` lets the duplicate-dialog "تجاهل التكرار وحفظ كنص" button
  //  flip the reference to a text-label and submit in a single click WITHOUT
  //  waiting for React's setForm to flush (state updates are asynchronous, so
  //  reading form.electronic_reference_kind right after setForm would still
  //  see the old value).
  const save = async (event, { keepOpen = false, kindOverride = null } = {}) => {
    if (event) event.preventDefault();
    setBusy(true); setError(""); setDialogStatus(editingId ? "جاري حفظ التعديلات..." : "جاري حفظ السجل...");
    const tId = toast.loading(editingId ? "جاري التنفيذ — حفظ التعديلات..." : "جاري التنفيذ — حفظ السجل...");
    try {
      const effectiveKind = kindOverride || form.electronic_reference_kind || "number";
      const payload = {
        ...form,
        department_id: id,
        amount: Number(form.amount || 0),
        is_dues_settlement: settlementMode,
        electronic_reference_kind: effectiveKind,
      };
      // Keep the form state in sync so subsequent saves remember the override.
      if (kindOverride && kindOverride !== form.electronic_reference_kind) {
        setForm((f) => ({ ...f, electronic_reference_kind: kindOverride }));
      }
      let savedRecord = null;
      if (editingId) {
        const { data } = await api.put(`/subscriptions/${editingId}`, payload);
        savedRecord = data;
      } else {
        const { data } = await api.post("/subscriptions", payload);
        savedRecord = data;
      }
      // Optimistic UI update: insert/replace the record in the table BEFORE the
      // network refetch returns. Guarantees the user sees the new row instantly
      // (no manual page reload needed) even if a cache layer or slow network
      // delays the GET response.
      if (savedRecord && savedRecord.id) {
        setItems((prev) => {
          const without = prev.filter((it) => it.id !== savedRecord.id);
          return editingId ? without.concat(savedRecord) : [savedRecord, ...without];
        });
      }
      await Promise.all([loadList(), loadSummary()]);
      toast.success(editingId ? "تم حفظ التعديلات" : "تم حفظ السجل", { id: tId, duration: 1800 });
      if (editingId || !keepOpen) {
        setOpen(false);
        setEditingId(null);
        setForm(settlementMode ? { ...emptyForm, status: "تم التحصيل" } : emptyForm);
      } else {
        // Stay in dialog: clear only the per-record fields, keep gov/committee/method for fast bulk entry
        setForm((prev) => ({
          ...emptyForm,
          // Preserve common fields to speed up consecutive entries
          governorate: prev.governorate,
          union_committee: prev.union_committee,
          payment_method: prev.payment_method,
          issued_at: prev.issued_at,
          subscription_month: prev.subscription_month,
          status: prev.status,
          // Keep the chosen reference-kind sticky across "Save & Add Another"
          // so the operator doesn't have to re-click "نص" each time they
          // enter a batch of manual-label rows.
          electronic_reference_kind: prev.electronic_reference_kind,
        }));
        setDialogStatus("");
      }
    } catch (err) {
      const responseDetail = err?.response?.data?.detail;
      if (err?.response?.status === 409 && responseDetail && typeof responseDetail === "object" && responseDetail.code === "duplicate_electronic_reference") {
        // Show the duplicate dialog with the existing record
        setDupRef(form.electronic_reference);
        setDupRecord(responseDetail.existing || null);
        setDupOpen(true);
        toast.error("رقم الدفع الإلكتروني مستخدم مسبقاً", { id: tId, duration: 3500 });
        setDialogStatus("");
      } else {
        toast.error(getErrorMessage(err), { id: tId });
        setError(getErrorMessage(err)); setDialogStatus("");
      }
    } finally { setBusy(false); }
  };

  const setStatus = async (subId, status) => {
    if (status === "لا يخص مشروع التكافل") {
      const current = items.find((it) => it.id === subId);
      setNotTakafulCtx({ id: subId, target: current?.not_takaful_target || "النقابة العامة", other: current?.not_takaful_other || "" });
      setNotTakafulOpen(true);
      return;
    }
    try {
      await api.patch(`/subscriptions/${subId}/status`, { status });
      await Promise.all([loadList(), loadSummary()]);
    } catch (err) { setError(getErrorMessage(err)); }
  };

  const confirmNotTakaful = async () => {
    const { id: subId, target, other } = notTakafulCtx;
    if (target === "جهة أخرى" && !other.trim()) {
      setError("حدد اسم الجهة الأخرى"); return;
    }
    try {
      await api.patch(`/subscriptions/${subId}/status`, { status: "لا يخص مشروع التكافل", not_takaful_target: target, not_takaful_other: target === "جهة أخرى" ? other.trim() : "" });
      setNotTakafulOpen(false); setError("");
      await Promise.all([loadList(), loadSummary()]);
    } catch (err) { setError(getErrorMessage(err)); }
  };

  const remove = async (subId) => {
    if (!window.confirm("هل تريد حذف هذا السجل؟")) return;
    try { await api.delete(`/subscriptions/${subId}`); await Promise.all([loadList(), loadSummary()]); }
    catch (err) { setError(getErrorMessage(err)); }
  };

  const totalAmount = useMemo(() => summary.totals?.total || 0, [summary]);

  const pageTitle = settlementMode ? "تسوية المستحقات" : "الاشتراكات";
  const pageSubtitle = settlementMode
    ? "تسجيل تسويات المستحقات المتراكمة — يُخصم المبلغ تلقائيًا من رصيد اللجنة."
    : "تسجيل ومتابعة اشتراكات الأعضاء وحالات التحصيل.";
  const heroBadge = settlementMode ? "تسوية" : "بوابة اشتراكات";
  const addBtnLabel = settlementMode ? "إضافة تسوية مستحقات" : "إضافة سجل اشتراك جديد";
  const dialogTitle = settlementMode ? "إضافة تسوية مستحقات" : "إضافة سجل اشتراك جديد";
  const exportFile = settlementMode ? `dues-settlements-${id.slice(0,8)}.xlsx` : `subscriptions-${id.slice(0,8)}.xlsx`;
  const exportQuery = settlementMode ? "&is_dues_settlement=true" : "";

  return (
    <AppShell title={pageTitle} subtitle={pageSubtitle}>
      <div className="space-y-7" data-testid={settlementMode ? "dues-settlements-page" : "subscriptions-page"}>
        <GatewayHero
          icon={ReceiptText}
          badge={heroBadge}
          title={pageTitle}
          subtitle={settlementMode
            ? `تسجيل التسويات المالية للجان ${department?.name || "المشروع"} — تخصم تلقائيًا من المستحقات.`
            : `تسجيل ومتابعة اشتراكات أعضاء ${department?.name || "المشروع"}.`
          }
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { to: `/project/${id}/financial`, label: "الموقف المالي" },
            { label: pageTitle },
          ]}
          stats={[
            { key: "count", label: settlementMode ? "عدد التسويات" : "إجمالي السجلات", value: items.length },
            { key: "amount", label: settlementMode ? "إجمالي المخصوم (ج.م)" : "إجمالي المبالغ (ج.م)", value: (settlementMode ? items.reduce((s, i) => s + (Number(i.amount) || 0), 0) : totalAmount).toLocaleString("ar-EG") },
          ]}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="subscriptions-toolbar">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button onClick={openAdd} className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="add-subscription-button">
              <Plus className="h-4 w-4" /> {addBtnLabel}
            </Button>
            <Button variant="outline" onClick={() => downloadFile(`/exports/subscriptions?department_id=${id}${exportQuery}`, exportFile).catch((e) => setError(getErrorMessage(e)))} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" data-testid="export-subscriptions-excel">
              <FileSpreadsheet className="h-4 w-4" /> تصدير Excel
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="subscription-status-filter">
                <option value="">كل الحالات</option>
                {STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث برقم الإذن/المحافظة/اللجنة/تفاصيل الدفع/الملاحظات" className="pe-10" data-testid="subscription-search-input" />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setStatusFilter(""); setSearch(""); }}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                data-testid="subscription-clear-filters"
                title="عرض كافة البيانات بدون تصفية"
              >
                إلغاء التصفية
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="subscription-error">{error}</div>
        )}

        {/* Status summary */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="subscription-status-summary">
          {STATUSES.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.value} className={`rounded-xl border p-4 ${s.className}`} data-testid={`subscription-stat-${s.value}`}>
                <div className="flex items-center justify-between gap-2 text-xs font-bold"><span>{s.label}</span><Icon className="h-4 w-4" /></div>
                <p className="mt-2 text-2xl font-extrabold tabular-nums">{summary.counts?.[s.value] || 0}</p>
                <p className="text-xs opacity-80 tabular-nums">{(summary.totals?.[s.value] || 0).toLocaleString("ar-EG")} ج.م</p>
              </div>
            );
          })}
        </section>

        {/* Table */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="subscriptions-table-section">
          <div className="overflow-x-auto">
            <Table data-testid="subscriptions-table">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-start">رقم الإذن</TableHead>
                  <TableHead className="text-start">المبلغ (ج.م)</TableHead>
                  <TableHead className="text-start">المحافظة</TableHead>
                  <TableHead className="text-start">اللجنة النقابية</TableHead>
                  <TableHead className="text-start">طريقة الدفع</TableHead>
                  <TableHead className="text-start">تفاصيل الدفع</TableHead>
                  <TableHead className="text-start">شهر الاشتراك</TableHead>
                  <TableHead className="text-start">تحريراً في</TableHead>
                  <TableHead className="text-start">الحالة</TableHead>
                  <TableHead className="text-start">الموظف المختص</TableHead>
                  <TableHead className="text-start">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id} className="align-top" data-testid={`subscription-row-${it.id}`}>
                    <TableCell className="font-bold text-slate-950" data-testid={`sub-permit-${it.id}`}>{it.permit_number || "-"}</TableCell>
                    <TableCell className="tabular-nums" data-testid={`sub-amount-${it.id}`}>{(it.amount || 0).toLocaleString("ar-EG")}</TableCell>
                    <TableCell data-testid={`sub-gov-${it.id}`}>{it.governorate || "-"}</TableCell>
                    <TableCell data-testid={`sub-com-${it.id}`}>{it.union_committee || "-"}</TableCell>
                    <TableCell data-testid={`sub-method-${it.id}`}>{it.payment_method || "-"}</TableCell>
                    <TableCell className="text-xs text-slate-600" data-testid={`sub-method-details-${it.id}`}>
                      {it.payment_method === "شيك" ? (
                        <div>
                          <div>شيك رقم: <strong>{it.cheque_number || "-"}</strong></div>
                          <div>البنك: {it.cheque_bank || "-"}</div>
                          <div>تاريخ الشيك: {it.cheque_date || "-"}</div>
                        </div>
                      ) : (
                        <div>مرجع: <strong>{it.electronic_reference || "-"}</strong></div>
                      )}
                    </TableCell>
                    <TableCell data-testid={`sub-month-${it.id}`}>{it.subscription_month || "-"}</TableCell>
                    <TableCell data-testid={`sub-issued-${it.id}`}>{it.issued_at || "-"}</TableCell>
                    <TableCell data-testid={`sub-status-${it.id}`}>
                      <div className="space-y-1">
                        <Select value={it.status} onValueChange={(v) => setStatus(it.id, v)}>
                          <SelectTrigger className={`h-8 min-w-[140px] border ${statusStyle(it.status)} font-bold`} data-testid={`sub-status-trigger-${it.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent dir="rtl">
                            {STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        {it.status === "لا يخص مشروع التكافل" && (
                          <p className="text-[11px] font-semibold text-sky-700">{it.not_takaful_target === "جهة أخرى" ? `جهة أخرى: ${it.not_takaful_other}` : (it.not_takaful_target || "")}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600" data-testid={`sub-by-${it.id}`}>{it.recorded_by_name || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => openView(it)} data-testid={`sub-view-${it.id}`}>
                          <Eye className="h-3.5 w-3.5" /> عرض
                        </Button>
                        <Button size="sm" variant="ghost" className="text-amber-600 hover:bg-amber-50 hover:text-amber-700" onClick={() => openEdit(it)} data-testid={`sub-edit-${it.id}`}>
                          <Pencil className="h-3.5 w-3.5" /> تعديل
                        </Button>
                        <Button size="sm" variant="ghost" className="text-slate-700 hover:bg-slate-100" onClick={() => printRow(it)} data-testid={`sub-print-${it.id}`}>
                          <Printer className="h-3.5 w-3.5" /> طباعة
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => remove(it.id)} data-testid={`sub-delete-${it.id}`}>
                          <Trash2 className="h-3.5 w-3.5" /> حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!items.length && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-slate-500" data-testid="subscriptions-empty">لا توجد سجلات حتى الآن. اضغط «إضافة سجل اشتراك جديد» للبدء.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2" data-testid="pagination">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8"
              >
                السابق
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                  // Show first page, last page, current page, and pages around current
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  } else if (
                    pageNum === currentPage - 2 ||
                    pageNum === currentPage + 2
                  ) {
                    return <span key={pageNum} className="px-1">...</span>;
                  }
                  return null;
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8"
              >
                التالي
              </Button>

              <span className="mr-3 text-sm text-slate-600">
                صفحة {currentPage} من {totalPages} ({total} سجل)
              </span>
            </div>
          )}
        </section>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent dir="rtl" className="max-h-[92vh] max-w-3xl overflow-y-auto text-right sm:text-right" data-testid="add-subscription-dialog">
          <DialogHeader>
            <DialogTitle className="text-right">{editingId ? `تعديل ${dialogTitle.replace("إضافة ", "")}` : dialogTitle}</DialogTitle>
            <DialogDescription className="text-right">{editingId ? "عدّل البيانات ثم اضغط حفظ." : "ادخل بيانات الإذن وطريقة الدفع والحالة. يمكنك تسجيل عدة بيانات متتالية بدون إغلاق النافذة."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => save(e, { keepOpen: false })} className="grid gap-4 md:grid-cols-2" data-testid="subscription-form">
            <div className="grid gap-1.5">
              <Label htmlFor="sub-permit" className="text-xs font-bold text-slate-600">رقم الإذن</Label>
              <Input id="sub-permit" value={form.permit_number} onChange={(e) => setForm({ ...form, permit_number: e.target.value })} required data-testid="sub-input-permit" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-amount" className="text-xs font-bold text-slate-600">المبلغ المحصل (ج.م)</Label>
              <Input id="sub-amount" type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required data-testid="sub-input-amount" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-gov" className="text-xs font-bold text-slate-600">المحافظة</Label>
              <select
                id="sub-gov"
                value={form.governorate}
                onChange={(e) => setForm({ ...form, governorate: e.target.value, union_committee: "" })}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                data-testid="sub-input-gov"
              >
                <option value="">— اختر المحافظة —</option>
                {governorates.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-com" className="text-xs font-bold text-slate-600">اسم اللجنة النقابية</Label>
              <select
                id="sub-com"
                value={form.union_committee}
                onChange={(e) => setForm({ ...form, union_committee: e.target.value })}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                disabled={!form.governorate}
                data-testid="sub-input-com"
              >
                <option value="">{form.governorate ? "— اختر اللجنة —" : "اختر المحافظة أولاً"}</option>
                {(form.governorate ? (committeesByGov[form.governorate] || []) : allCommittees).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-method" className="text-xs font-bold text-slate-600">طريقة الدفع</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger id="sub-method" data-testid="sub-input-method"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">{PAYMENT_METHODS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-month" className="text-xs font-bold text-slate-600">اشتراكات عن شهر</Label>
              <Input id="sub-month" type="month" value={form.subscription_month} onChange={(e) => setForm({ ...form, subscription_month: e.target.value })} data-testid="sub-input-month" />
            </div>

            {form.payment_method === "دفع الكتروني" ? (
              <div className="md:col-span-2 grid gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="sub-eref" className="text-xs font-bold text-slate-600">
                    {form.electronic_reference_kind === "text"
                      ? "مرجع الدفع الإلكتروني (نص) — يُسمح بالتكرار"
                      : "مرجع الدفع الإلكتروني (أرقام) — لا يتكرر"}
                  </Label>
                  {/* Kind toggle: lets the operator decide whether this value
                      is a real transaction number (must be unique) or a free
                      manual label (may repeat). Server enforces accordingly. */}
                  <div className="inline-flex overflow-hidden rounded-md border border-slate-200 text-[11px]" data-testid="sub-eref-kind-toggle" role="radiogroup">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={form.electronic_reference_kind === "number"}
                      onClick={() => setForm({ ...form, electronic_reference_kind: "number" })}
                      className={`px-3 py-1 font-bold transition ${form.electronic_reference_kind === "number" ? "bg-[#0f3a73] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                      data-testid="sub-eref-kind-number"
                    >
                      أرقام
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={form.electronic_reference_kind === "text"}
                      onClick={() => setForm({ ...form, electronic_reference_kind: "text" })}
                      className={`px-3 py-1 font-bold transition ${form.electronic_reference_kind === "text" ? "bg-[#0f3a73] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                      data-testid="sub-eref-kind-text"
                    >
                      نص
                    </button>
                  </div>
                </div>
                <Input
                  id="sub-eref"
                  value={form.electronic_reference}
                  onChange={(e) => setForm({ ...form, electronic_reference: e.target.value })}
                  onBlur={async (e) => {
                    // Skip the pre-submit duplicate-check entirely when the
                    // operator marked the value as a free text label.
                    if (form.electronic_reference_kind === "text") return;
                    const ref = (e.target.value || "").trim();
                    if (!ref) return;
                    try {
                      const params = new URLSearchParams({ department_id: id, electronic_reference: ref, kind: "number" });
                      if (editingId) params.set("exclude_id", editingId);
                      const { data } = await api.get(`/subscriptions/lookup-reference?${params.toString()}`);
                      if (data.found && data.record) {
                        setDupRef(ref);
                        setDupRecord(data.record);
                        setDupOpen(true);
                      }
                    } catch { /* silent — server will catch on submit */ }
                  }}
                  data-testid="sub-input-eref"
                />
                <p className="text-[10px] text-slate-500">
                  {form.electronic_reference_kind === "text"
                    ? "وضع \"نص\": تسمية وصفية يدوية — يُسمح بتكرارها على أكثر من سجل."
                    : "وضع \"أرقام\": رقم معاملة فريد من البنك أو البوابة — يتم التحقق من عدم تكراره."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-cnum" className="text-xs font-bold text-slate-600">رقم الشيك</Label>
                  <Input id="sub-cnum" value={form.cheque_number} onChange={(e) => setForm({ ...form, cheque_number: e.target.value })} data-testid="sub-input-cnum" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-cbank" className="text-xs font-bold text-slate-600">البنك الصادر منه الشيك</Label>
                  <Input id="sub-cbank" value={form.cheque_bank} onChange={(e) => setForm({ ...form, cheque_bank: e.target.value })} data-testid="sub-input-cbank" />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label htmlFor="sub-cdate" className="text-xs font-bold text-slate-600">تاريخ الشيك</Label>
                  <Input id="sub-cdate" type="date" value={form.cheque_date} onChange={(e) => setForm({ ...form, cheque_date: e.target.value })} data-testid="sub-input-cdate" />
                </div>
              </>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="sub-issued" className="text-xs font-bold text-slate-600">تحريراً في</Label>
              <Input id="sub-issued" type="date" value={form.issued_at} onChange={(e) => setForm({ ...form, issued_at: e.target.value })} data-testid="sub-input-issued" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sub-status" className="text-xs font-bold text-slate-600">الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v, not_takaful_target: v === "لا يخص مشروع التكافل" ? (form.not_takaful_target || "النقابة العامة") : "" })}>
                <SelectTrigger id="sub-status" data-testid="sub-input-status"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">{STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>

            {form.status === "لا يخص مشروع التكافل" && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-nottarget" className="text-xs font-bold text-slate-600">تابع لـ</Label>
                  <Select value={form.not_takaful_target || "النقابة العامة"} onValueChange={(v) => setForm({ ...form, not_takaful_target: v })}>
                    <SelectTrigger id="sub-nottarget" data-testid="sub-input-nottarget"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">{NOT_TAKAFUL_TARGETS.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                {form.not_takaful_target === "جهة أخرى" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="sub-notother" className="text-xs font-bold text-slate-600">اسم الجهة الأخرى</Label>
                    <Input id="sub-notother" value={form.not_takaful_other} onChange={(e) => setForm({ ...form, not_takaful_other: e.target.value })} data-testid="sub-input-notother" />
                  </div>
                )}
              </>
            )}

            <div className="md:col-span-2 grid gap-1.5">
              <Label htmlFor="sub-notes" className="text-xs font-bold text-slate-600">ملاحظات</Label>
              <Textarea id="sub-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="sub-input-notes" />
            </div>

            {(dialogStatus || error) && (
              <div className={`md:col-span-2 rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`} data-testid="sub-dialog-message">{error || dialogStatus}</div>
            )}

            <DialogFooter className="md:col-span-2 gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditingId(null); }} data-testid="sub-cancel">إلغاء</Button>
              {!editingId && (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={(e) => save(e, { keepOpen: true })}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="sub-save-add-another"
                  title="يحفظ السجل الحالي ويُبقي النافذة مفتوحة لتسجيل سجل جديد"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} حفظ وإضافة آخر
                </Button>
              )}
              <Button type="submit" disabled={busy} className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="sub-save">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {editingId ? "حفظ التعديلات" : "حفظ وإغلاق"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate electronic reference Dialog */}
      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent dir="rtl" className="max-w-2xl text-right sm:text-right" data-testid="duplicate-eref-dialog">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2 text-red-700">
              <CircleSlash className="h-5 w-5" /> رقم الدفع الإلكتروني مكرر
            </DialogTitle>
            <DialogDescription className="text-right">
              الرقم <strong className="text-red-700">{dupRef}</strong> مستخدم مسبقاً في السجل التالي. اختر إجراءً مناسباً.
            </DialogDescription>
          </DialogHeader>
          {dupRecord && (
            <div className="grid gap-1.5 rounded-md border border-amber-200 bg-amber-50/40 p-3 text-sm" data-testid="duplicate-eref-body">
              <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">رقم الإذن السابق:</span><strong>{dupRecord.permit_number || "-"}</strong></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">المبلغ:</span><strong className="tabular-nums text-emerald-700">{(dupRecord.amount || 0).toLocaleString("ar-EG")} ج.م</strong></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">المحافظة / اللجنة:</span><strong>{dupRecord.governorate || "-"} — {dupRecord.union_committee || "-"}</strong></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">شهر الاشتراك:</span><strong>{dupRecord.subscription_month || "-"}</strong></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">تاريخ الإذن:</span><strong>{dupRecord.issued_at || "-"}</strong></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">الحالة:</span><strong>{dupRecord.status || "-"}</strong></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">المُسجّل:</span><strong>{dupRecord.recorded_by_name || "-"}</strong></div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDupOpen(false)} data-testid="dup-close-btn">إغلاق</Button>
            {dupRecord && (
              <Button
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => { setDupOpen(false); setOpen(false); openView(dupRecord); }}
                data-testid="dup-view-existing-btn"
              >
                <Eye className="h-4 w-4" /> عرض السجل السابق
              </Button>
            )}
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => { setDupOpen(false); setForm((f) => ({ ...f, electronic_reference: "" })); }}
              data-testid="dup-clear-btn"
            >
              مسح الرقم وإعادة الإدخال
            </Button>
            {/* Escape hatch: bypasses the duplicate guard AND triggers an
                immediate save in a single click. We pass kindOverride="text"
                so the call doesn't have to wait for setForm to flush — the
                back-end will skip uniqueness for this submission. */}
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={busy}
              onClick={async () => {
                setDupOpen(false);
                await save(null, { keepOpen: false, kindOverride: "text" });
              }}
              data-testid="dup-allow-as-text-btn"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              تجاهل التكرار وحفظ كنص
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog (read-only details) */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent dir="rtl" className="max-w-2xl text-right sm:text-right" data-testid="view-subscription-dialog">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2"><Eye className="h-5 w-5 text-blue-600" /> عرض تفاصيل السجل</DialogTitle>
            <DialogDescription className="text-right">معاينة كاملة للسجل (للعرض فقط).</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <div className="grid gap-3 text-sm" data-testid="view-subscription-body">
              <div className="grid gap-1.5 rounded-md border border-slate-200 bg-slate-50/50 p-3">
                <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">رقم الإذن:</span><strong className="text-slate-950">{viewItem.permit_number || "-"}</strong></div>
                <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">المبلغ:</span><strong className="tabular-nums text-emerald-700">{(viewItem.amount || 0).toLocaleString("ar-EG")} ج.م</strong></div>
                <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">المحافظة:</span><strong>{viewItem.governorate || "-"}</strong></div>
                <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">اللجنة النقابية:</span><strong>{viewItem.union_committee || "-"}</strong></div>
                <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">طريقة الدفع:</span><strong>{viewItem.payment_method || "-"}</strong></div>
                {viewItem.payment_method === "شيك" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">رقم الشيك:</span><strong>{viewItem.cheque_number || "-"}</strong></div>
                    <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">البنك:</span><strong>{viewItem.cheque_bank || "-"}</strong></div>
                    <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">تاريخ الشيك:</span><strong>{viewItem.cheque_date || "-"}</strong></div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">مرجع الدفع:</span><strong>{viewItem.electronic_reference || "-"}</strong></div>
                )}
                <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">شهر الاشتراك:</span><strong>{viewItem.subscription_month || "-"}</strong></div>
                <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">تحريراً في:</span><strong>{viewItem.issued_at || "-"}</strong></div>
                <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">الحالة:</span><strong>{viewItem.status || "-"}</strong></div>
                {viewItem.status === "لا يخص مشروع التكافل" && (
                  <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">الجهة:</span><strong>{viewItem.not_takaful_target === "جهة أخرى" ? `جهة أخرى: ${viewItem.not_takaful_other}` : (viewItem.not_takaful_target || "-")}</strong></div>
                )}
                <div className="grid grid-cols-2 gap-2"><span className="text-slate-500">الموظف المختص:</span><strong>{viewItem.recorded_by_name || "-"}</strong></div>
                {viewItem.notes && (
                  <div className="grid gap-1"><span className="text-slate-500">ملاحظات:</span><p className="rounded-md border border-slate-200 bg-white p-2 text-slate-800">{viewItem.notes}</p></div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setViewOpen(false)} data-testid="view-close-btn">إغلاق</Button>
            {viewItem && (
              <>
                <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => { setViewOpen(false); openEdit(viewItem); }} data-testid="view-edit-btn">
                  <Pencil className="h-4 w-4" /> تعديل
                </Button>
                <Button className="bg-[#0f3a73] hover:bg-[#103e7d]" onClick={() => printRow(viewItem)} data-testid="view-print-btn">
                  <Printer className="h-4 w-4" /> طباعة
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Not-Takaful Target Dialog (when changing status to لا يخص) */}
      <Dialog open={notTakafulOpen} onOpenChange={setNotTakafulOpen}>
        <DialogContent dir="rtl" className="max-w-md text-right sm:text-right" data-testid="nottakaful-dialog">
          <DialogHeader>
            <DialogTitle className="text-right">تحديد الجهة التابع لها</DialogTitle>
            <DialogDescription className="text-right">هذا السجل لا يخص مشروع التكافل — حدد الجهة.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Select value={notTakafulCtx.target} onValueChange={(v) => setNotTakafulCtx({ ...notTakafulCtx, target: v })}>
              <SelectTrigger data-testid="nottakaful-target"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">{NOT_TAKAFUL_TARGETS.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
            </Select>
            {notTakafulCtx.target === "جهة أخرى" && (
              <Input placeholder="اسم الجهة الأخرى" value={notTakafulCtx.other} onChange={(e) => setNotTakafulCtx({ ...notTakafulCtx, other: e.target.value })} data-testid="nottakaful-other" />
            )}
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotTakafulOpen(false)} data-testid="nottakaful-cancel">إلغاء</Button>
            <Button onClick={confirmNotTakaful} className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="nottakaful-confirm">تأكيد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
