import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BarChart3, CalendarClock, Download, Eye, FileSpreadsheet, FileUp, Filter, IdCard, Loader2, Pencil, Plus, Printer, Save, Search, Trash2, UploadCloud, UsersRound } from "lucide-react";
import AppShell from "../components/AppShell";
import DuplicateMemberDialog from "../components/DuplicateMemberDialog";
import GatewayHero from "../components/GatewayHero";
import useLiveChanges from "../lib/useLiveChanges";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { api, downloadFile, getErrorMessage } from "../lib/api";

const emptyMember = {
  governorate: "", union_committee: "", membership_number: "", name: "", national_id: "", birth_date: "",
  subscription_date: "", address_phone: "", status: "فعال", status_date: new Date().toISOString().slice(0, 10), address: "", beneficiary_name: "",
};

const dateFields = ["birth_date", "subscription_date", "status_date"];

const fields = [
  ["name", "الاسم"],
  ["national_id", "الرقم القومي"],
  ["membership_number", "رقم العضوية"],
  ["governorate", "المحافظة"],
  ["union_committee", "اللجنة النقابية"],
  ["birth_date", "تاريخ الميلاد"],
  ["subscription_date", "تاريخ اشتراك العضو (منضم بتاريخ)"],
  ["address_phone", "محل الإقامة والتليفون"],
  ["address", "العنوان"],
  ["beneficiary_name", "قيمة الإعانة تسلم إلى"],
  ["status", "الحالة"],
  ["status_date", "تاريخ الحالة"],
];

const STATUS_OPTIONS = [
  { value: "فعال",    label: "فعال",    className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "متوفي",   label: "متوفي",   className: "bg-slate-200 text-slate-700 border-slate-300" },
  { value: "استقالة", label: "استقالة", className: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "إسقاط",   label: "إسقاط",   className: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "عجز كلي أو جزئي منهي للخدمة", label: "عجز منهي للخدمة", className: "bg-purple-100 text-purple-700 border-purple-200" },
];

const statusStyle = (status) => STATUS_OPTIONS.find((s) => s.value === status)?.className || "bg-slate-100 text-slate-700 border-slate-200";

