import { useEffect, useState } from "react";
import { Building2, CalendarClock, Clock, ListChecks, Loader2, Plus, Save, Trash2, Users, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import AppShell from "../components/AppShell";
import BackupRestoreCard from "../components/BackupRestoreCard";
import LocalUpdateManager from "../components/LocalUpdateManager";
import MemberDedupDialog from "../components/MemberDedupDialog";
import MemberMissingDataDialog from "../components/MemberMissingDataDialog";
import TaxonomyAdmin from "../components/TaxonomyAdmin";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { api, getErrorMessage } from "../lib/api";

const emptyDepartment = { name: "", code: "", description: "", active: true };
const emptyRetirementRow = { effective_date: "", retirement_age: 60, description: "" };

export default function AdminPage() {
  const [departments, setDepartments] = useState([]);
  const [departmentForm, setDepartmentForm] = useState(emptyDepartment);
  const [retirementSchedule, setRetirementSchedule] = useState([]);
  const [sessionHours, setSessionHours] = useState(12);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [departmentsRes, retirementRes, settingsRes] = await Promise.all([
        api.get("/departments"),
        api.get("/admin/retirement-schedule"),
        api.get("/admin/settings"),
      ]);
      setDepartments(departmentsRes.data);
      setRetirementSchedule(retirementRes.data);
      setSessionHours(settingsRes.data.session_timeout_hours || 12);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const saveSessionTimeout = async () => {
    setError(""); setStatus("");
    try {
      const h = Math.max(1, Math.min(720, Number(sessionHours) || 12));
      await api.put("/admin/settings", { session_timeout_hours: h });
      setSessionHours(h);
      setStatus(`تم حفظ مدة الجلسة (${h} ساعة). ستُطبَّق على عمليات تسجيل الدخول القادمة.`);
    } catch (err) { setError(getErrorMessage(err)); }
  };

  const saveDepartment = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    try {
      await api.post("/departments", departmentForm);
      setDepartmentForm(emptyDepartment);
      setStatus("تمت إضافة الإدارة بنجاح");
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const deleteDepartment = async (departmentId, departmentName) => {
    if (!window.confirm(`هل أنت متأكد من حذف الإدارة "${departmentName}"؟\n\nتحذير: لن تتمكن من حذف الإدارة إذا كان بها أعضاء أو اشتراكات أو مساعدات مسجلة.`)) {
      return;
    }
    
    setError("");
    setStatus("");
    const tId = toast.loading("جاري الحذف...");
    
    try {
      await api.delete(`/departments/${departmentId}`);
      toast.dismiss(tId);
      toast.success("تم حذف الإدارة بنجاح");
      loadData();
    } catch (err) {
      toast.dismiss(tId);
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const updateRetirementRow = (index, key, value) => {
    setRetirementSchedule((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  };

  const addRetirementRow = () => {
    setRetirementSchedule((rows) => [...rows, emptyRetirementRow]);
  };

  const removeRetirementRow = (index) => {
    setRetirementSchedule((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  };

  const currentUser = JSON.parse(localStorage.getItem("archive_user") || "{}");
  const isSuperAdmin = currentUser.role === "super_admin";

  const saveRetirementSchedule = async () => {
    setError("");
    setStatus("");
    try {
      const payload = retirementSchedule.map((row) => ({
        effective_date: row.effective_date,
        retirement_age: Number(row.retirement_age),
        description: row.description,
      }));
      const { data } = await api.put("/admin/retirement-schedule", payload);
      setRetirementSchedule(data);
      setStatus("تم حفظ جدول سن المعاش بنجاح");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // --- Committee name de-duplication ---
  const [dedupOpen, setDedupOpen] = useState(false);
  const [dedupDeptId, setDedupDeptId] = useState("");
  const [dedupThreshold, setDedupThreshold] = useState(0.78);
  // When ON, also flags the same committee name appearing under DIFFERENT
  // governorates (catches "I picked the wrong محافظة" typos but produces
  // false positives for legitimately shared committee structures).
  const [dedupCrossGov, setDedupCrossGov] = useState(false);
  const [dedupScanning, setDedupScanning] = useState(false);
  const [dedupApplying, setDedupApplying] = useState(false);
  const [dedupStats, setDedupStats] = useState(null);
  // Member-level duplicate detection dialog.
  const [memberDedupOpen, setMemberDedupOpen] = useState(false);
  const openMemberDedup = () => setMemberDedupOpen(true);
  // Member missing-data correction dialog.
  const [missingOpen, setMissingOpen] = useState(false);
  const openMissing = () => setMissingOpen(true);
  // Cluster shape kept locally with editable canonical and per-variant selection
  const [dedupClusters, setDedupClusters] = useState([]);

  const openDedup = () => {
    const firstDept = departments[0]?.id || "";
    setDedupDeptId(firstDept);
    setDedupClusters([]);
    setDedupOpen(true);
  };

  const scanDedup = async () => {
    if (!dedupDeptId) {
      toast.error("اختر الإدارة أولاً");
      return;
    }
    setDedupScanning(true);
    const tId = toast.loading("جاري التنفيذ — فحص أسماء اللجان...");
    try {
      const params = new URLSearchParams({
        department_id: dedupDeptId,
        threshold: String(dedupThreshold),
        cross_governorate: dedupCrossGov ? "true" : "false",
      });
      const { data } = await api.get(`/admin/committees/duplicates?${params.toString()}`);
      setDedupStats(data.stats || null);
      const local = (data.clusters || []).map((c, idx) => ({
        id: idx,
        kind: c.kind || "same_governorate_fuzzy",
        governorate: c.governorate,
        canonical: c.canonical,
        // Each variant has its own enabled flag (the canonical itself is always kept)
        variants: c.variants.map((v) => ({
          name: v.name,
          count: v.count,
          governorate: v.governorate || c.governorate,
          // By default, mark non-canonical variants as enabled (to be merged)
          enabled: v.name !== c.canonical,
        })),
      }));
      setDedupClusters(local);
      const s = data.stats || {};
      if (local.length === 0) {
        toast.success(
          `لا توجد أسماء متشابهة عند الحساسية الحالية (تم فحص ${s.distinct_committees || 0} لجنة في ${s.governorates_scanned || 0} محافظة). جرّب تقليل الحساسية أو تفعيل "البحث عبر المحافظات".`,
          { id: tId, duration: 5000 },
        );
      } else {
        toast.success(`تم العثور على ${local.length} مجموعة (فحص ${s.distinct_committees || 0} لجنة) — راجعها قبل التطبيق`, { id: tId, duration: 3500 });
      }
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setDedupScanning(false);
    }
  };

  const setCanonical = (clusterIdx, name) => {
    setDedupClusters((prev) => prev.map((c, i) => {
      if (i !== clusterIdx) return c;
      const variants = c.variants.map((v) => ({
        ...v,
        // When the canonical changes, by default mark the new canonical as kept (disabled)
        // and others as merge-targets (enabled), preserving user's prior toggles.
        enabled: v.name !== name,
      }));
      return { ...c, canonical: name, variants };
    }));
  };

  const toggleVariant = (clusterIdx, variantIdx) => {
    setDedupClusters((prev) => prev.map((c, i) => {
      if (i !== clusterIdx) return c;
      const variants = c.variants.map((v, j) => j === variantIdx ? { ...v, enabled: !v.enabled } : v);
      return { ...c, variants };
    }));
  };

  const removeCluster = (clusterIdx) => {
    setDedupClusters((prev) => prev.filter((_, i) => i !== clusterIdx));
  };

  const applyDedup = async () => {
    const operations = dedupClusters
      .map((c) => ({
        governorate: c.governorate,
        canonical: c.canonical,
        aliases: c.variants.filter((v) => v.enabled && v.name !== c.canonical).map((v) => v.name),
      }))
      .filter((op) => op.aliases.length > 0);
    if (operations.length === 0) {
      toast.warning("لا توجد عمليات دمج محددة");
      return;
    }
    if (!window.confirm(`ستتم عملية تصحيح ${operations.length} مجموعة من أسماء اللجان. متابعة؟`)) return;
    setDedupApplying(true);
    const tId = toast.loading("جاري التنفيذ — تطبيق التصحيح على بيانات الأعضاء...");
    try {
      const { data } = await api.post(`/admin/committees/merge`, {
        department_id: dedupDeptId,
        operations,
      });
      toast.success(`تم تصحيح ${data.total_updated} عضو في ${operations.length} مجموعة`, { id: tId, duration: 4000 });
      setDedupOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setDedupApplying(false);
    }
  };

  return (
    <AppShell title="صفحة الأدمن" subtitle="إدارة الإدارات وجدول سن المعاش والمستخدمين.">
      <div className="mb-6 grid gap-4 md:grid-cols-2" data-testid="admin-quick-settings">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#0f3a73]/20 bg-gradient-to-l from-[#0f3a73]/5 to-transparent p-4" data-testid="admin-users-banner">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0f3a73] text-white"><Users className="h-5 w-5" /></div>
            <div>
              <h3 className="text-base font-extrabold text-slate-950">إدارة المستخدمين</h3>
              <p className="text-xs text-slate-500">إضافة، أدوار، كلمات مرور، صلاحيات بوابات.</p>
            </div>
          </div>
          <Link to="/admin/users"><Button className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="admin-open-users-btn"><Users className="h-4 w-4" /> فتح</Button></Link>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-purple-200 bg-purple-50/40 p-4" data-testid="admin-dedup-banner">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-600 text-white"><Wand2 className="h-5 w-5" /></div>
            <div>
              <h3 className="text-base font-extrabold text-slate-950">توحيد أسماء اللجان المتشابهة</h3>
              <p className="text-xs text-slate-500">اكتشاف الأخطاء الإملائية وتوحيدها تلقائياً.</p>
            </div>
          </div>
          <Button onClick={openDedup} className="bg-purple-600 hover:bg-purple-700" data-testid="admin-open-dedup-btn"><Wand2 className="h-4 w-4" /> فحص الأسماء</Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/40 p-4" data-testid="admin-member-dedup-banner">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-rose-600 text-white"><Users className="h-5 w-5" /></div>
            <div>
              <h3 className="text-base font-extrabold text-slate-950">كشف الأعضاء المكررين</h3>
              <p className="text-xs text-slate-500">ترشيحات تلقائية لأعضاء نفس الشخص داخل اللجنة.</p>
            </div>
          </div>
          <Button onClick={openMemberDedup} className="bg-rose-600 hover:bg-rose-700" data-testid="admin-open-member-dedup-btn"><Users className="h-4 w-4" /> فحص الأعضاء</Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4" data-testid="admin-missing-banner">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white"><ListChecks className="h-5 w-5" /></div>
            <div>
              <h3 className="text-base font-extrabold text-slate-950">تصحيح بيانات الأعضاء</h3>
              <p className="text-xs text-slate-500">كشف الأعضاء ناقصي البيانات وتعبئتها مباشرة من مكان واحد.</p>
            </div>
          </div>
          <Button onClick={openMissing} className="bg-indigo-600 hover:bg-indigo-700" data-testid="admin-open-missing-btn"><ListChecks className="h-4 w-4" /> فحص البيانات الناقصة</Button>
        </div>

        <TaxonomyAdmin departments={departments} />
      </div>

      <div className="mb-6">
        <BackupRestoreCard />
      </div>

      {isSuperAdmin && (
        <div className="mb-6 grid gap-4 md:grid-cols-2" data-testid="admin-super-only-row">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-gradient-to-l from-amber-50 to-transparent p-4" data-testid="admin-credits-banner">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md">
                <span className="text-lg font-extrabold">©</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-950">بصمة المبرمج وحقوق الملكية الفكرية</h3>
                <p className="text-xs text-slate-500">شهادة موثّقة بمعلومات المبرمج والتوقيع المعتمد — للمدير العام فقط.</p>
              </div>
            </div>
            <Link to="/admin/credits"><Button className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="admin-open-credits-btn">عرض الشهادة</Button></Link>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-gradient-to-l from-emerald-50 to-transparent p-4" data-testid="admin-manual-banner">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white shadow-md">
                <span className="text-lg font-extrabold">📘</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-950">كتيب إرشادات المستخدم</h3>
                <p className="text-xs text-slate-500">دليل تدريبي بالعربية والإنجليزية + إمكانية حفظ PDF.</p>
              </div>
            </div>
            <Link to="/manual"><Button className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="admin-open-manual-btn">فتح الكتيب</Button></Link>
          </div>
        </div>
      )}

      {isSuperAdmin && (
        <div className="mb-6">
          <LocalUpdateManager />
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-1" data-testid="admin-session-settings">
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4" data-testid="admin-session-card">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500 text-white"><Clock className="h-5 w-5" /></div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-slate-950">مدة جلسة تسجيل الدخول</h3>
            <p className="text-xs text-slate-500">القيمة الحالية: <strong>{sessionHours} ساعة</strong>. تطبق على الجلسات الجديدة.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={720} value={sessionHours} onChange={(e) => setSessionHours(e.target.value)} className="w-20" data-testid="admin-session-input" />
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={saveSessionTimeout} data-testid="admin-session-save"><Save className="h-4 w-4" /> حفظ</Button>
          </div>
        </div>
      </div>
      <div className="grid gap-6 2xl:grid-cols-2" data-testid="admin-page">
        <Card className="rounded-lg border-slate-200 shadow-none" data-testid="department-admin-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl" data-testid="department-admin-title"><Building2 className="h-5 w-5 text-[#0047AB]" /> الإدارات</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <p className="flex items-center gap-2 text-sm text-slate-500" data-testid="admin-loading-message"><Loader2 className="h-4 w-4 animate-spin" /> تحميل البيانات...</p>}
            <form onSubmit={saveDepartment} className="grid gap-4" data-testid="department-create-form">
              <div className="grid gap-2">
                <Label htmlFor="department-name" data-testid="department-name-label">اسم الإدارة</Label>
                <Input id="department-name" value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} data-testid="department-name-input" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department-code" data-testid="department-code-label">كود مختصر</Label>
                <Input id="department-code" value={departmentForm.code} onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })} data-testid="department-code-input" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department-description" data-testid="department-description-label">وصف الإدارة</Label>
                <Textarea id="department-description" value={departmentForm.description} onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })} data-testid="department-description-input" />
              </div>
              <Button type="submit" className="bg-[#0047AB] hover:bg-[#003380]" data-testid="department-save-button"><Plus className="h-4 w-4" /> إضافة إدارة</Button>
            </form>
            {(status || error) && (
              <div className={`mt-4 rounded-lg border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`} data-testid="admin-status-message">
                {error || status}
              </div>
            )}
            <div className="mt-6 space-y-3" data-testid="departments-admin-list">
              {departments.map((department) => (
                <div key={department.id} className="rounded-lg border border-slate-200 p-4" data-testid={`admin-department-row-${department.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <strong className="text-slate-950" data-testid={`admin-department-name-${department.id}`}>{department.name}</strong>
                      <Badge variant="outline" data-testid={`admin-department-status-${department.id}`}>{department.active ? "فعال" : "متوقف"}</Badge>
                    </div>
                    {isSuperAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteDepartment(department.id, department.name)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        data-testid={`admin-department-delete-${department.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-500" data-testid={`admin-department-description-${department.id}`}>{department.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-slate-200 shadow-none" data-testid="retirement-schedule-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl" data-testid="retirement-schedule-title"><CalendarClock className="h-5 w-5 text-[#0047AB]" /> جدول سن المعاش</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900" data-testid="retirement-schedule-note">
              يتم استخدام هذا الجدول لتصفية الأعضاء المستحقين للخروج على المعاش وحساب حجم العضوية حسب المحافظة واللجنة النقابية.
            </div>
            <div className="space-y-3" data-testid="retirement-schedule-list">
              {retirementSchedule.map((row, index) => (
                <div key={row.id || index} className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[180px_140px_1fr_auto]" data-testid={`retirement-row-${index}`}>
                  <div className="grid gap-2">
                    <Label htmlFor={`retirement-date-${index}`} data-testid={`retirement-date-label-${index}`}>تاريخ التطبيق</Label>
                    <Input id={`retirement-date-${index}`} type="date" value={row.effective_date} onChange={(e) => updateRetirementRow(index, "effective_date", e.target.value)} data-testid={`retirement-date-input-${index}`} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`retirement-age-${index}`} data-testid={`retirement-age-label-${index}`}>سن المعاش</Label>
                    <Input id={`retirement-age-${index}`} type="number" value={row.retirement_age} onChange={(e) => updateRetirementRow(index, "retirement_age", e.target.value)} data-testid={`retirement-age-input-${index}`} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`retirement-description-${index}`} data-testid={`retirement-description-label-${index}`}>الوصف</Label>
                    <Input id={`retirement-description-${index}`} value={row.description} onChange={(e) => updateRetirementRow(index, "description", e.target.value)} data-testid={`retirement-description-input-${index}`} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" onClick={() => removeRetirementRow(index)} data-testid={`retirement-remove-button-${index}`}><Trash2 className="h-4 w-4" /> حذف</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3" data-testid="retirement-schedule-actions">
              <Button type="button" variant="outline" onClick={addRetirementRow} data-testid="retirement-add-row-button"><Plus className="h-4 w-4" /> إضافة مرحلة</Button>
              <Button type="button" className="bg-[#0047AB] hover:bg-[#003380]" onClick={saveRetirementSchedule} data-testid="retirement-save-button"><Save className="h-4 w-4" /> حفظ جدول المعاش</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Committee names de-duplication dialog */}
      <Dialog open={dedupOpen} onOpenChange={setDedupOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] max-w-4xl overflow-y-auto text-right sm:text-right" data-testid="dedup-dialog">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2"><Wand2 className="h-5 w-5 text-purple-600" /> توحيد أسماء اللجان المتشابهة</DialogTitle>
            <DialogDescription className="text-right">
              يقوم النظام بمسح أسماء اللجان داخل كل محافظة، ويعرض المجموعات المتشابهة (مثل أخطاء إملائية). راجع المجموعات وعدّل الاسم الصحيح ثم اضغط تطبيق.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4" data-testid="dedup-controls">
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">الإدارة</Label>
              <select value={dedupDeptId} onChange={(e) => { setDedupDeptId(e.target.value); setDedupClusters([]); setDedupStats(null); }} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="dedup-dept-select">
                <option value="">— اختر إدارة —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">حساسية التشابه ({Math.round(dedupThreshold * 100)}%)</Label>
              <input type="range" min="0.6" max="0.98" step="0.01" value={dedupThreshold} onChange={(e) => setDedupThreshold(Number(e.target.value))} className="h-9" data-testid="dedup-threshold-input" />
              <p className="text-[10px] text-slate-500">أقل = نتائج أكثر | أعلى = نتائج أدق</p>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-bold text-slate-600">البحث عبر المحافظات</Label>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs">
                <input
                  type="checkbox"
                  checked={dedupCrossGov}
                  onChange={(e) => setDedupCrossGov(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-purple-600"
                  data-testid="dedup-cross-gov-toggle"
                />
                <span>إظهار اللجان المتطابقة في محافظات مختلفة</span>
              </label>
              <p className="text-[10px] text-slate-500">مفيد لاكتشاف اختيار خاطئ للمحافظة</p>
            </div>
            <div className="flex items-end">
              <Button onClick={scanDedup} disabled={dedupScanning || !dedupDeptId} className="w-full bg-purple-600 hover:bg-purple-700" data-testid="dedup-scan-btn">
                {dedupScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} فحص الأسماء
              </Button>
            </div>
          </div>

          {dedupStats && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-900" data-testid="dedup-stats">
              <strong>إحصائيات الفحص:</strong>
              <span>تم فحص <strong className="tabular-nums">{dedupStats.distinct_committees}</strong> لجنة</span>
              <span>•</span>
              <span>في <strong className="tabular-nums">{dedupStats.governorates_scanned}</strong> محافظة</span>
              <span>•</span>
              <span>عُقدت <strong className="tabular-nums">{dedupStats.pairs_compared}</strong> مقارنة</span>
            </div>
          )}

          <div className="mt-4 space-y-4" data-testid="dedup-results">
            {dedupClusters.length === 0 && !dedupScanning && (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500" data-testid="dedup-empty">
                اضغط <strong>"فحص الأسماء"</strong> لاكتشاف اللجان المتشابهة.
              </p>
            )}
            {dedupClusters.map((c, ci) => {
              const aliasesCount = c.variants.filter((v) => v.enabled && v.name !== c.canonical).length;
              const totalAffected = c.variants.filter((v) => v.enabled && v.name !== c.canonical).reduce((s, v) => s + v.count, 0);
              const isCrossGov = c.kind === "cross_governorate_same_name";
              return (
                <div key={c.id} className={`rounded-xl border p-4 ${isCrossGov ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"}`} data-testid={`dedup-cluster-${ci}`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isCrossGov ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">نفس اللجنة في محافظات مختلفة</span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{c.governorate}</span>
                      )}
                      <span className="text-xs text-slate-500">
                        {isCrossGov
                          ? `موجودة في ${c.variants.length} محافظة (إجمالي ${c.variants.reduce((s, v) => s + v.count, 0)} عضو) — للمراجعة فقط`
                          : `سيتم تصحيح ${totalAffected} عضو (${aliasesCount} اسم بديل)`}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeCluster(ci)} className="text-slate-500 hover:text-red-600" data-testid={`dedup-remove-${ci}`}>
                      <Trash2 className="h-3.5 w-3.5" /> تخطي
                    </Button>
                  </div>
                  {!isCrossGov && (
                    <div className="mb-3 grid gap-1.5">
                      <Label className="text-xs font-bold text-emerald-700">الاسم الصحيح (Canonical)</Label>
                      <Input value={c.canonical} onChange={(e) => setCanonical(ci, e.target.value)} className="border-emerald-300 bg-emerald-50/50 font-bold" data-testid={`dedup-canonical-${ci}`} />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label className="text-xs font-bold text-slate-600">{isCrossGov ? "اللجان المكتشفة" : "المتغيرات المكتشفة"}</Label>
                    {c.variants.map((v, vi) => {
                      const isCanonical = !isCrossGov && v.name === c.canonical;
                      return (
                        <label key={vi} className={`flex items-center justify-between gap-3 rounded-md border p-2 ${isCanonical ? "border-emerald-300 bg-emerald-50/40" : isCrossGov ? "border-amber-200 bg-white" : v.enabled ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white"}`} data-testid={`dedup-variant-${ci}-${vi}`}>
                          <div className="flex items-center gap-2">
                            {!isCrossGov && (
                              <input
                                type="checkbox"
                                checked={v.enabled || isCanonical}
                                disabled={isCanonical}
                                onChange={() => toggleVariant(ci, vi)}
                                className="h-4 w-4 cursor-pointer accent-purple-600"
                                data-testid={`dedup-variant-toggle-${ci}-${vi}`}
                              />
                            )}
                            {isCrossGov && (
                              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 tabular-nums">{v.governorate}</span>
                            )}
                            <span className={isCanonical ? "font-extrabold text-emerald-800" : "text-slate-800"}>
                              {v.name}
                            </span>
                            {isCanonical && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">الاسم الصحيح</span>}
                          </div>
                          <span className="text-xs font-bold tabular-nums text-slate-600">{v.count} عضو</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDedupOpen(false)} data-testid="dedup-cancel-btn">إغلاق</Button>
            <Button
              onClick={applyDedup}
              disabled={dedupApplying || dedupClusters.length === 0}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="dedup-apply-btn"
            >
              {dedupApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} تطبيق التصحيح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberDedupDialog open={memberDedupOpen} onOpenChange={setMemberDedupOpen} departments={departments} />
      <MemberMissingDataDialog open={missingOpen} onOpenChange={setMissingOpen} departments={departments} />
    </AppShell>
  );
}