export default function MembershipPage() {
  const { id } = useParams();
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [documentRecord, setDocumentRecord] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);  // null = create mode
  const [reports, setReports] = useState({ total_members: 0, active_count: 0, retirement_due_count: 0, deceased_count: 0, resignation_count: 0, dropout_count: 0, by_governorate: [], by_governorate_active: [], by_committee_per_governorate: {} });
  const [classifications, setClassifications] = useState({ governorates: [], union_committees: [], committees_by_governorate: {} });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState({ governorate: "", union_committee: "", retirement_due: false, status: "", missing: "" });
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null); // { message, member } when a 409 duplicate is detected
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem("archive_user") || "{}");
  const isAdmin = currentUser.role === "super_admin" || currentUser.role === "admin";

  // Debounce search input → wait 350ms after user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  // Reset to page 1 whenever any filter / search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.governorate, filters.union_committee, filters.retirement_due, filters.status, filters.missing]);

  const toggleOne = (memberId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (prev.size === members.length && members.length > 0) return new Set();
      return new Set(members.map((m) => m.id));
    });
  };
  const bulkDelete = async () => {
    if (!isAdmin || selectedIds.size === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} عضو نهائياً؟`)) return;
    const tId = toast.loading(`جاري التنفيذ — حذف ${selectedIds.size} عضو...`);
    try {
      await Promise.all([...selectedIds].map((mid) => api.delete(`/members/${mid}`)));
      const count = selectedIds.size;
      setSelectedIds(new Set());
      await Promise.all([loadMembers(), loadReports(), loadClassifications()]);
      toast.success(`تم حذف ${count} عضو بنجاح`, { id: tId });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
      setError(getErrorMessage(err));
    }
  };

  const deleteAllMembers = async () => {
    if (!isAdmin) return;
    const totalCount = reports.total_members || members.length;
    const firstConfirm = window.confirm(
      `⚠️ تحذير: ستقوم بحذف جميع الأعضاء (${totalCount}) من هذا القسم نهائياً!\n\nهل تريد المتابعة؟`
    );
    if (!firstConfirm) return;
    const phrase = window.prompt(
      `هذه عملية لا يمكن التراجع عنها.\nاكتب الكلمة DELETE (بحروف كبيرة) للتأكيد:`
    );
    if (phrase !== "DELETE") {
      if (phrase !== null) toast.warning("تم إلغاء العملية — كلمة التأكيد غير صحيحة");
      return;
    }
    const tId = toast.loading("جاري التنفيذ — حذف كافة الأعضاء...");
    try {
      const { data } = await api.delete(`/members?department_id=${id}&confirm=DELETE`);
      setSelectedIds(new Set());
      await Promise.all([loadMembers(), loadReports(), loadClassifications()]);
      toast.success(`تم حذف ${data.count} عضو بنجاح`, { id: tId, duration: 3500 });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
      setError(getErrorMessage(err));
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setError("");
    const tId = toast.loading("جاري التنفيذ — استيراد ملف Excel، قد يستغرق دقيقة...");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(`/imports/members?department_id=${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600000, // 10 minutes for large files
      });
      let msg = `تم الاستيراد: ${data.created} جديد، ${data.updated} محدث، ${data.skipped} متخطى`;
      if (data.errors?.length) {
        msg += ` (${data.errors.length} خطأ)`;
      }
      toast.success(msg, { id: tId, duration: 5000 });
      await Promise.all([loadMembers(), loadReports(), loadClassifications()]);
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
      setError(getErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [formMode, setFormMode] = useState("manual"); // "manual" or "upload"
  const [dialogStatus, setDialogStatus] = useState("");
  const [statGovernorate, setStatGovernorate] = useState("");
  const [statCommittee, setStatCommittee] = useState("");

  const department = useMemo(() => departments.find((item) => item.id === id), [departments, id]);

  const memberQuery = () => {
    const params = new URLSearchParams({
      department_id: id,
      page: String(page),
      page_size: String(pageSize),
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filters.governorate) params.set("governorate", filters.governorate);
    if (filters.union_committee) params.set("union_committee", filters.union_committee);
    if (filters.retirement_due) params.set("retirement_due", "true");
    if (filters.status) params.set("status", filters.status);
    if (filters.missing) params.set("missing", filters.missing);
    return params.toString();
  };

  const loadMembers = async () => {
    setLoadingMembers(true);
    // Only show "Searching" toast when the user is actually searching/filtering
    const isQuerying = Boolean(debouncedSearch || filters.governorate || filters.union_committee || filters.retirement_due || filters.status || filters.missing);
    const searchToastId = isQuerying ? toast.loading("جاري البحث...", { id: "members-search" }) : null;
    try {
      const { data } = await api.get(`/members/paginated?${memberQuery()}`);
      setMembers(data.items || []);
      setTotalMembers(data.total || 0);
      setTotalPages(data.total_pages || 1);
      if (isQuerying) {
        if (data.total > 0) {
          toast.success(`تم العثور على ${data.total} نتيجة`, { id: searchToastId, duration: 2000 });
        } else {
          toast.error("لم يتم العثور على بيانات مطابقة", { id: searchToastId, duration: 2500 });
        }
      }
    } catch (err) {
      if (searchToastId) toast.dismiss(searchToastId);
      throw err;
    } finally {
      setLoadingMembers(false);
    }
  };
  const loadReports = async () => { const { data } = await api.get(`/reports/membership?department_id=${id}`); setReports(data); };
  const loadClassifications = async () => { const { data } = await api.get(`/classifications?department_id=${id}`); setClassifications(data); };

  useEffect(() => {
    (async () => {
      try {
        const [departmentsRes] = await Promise.all([api.get("/departments"), loadReports(), loadClassifications()]);
        setDepartments(departmentsRes.data);
      } catch (err) { setError(getErrorMessage(err)); }
    })();
  }, [id]);
  useEffect(() => { loadMembers().catch((err) => setError(getErrorMessage(err))); }, [id, debouncedSearch, filters.governorate, filters.union_committee, filters.retirement_due, filters.status, filters.missing, page, pageSize]);

  // Live sync: when another user changes the members collection, silently
  // refresh the list and the dashboard counters. Forms / open dialogs are
  // NEVER touched — the user's in-progress work is preserved.
  useLiveChanges(["members"], () => {
    if (addOpen || uploadOpen) return; // protect the form the user is filling
    loadMembers().catch(() => {});
    loadReports().catch(() => {});
    toast.info("تم تحديث القائمة من مستخدم آخر", { id: "live-sync-members", duration: 2000 });
  });

  const openAddDialog = () => { setEditingMemberId(null); setMemberForm(emptyMember); setDocumentRecord(null); setFormMode("manual"); setAddOpen(true); setDialogStatus(""); setError(""); };
  const openUploadDialog = () => { setMemberForm(emptyMember); setDocumentRecord(null); setFormMode("upload"); setUploadOpen(true); setDialogStatus(""); setError(""); };

  const uploadDocument = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setDialogStatus("جاري رفع الملف واستخراج البيانات...");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post("/documents/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setDocumentRecord(data);
      setMemberForm({ ...emptyMember, ...data.extracted_fields });
      setDialogStatus("تم استخراج البيانات. راجعها ثم احفظ العضو.");
      // Switch to the form view (closing upload dialog, opening add dialog with prefilled data)
      setUploadOpen(false);
      setFormMode("upload");
      setAddOpen(true);
    } catch (err) {
      setError(getErrorMessage(err)); setDialogStatus("");
    } finally {
      setBusy(false); event.target.value = "";
    }
  };

  const saveMember = async (event, { keepOpen = false } = {}) => {
    if (event) event.preventDefault();
    setBusy(true); setError(""); setDialogStatus(editingMemberId ? "جاري حفظ التعديلات..." : "جاري حفظ العضو...");
    const tId = toast.loading(editingMemberId ? "جاري التنفيذ — حفظ التعديلات..." : "جاري التنفيذ — حفظ بيانات العضو...");
    try {
      const payload = { ...memberForm, department_id: id, document_id: documentRecord?.id || "" };
      if (editingMemberId) {
        await api.put(`/members/${editingMemberId}`, payload);
      } else {
        await api.post("/members", payload);
      }
      await Promise.all([loadMembers(), loadReports(), loadClassifications()]);
      toast.success(editingMemberId ? "تم حفظ التعديلات بنجاح" : "تم حفظ العضو بنجاح", { id: tId, duration: 1800 });
      // Edit-mode always closes. In create-mode, "Save & Add Another" keeps the
      // dialog open and clears the form so the user can keep entering members.
      if (editingMemberId || !keepOpen) {
        setMemberForm(emptyMember); setDocumentRecord(null); setEditingMemberId(null);
        setDialogStatus("");
        setAddOpen(false);
      } else {
        // Stay in dialog: clear per-member fields but keep gov/committee/status
        // for fast bulk entry within the same committee.
        setMemberForm((prev) => ({
          ...emptyMember,
          governorate: prev.governorate,
          union_committee: prev.union_committee,
          status: prev.status,
          status_date: prev.status_date,
        }));
        setDocumentRecord(null);
        setDialogStatus("");
        setError("");
      }
    } catch (err) {
      // Special handling for the structured "duplicate_member" 409 response:
      // show the existing-member popup so the user knows where the clash is.
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 409 && detail && typeof detail === "object" && detail.code === "duplicate_member") {
        setDuplicateInfo({ 
          message: detail.message || "", 
          member: detail.existing_member || {},
          all_duplicates: detail.all_duplicates || [],
          committees_info: detail.committees_info || [],
          duplicate_count: detail.duplicate_count || 1
        });
        toast.dismiss(tId);
        setDialogStatus("");
      } else {
        toast.error(getErrorMessage(err), { id: tId });
        setError(getErrorMessage(err)); setDialogStatus("");
      }
    } finally { setBusy(false); }
  };

  const openEditMember = (member) => {
    setEditingMemberId(member.id);
    setMemberForm({
      name: member.name || "",
      national_id: member.national_id || "",
      membership_number: member.membership_number || "",
      governorate: member.governorate || "",
      union_committee: member.union_committee || "",
      birth_date: member.birth_date || "",
      subscription_date: member.subscription_date || "",
      address: member.address || "",
      address_phone: member.address_phone || "",
      beneficiary_name: member.beneficiary_name || "",
      status: member.status || "فعال",
      status_date: member.status_date || "",
      notes: member.notes || "",
    });
    setDocumentRecord(null);
    setFormMode("manual");
    setError(""); setDialogStatus(""); setAddOpen(true);
  };


  const changeStatus = async (memberId, newStatus) => {
    const tId = toast.loading("جاري التنفيذ — تحديث الحالة...");
    try {
      await api.patch(`/members/${memberId}/status`, { status: newStatus, status_date: new Date().toISOString().slice(0, 10) });
      await loadMembers();
      toast.success("تم تحديث الحالة", { id: tId, duration: 1500 });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
      setError(getErrorMessage(err));
    }
  };

  const removeMember = async (memberId) => {
    if (!window.confirm("هل تريد حذف بيانات هذا العضو؟")) return;
    const tId = toast.loading("جاري التنفيذ — حذف العضو...");
    try {
      await api.delete(`/members/${memberId}`);
      await Promise.all([loadMembers(), loadReports()]);
      toast.success("تم حذف العضو", { id: tId, duration: 1500 });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
      setError(getErrorMessage(err));
    }
  };

  const openCaseForm = async (memberId, mode) => {
    setError("");
    try {
      const response = await api.get(`/members/${memberId}/case-form?mode=${mode}`, { responseType: "text" });
      const blob = new Blob([response.data], { type: "text/html; charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (!popup) setError("المتصفح حظر فتح النافذة. اسمح بالنوافذ المنبثقة ثم حاول مجدداً.");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) { setError(getErrorMessage(err)); }
  };

  return (
    <AppShell title="العضوية" subtitle="رفع الاستمارة، إضافة الأعضاء، ومراجعة بياناتهم.">
      <div className="space-y-7" data-testid="membership-page-wrapper">
        <GatewayHero
          icon={IdCard}
          badge="بوابة العضوية"
          title="عضوية مشروع التكافل الاجتماعي"
          subtitle={`أرشفة الأعضاء، استخراج البيانات تلقائياً، وإدارة حالة كل عضو في ${department?.name || "المشروع"}.`}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { label: "العضوية" },
          ]}
          stats={[
            { key: "active", label: "إجمالي العضوية الفعّالة", value: reports.active_count },
            { key: "retirement", label: "المعاش", value: reports.retirement_due_count },
          ]}
        />

        {/* Action toolbar */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)]" data-testid="membership-toolbar">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3" data-testid="membership-actions">
              <Button onClick={openAddDialog} className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="add-member-button">
                <Plus className="h-4 w-4" /> إضافة عضو جديد
              </Button>
              <Button variant="outline" onClick={() => downloadFile(`/exports/members?department_id=${id}`, `members-${id.slice(0,8)}.xlsx`).catch((e) => setError(getErrorMessage(e)))} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" data-testid="export-members-excel">
                <FileSpreadsheet className="h-4 w-4" /> تصدير Excel
              </Button>
              <Button variant="outline" onClick={() => downloadFile(`/imports/members/template`, `members-import-template.xlsx`).catch((e) => setError(getErrorMessage(e)))} className="border-amber-300 text-amber-700 hover:bg-amber-50" data-testid="download-import-template">
                <Download className="h-4 w-4" /> قالب Excel فارغ
              </Button>
              <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50" data-testid="import-members-excel">
                <FileUp className="h-4 w-4" /> استيراد Excel
                <input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleImportExcel} disabled={importing} />
              </label>
              {importing && <span className="text-xs text-slate-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> جاري الاستيراد...</span>}
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={deleteAllMembers}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  data-testid="delete-all-members-button"
                >
                  <Trash2 className="h-4 w-4" /> مسح كافة الأعضاء
                </Button>
              )}
            </div>
            <div className="relative w-full max-w-sm" data-testid="member-search-box">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم القومي" className="pe-10" data-testid="member-search-input" />
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="membership-error-message">{error}</div>
        )}

        {/* Report summary cards */}
        <section className="grid gap-4 lg:grid-cols-3" data-testid="membership-report-cards">
          <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="report-total-card">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><UsersRound className="h-4 w-4 text-[#0f3a73]" /> إجمالي العضوية الفعّالة</div>
            <p className="mt-3 text-3xl font-extrabold text-slate-950 tabular-nums" data-testid="report-active-value">{reports.active_count}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500" data-testid="report-breakdown">
              <p className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1"><span>الإجمالي</span><strong className="text-slate-900 tabular-nums">{reports.total_members}</strong></p>
              <p className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1"><span>المعاش</span><strong className="text-slate-900 tabular-nums">−{reports.retirement_due_count}</strong></p>
              <p className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1"><span>الوفاة</span><strong className="text-slate-900 tabular-nums">−{reports.deceased_count}</strong></p>
              <p className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1"><span>الاستقالة</span><strong className="text-slate-900 tabular-nums">−{reports.resignation_count}</strong></p>
              <p className="col-span-2 flex items-center justify-between rounded-md bg-slate-50 px-2 py-1"><span>الإسقاط</span><strong className="text-slate-900 tabular-nums">−{reports.dropout_count}</strong></p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="report-governorate-card">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><BarChart3 className="h-4 w-4 text-[#0f3a73]" /> حسب المحافظة</div>
            <select value={statGovernorate} onChange={(e) => { setStatGovernorate(e.target.value); setStatCommittee(""); }} className="mt-3 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="report-governorate-select">
              <option value="">— اختر محافظة —</option>
              {(reports.by_governorate_active || []).map((g) => (<option key={g.name} value={g.name}>{g.name}</option>))}
            </select>
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center" data-testid="report-governorate-result">
              <p className="text-xs text-slate-500">إجمالي عضوية</p>
              <p className="mt-1 text-2xl font-extrabold text-[#0f3a73] tabular-nums" data-testid="report-governorate-value">
                {statGovernorate ? ((reports.by_governorate_active || []).find((g) => g.name === statGovernorate)?.count || 0) : "—"}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-600" data-testid="report-governorate-name">{statGovernorate || "اختر محافظة لعرض الإجمالي"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="report-committee-card">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><BarChart3 className="h-4 w-4 text-[#0f3a73]" /> حسب اللجنة النقابية</div>
            <select value={statCommittee} onChange={(e) => setStatCommittee(e.target.value)} disabled={!statGovernorate} className="mt-3 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400" data-testid="report-committee-select">
              <option value="">{statGovernorate ? "— اختر لجنة —" : "اختر محافظة أولاً"}</option>
              {((reports.by_committee_per_governorate || {})[statGovernorate] || []).map((c) => (<option key={c.name} value={c.name}>{c.name}</option>))}
            </select>
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center" data-testid="report-committee-result">
              <p className="text-xs text-slate-500">إجمالي عضوية اللجنة</p>
              <p className="mt-1 text-2xl font-extrabold text-[#0f3a73] tabular-nums" data-testid="report-committee-value">
                {statCommittee ? (((reports.by_committee_per_governorate || {})[statGovernorate] || []).find((c) => c.name === statCommittee)?.count || 0) : "—"}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-600" data-testid="report-committee-name">{statCommittee || (statGovernorate ? "اختر لجنة لعرض الإجمالي" : "—")}</p>
            </div>
          </div>
        </section>

        {/* Filter bar */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="archive-filter-panel">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1.5" data-testid="governorate-filter-label">
              <span className="text-xs font-bold text-slate-500">تصفية بالمحافظة</span>
              <select
                value={filters.governorate}
                onChange={(e) => setFilters({ ...filters, governorate: e.target.value, union_committee: "" })}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                data-testid="governorate-filter-select"
              >
                <option value="">كل المحافظات</option>
                {classifications.governorates.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5" data-testid="committee-filter-label">
              <span className="text-xs font-bold text-slate-500">تصفية باللجنة النقابية</span>
              <select
                value={filters.union_committee}
                onChange={(e) => setFilters({ ...filters, union_committee: e.target.value })}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                data-testid="committee-filter-select"
              >
                <option value="">{filters.governorate ? "كل لجان المحافظة المختارة" : "كل اللجان"}</option>
                {(filters.governorate
                  ? (classifications.committees_by_governorate || {})[filters.governorate] || []
                  : classifications.union_committees
                ).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5" data-testid="status-filter-label">
              <span className="text-xs font-bold text-slate-500">تصفية بالحالة</span>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="status-filter-select">
                <option value="">كل الحالات (يشمل المعاش)</option>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5" data-testid="missing-filter-label">
              <span className="text-xs font-bold text-amber-700">اكتشاف البيانات الناقصة</span>
              <select
                value={filters.missing}
                onChange={(e) => setFilters({ ...filters, missing: e.target.value })}
                className={`h-9 rounded-md border px-3 text-sm font-bold ${filters.missing ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 bg-white"}`}
                data-testid="missing-filter-select"
              >
                <option value="">— لا تصفية —</option>
                <option value="any">أي بيان ناقص ({reports.missing_any_count || 0})</option>
                <option value="governorate">بدون محافظة ({reports.missing_governorate_count || 0})</option>
                <option value="committee">بدون لجنة ({reports.missing_committee_count || 0})</option>
                <option value="both">بدون محافظة ولجنة ({reports.missing_both_count || 0})</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="button" variant={filters.retirement_due ? "default" : "outline"} onClick={() => setFilters({ ...filters, retirement_due: !filters.retirement_due })} className={`flex-1 ${filters.retirement_due ? "bg-[#0f3a73] hover:bg-[#103e7d]" : ""}`} data-testid="retirement-due-filter-button">
                {filters.retirement_due ? <CalendarClock className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                تصفية المعاش ({reports.retirement_due_count})
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilters({ governorate: "", union_committee: "", retirement_due: false, status: "", missing: "" });
                  setSearch("");
                  setPage(1);
                  toast.success("تم إلغاء التصفية — عرض جميع الأعضاء", { duration: 1500 });
                }}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                data-testid="clear-filters-button"
                title="عرض كافة الأعضاء بدون تصفية"
              >
                إلغاء التصفية
              </Button>
            </div>
          </div>
        </section>

        {/* Full-width members table */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="members-archive-section">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">سجل عضوية مشروع التكافل الاجتماعي</h2>
              <p className="mt-1 text-xs text-slate-500" data-testid="members-archive-count">
                {loadingMembers
                  ? "جاري التحميل..."
                  : `صفحة ${page} من ${totalPages} — عرض ${members.length} من إجمالي ${totalMembers}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && selectedIds.size > 0 && (
                <Button size="sm" onClick={bulkDelete} className="bg-red-600 hover:bg-red-700 text-white" data-testid="bulk-delete-members">
                  <Trash2 className="h-4 w-4" /> حذف {selectedIds.size} عضو محدد
                </Button>
              )}
              <Button asChild variant="outline" size="sm" data-testid="back-to-departments-button"><Link to={`/project/${id}`}>← العودة لبوابة المشروع</Link></Button>
            </div>
          </div>
          <div className="overflow-x-auto" data-testid="members-table-wrapper">
            <Table data-testid="members-table">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  {isAdmin && (
                    <TableHead className="w-10 text-start">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-[#0f3a73]"
                        checked={members.length > 0 && selectedIds.size === members.length}
                        onChange={toggleAll}
                        data-testid="members-select-all"
                      />
                    </TableHead>
                  )}
                  <TableHead className="text-start">الاسم</TableHead>
                  <TableHead className="text-start">الرقم القومي</TableHead>
                  <TableHead className="text-start">رقم العضوية</TableHead>
                  <TableHead className="text-start">تاريخ الميلاد</TableHead>
                  <TableHead className="text-start">تاريخ الاشتراك</TableHead>
                  <TableHead className="text-start">المحافظة</TableHead>
                  <TableHead className="text-start">اللجنة النقابية</TableHead>
                  <TableHead className="text-start">محل الإقامة والتليفون</TableHead>
                  <TableHead className="text-start">العنوان</TableHead>
                  <TableHead className="text-start">قيمة الإعانة تسلم إلى</TableHead>
                  <TableHead className="text-start">الحالة</TableHead>
                  <TableHead className="text-start">تاريخ الحالة</TableHead>
                  <TableHead className="text-start">المعاش</TableHead>
                  <TableHead className="text-start">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} className="align-top" data-testid={`member-row-${member.id}`}>
                    {isAdmin && (
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-[#0f3a73]"
                          checked={selectedIds.has(member.id)}
                          onChange={() => toggleOne(member.id)}
                          data-testid={`member-select-${member.id}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-bold text-slate-950" data-testid={`member-name-${member.id}`}>{member.name || "بدون اسم"}</TableCell>
                    <TableCell data-testid={`member-national-id-${member.id}`}>{member.national_id || "-"}</TableCell>
                    <TableCell data-testid={`member-membership-${member.id}`}>{member.membership_number || "-"}</TableCell>
                    <TableCell data-testid={`member-birth-${member.id}`}>{member.birth_date || "-"}</TableCell>
                    <TableCell data-testid={`member-subscription-${member.id}`}>{member.subscription_date || "-"}</TableCell>
                    <TableCell data-testid={`member-governorate-${member.id}`}>{member.governorate || "-"}</TableCell>
                    <TableCell data-testid={`member-committee-${member.id}`}>{member.union_committee || "-"}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-pre-wrap break-words" data-testid={`member-address-phone-${member.id}`}>{member.address_phone || "-"}</TableCell>
                    <TableCell className="max-w-[200px] whitespace-pre-wrap break-words" data-testid={`member-address-${member.id}`}>{member.address || "-"}</TableCell>
                    <TableCell className="max-w-[180px] whitespace-pre-wrap break-words" data-testid={`member-beneficiary-${member.id}`}>{member.beneficiary_name || "-"}</TableCell>
                    <TableCell data-testid={`member-status-cell-${member.id}`}>
                      <Select value={member.status || "فعال"} onValueChange={(value) => changeStatus(member.id, value)}>
                        <SelectTrigger className={`h-8 min-w-[110px] border ${statusStyle(member.status || "فعال")} font-bold`} data-testid={`member-status-trigger-${member.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value} data-testid={`status-option-${s.value}-${member.id}`}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell data-testid={`member-status-date-${member.id}`}>{member.status_date || "-"}</TableCell>
                    <TableCell data-testid={`member-retirement-${member.id}`}>
                      <Badge variant={member.retirement_due ? "destructive" : "outline"}>{member.retirement_due ? "معاش" : member.retirement_date || "غير محدد"}</Badge>
                    </TableCell>
                    <TableCell data-testid={`member-actions-${member.id}`}>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => openCaseForm(member.id, "view")} data-testid={`member-view-${member.id}`}>
                          <Eye className="h-3.5 w-3.5" /> معاينة
                        </Button>
                        <Button size="sm" variant="ghost" className="text-slate-700 hover:bg-slate-100" onClick={() => openCaseForm(member.id, "print")} data-testid={`member-print-${member.id}`}>
                          <Printer className="h-3.5 w-3.5" /> طباعة
                        </Button>
                        <Button size="sm" variant="ghost" className="text-amber-600 hover:bg-amber-50 hover:text-amber-700" onClick={() => openEditMember(member)} data-testid={`member-edit-${member.id}`}>
                          <Pencil className="h-3.5 w-3.5" /> تعديل
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeMember(member.id)} data-testid={`member-delete-${member.id}`}>
                            <Trash2 className="h-3.5 w-3.5" /> حذف
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!members.length && (
                  <TableRow data-testid="members-empty-row">
                    <TableCell colSpan={isAdmin ? 15 : 14} className="py-12 text-center text-slate-500" data-testid="members-empty-message">
                      {loadingMembers
                        ? "جاري التحميل..."
                        : (debouncedSearch || filters.governorate || filters.union_committee || filters.retirement_due || filters.status || filters.missing)
                          ? "لا توجد بيانات مطابقة لمعايير البحث/التصفية"
                          : "لا يوجد أعضاء بعد — اضغط «إضافة عضو جديد» أو استورد ملف Excel."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-3" data-testid="members-pagination">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>عدد العناصر بالصفحة:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                  data-testid="members-page-size"
                >
                  {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-slate-400">|</span>
                <span>صفحة {page} من {totalPages}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1 || loadingMembers} onClick={() => setPage(1)} data-testid="members-page-first">«</Button>
                <Button size="sm" variant="outline" disabled={page <= 1 || loadingMembers} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="members-page-prev">‹</Button>
                <span className="px-3 text-sm tabular-nums">{page}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages || loadingMembers} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} data-testid="members-page-next">›</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages || loadingMembers} onClick={() => setPage(totalPages)} data-testid="members-page-last">»</Button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent dir="rtl" className="max-w-md text-right sm:text-right" data-testid="upload-dialog">
          <DialogHeader>
            <DialogTitle className="text-right">رفع استمارة العضوية</DialogTitle>
            <DialogDescription className="text-right">اختر ملف PDF أو صورة الاستمارة، وسيتم استخراج البيانات تلقائياً ثم تظهر للمراجعة.</DialogDescription>
          </DialogHeader>
          <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100" data-testid="upload-dropzone">
            <UploadCloud className="h-7 w-7 text-[#0f3a73]" />
            <span>{busy ? "جاري الرفع..." : "اسحب وأفلت الملف هنا أو اضغط للاختيار"}</span>
            <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={uploadDocument} disabled={busy} data-testid="document-upload-input" />
          </label>
          {(dialogStatus || error) && (
            <div className={`rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`} data-testid="upload-dialog-message">{error || dialogStatus}</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto text-right sm:text-right" data-testid="add-member-dialog">
          <DialogHeader>
            <DialogTitle className="text-right" data-testid="add-member-dialog-title">{editingMemberId ? "تعديل بيانات العضو" : (formMode === "upload" ? "مراجعة بيانات الاستمارة" : "إضافة عضو جديد")}</DialogTitle>
            <DialogDescription className="text-right">{editingMemberId ? "عدّل البيانات ثم اضغط حفظ." : formMode === "upload" ? "راجع البيانات المستخرجة من الاستمارة وعدّلها إذا لزم، ثم احفظ." : "أدخل بيانات العضو يدوياً. يمكنك إضافة عدة أعضاء متتالية بدون إغلاق النافذة."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => saveMember(e, { keepOpen: false })} className="grid gap-4 md:grid-cols-2" data-testid="member-save-form">
            {fields.map(([key, label]) => (
              <div key={key} className={`grid gap-1.5 ${key === "address" || key === "address_phone" || key === "beneficiary_name" ? "md:col-span-2" : ""}`} data-testid={`member-field-wrapper-${key}`}>
                <Label htmlFor={`member-${key}`} className="text-xs font-bold text-slate-600">{label}</Label>
                {key === "status" ? (
                  <Select value={memberForm.status || "فعال"} onValueChange={(value) => setMemberForm({ ...memberForm, status: value })}>
                    <SelectTrigger id={`member-${key}`} data-testid={`member-input-${key}`}><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                      {STATUS_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                ) : key === "governorate" ? (
                  <select
                    id={`member-${key}`}
                    value={memberForm.governorate || ""}
                    onChange={(e) => setMemberForm({ ...memberForm, governorate: e.target.value, union_committee: "" })}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                    data-testid={`member-input-${key}`}
                  >
                    <option value="">اختر المحافظة...</option>
                    {classifications.governorates.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                ) : key === "union_committee" ? (
                  <select
                    id={`member-${key}`}
                    value={memberForm.union_committee || ""}
                    onChange={(e) => setMemberForm({ ...memberForm, union_committee: e.target.value })}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={!memberForm.governorate}
                    data-testid={`member-input-${key}`}
                  >
                    <option value="">{memberForm.governorate ? "اختر اللجنة النقابية..." : "اختر المحافظة أولاً"}</option>
                    {(memberForm.governorate
                      ? (classifications.committees_by_governorate || {})[memberForm.governorate] || []
                      : classifications.union_committees
                    ).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                ) : key.includes("address") ? (
                  <Textarea id={`member-${key}`} value={memberForm[key] || ""} onChange={(e) => setMemberForm({ ...memberForm, [key]: e.target.value })} rows={2} data-testid={`member-input-${key}`} />
                ) : (
                  <Input 
                    id={`member-${key}`} 
                    type={dateFields.includes(key) ? "date" : "text"} 
                    value={memberForm[key] || ""} 
                    onChange={(e) => setMemberForm({ ...memberForm, [key]: e.target.value })} 
                    data-testid={`member-input-${key}`} 
                  />
                )}
              </div>
            ))}
            {(dialogStatus || error) && (
              <div className={`md:col-span-2 rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`} data-testid="add-dialog-message">{error || dialogStatus}</div>
            )}
            <DialogFooter className="md:col-span-2 gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} data-testid="add-dialog-cancel">إلغاء</Button>
              {!editingMemberId && (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={(e) => saveMember(e, { keepOpen: true })}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="member-save-add-another-button"
                  title="يحفظ العضو الحالي ويُبقي النافذة مفتوحة لإضافة عضو جديد"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} حفظ وإضافة بيانات عضو جديد
                </Button>
              )}
              <Button type="submit" disabled={busy} className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="member-save-button">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {editingMemberId ? "حفظ التعديلات" : "حفظ العضو وخروج"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DuplicateMemberDialog
        open={!!duplicateInfo}
        message={duplicateInfo?.message}
        member={duplicateInfo?.member}
        allDuplicates={duplicateInfo?.all_duplicates || []}
        committeeInfo={duplicateInfo?.committees_info || []}
        duplicateCount={duplicateInfo?.duplicate_count || 1}
        onClose={() => setDuplicateInfo(null)}
      />
    </AppShell>
  );
}
