import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Plus, Save, Shield, Trash2, UserCog, Users } from "lucide-react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api, getErrorMessage } from "../lib/api";

const ROLE_OPTIONS = [
  { value: "employee", label: "موظف", className: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "admin", label: "أدمن", className: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "super_admin", label: "مدير أعلى", className: "bg-purple-100 text-purple-700 border-purple-200" },
];

const roleBadgeClass = (role) => ROLE_OPTIONS.find((r) => r.value === role)?.className || "bg-slate-100 text-slate-700 border-slate-200";

const emptyForm = { username: "", display_name: "", password: "", role: "employee", active: true, portal_permissions: [] };

export default function UsersAdminPage() {
  const [items, setItems] = useState([]);
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSuper = useMemo(() => me?.role === "super_admin", [me]);
  const [allPortals, setAllPortals] = useState([
    { key: "membership", label: "العضوية" },
    { key: "financial", label: "الموقف المالي" },
    { key: "financial.pension", label: "الموقف المالي ← المعاش" },
    { key: "financial.resignations", label: "الموقف المالي ← الاستقالات" },
    { key: "financial.dropout", label: "الموقف المالي ← الإسقاط" },
    { key: "financial.letters", label: "الموقف المالي ← الخطابات" },
    { key: "financial.subscriptions", label: "الموقف المالي ← الاشتراكات" },
    { key: "financial.dues_settlements", label: "الموقف المالي ← تسوية المستحقات" },
    { key: "financial.aid", label: "الموقف المالي ← الإعانات" },
    { key: "financial.dues", label: "الموقف المالي ← مستحقات اللجان" },
    { key: "financial.disclosure", label: "الموقف المالي ← الكشوف التفريغية" },
    { key: "admin", label: "صفحة الأدمن" },
    { key: "users", label: "إدارة المستخدمين" },
  ]);

  const load = async () => {
    setError("");
    try {
      const [{ data: users }, { data: meData }] = await Promise.all([
        api.get("/admin/users"),
        api.get("/auth/me"),
      ]);
      setItems(users);
      setMe(meData);
    } catch (err) { setError(getErrorMessage(err)); }
    // Portal list is optional: keep the built-in list if the server returns nothing.
    try {
      const { data: settings } = await api.get("/settings");
      if (Array.isArray(settings?.all_portals) && settings.all_portals.length) setAllPortals(settings.all_portals);
    } catch { /* keep defaults */ }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(""); setForm(emptyForm); setError(""); setOpen(true); };
  const openEdit = (u) => {
    setEditingId(u.id);
    setForm({ username: u.username, display_name: u.display_name, password: "", role: u.role, active: u.active, portal_permissions: u.portal_permissions || [] });
    setError("");
    setOpen(true);
  };

  const togglePortal = (key) => {
    setForm((f) => {
      const has = (f.portal_permissions || []).includes(key);
      return { ...f, portal_permissions: has ? f.portal_permissions.filter((k) => k !== key) : [...(f.portal_permissions || []), key] };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (editingId) {
        const payload = {
          display_name: form.display_name,
          role: form.role,
          active: form.active,
          portal_permissions: form.portal_permissions || [],
        };
        if (form.password) payload.password = form.password;
        await api.put(`/admin/users/${editingId}`, payload);
      } else {
        await api.post("/admin/users", form);
      }
      setOpen(false); setForm(emptyForm); setEditingId("");
      await load();
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const remove = async (u) => {
    if (!window.confirm(`حذف المستخدم "${u.display_name}" (${u.username})؟`)) return;
    setError("");
    try {
      await api.delete(`/admin/users/${u.id}`);
      await load();
    } catch (err) { setError(getErrorMessage(err)); }
  };

  return (
    <AppShell title="إدارة المستخدمين" subtitle="إضافة الموظفين والمسؤولين وضبط الأدوار والصلاحيات.">
      <div className="space-y-6" data-testid="users-admin-page">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0f3a73]/10 text-[#0f3a73]"><Users className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">المستخدمون المسجلون</h2>
              <p className="text-xs text-slate-500">إجمالي {items.length} مستخدم — {me ? `أنت مسجل دخول كـ ${me.display_name} (${ROLE_OPTIONS.find((r) => r.value === me.role)?.label || me.role})` : "..."}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin"><Button variant="outline" data-testid="users-back-btn"><ArrowRight className="h-4 w-4" /> الأدمن</Button></Link>
            <Button onClick={openCreate} className="bg-[#0f3a73] hover:bg-[#103e7d]" data-testid="users-add-btn"><Plus className="h-4 w-4" /> إضافة مستخدم</Button>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="users-error">{error}</div>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="users-table-section">
          <div className="overflow-x-auto">
            <Table data-testid="users-table">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-start">الاسم الكامل</TableHead>
                  <TableHead className="text-start">اسم المستخدم</TableHead>
                  <TableHead className="text-start">الدور</TableHead>
                  <TableHead className="text-start">الحالة</TableHead>
                  <TableHead className="text-start">تاريخ الإضافة</TableHead>
                  <TableHead className="text-start">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((u) => (
                  <TableRow key={u.id} data-testid={`users-row-${u.id}`}>
                    <TableCell className="font-bold text-slate-950">{u.display_name}</TableCell>
                    <TableCell className="tabular-nums">{u.username}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${roleBadgeClass(u.role)}`}>
                        <Shield className="ms-1 h-3 w-3" /> {u.role_label || u.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">مُفعَّل</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">موقوف</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-slate-500">{(u.created_at || "").slice(0, 10)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(u)} data-testid={`users-edit-${u.id}`}>
                          <UserCog className="h-4 w-4" /> تعديل
                        </Button>
                        {u.id !== me?.id && (
                          <Button size="sm" variant="ghost" onClick={() => remove(u)} className="text-rose-600 hover:bg-rose-50" data-testid={`users-delete-${u.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!items.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-slate-500" data-testid="users-empty">
                      لا يوجد مستخدمون مسجلون.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="users-dialog">
          <DialogHeader>
            <DialogTitle className="text-right">{editingId ? "تعديل بيانات المستخدم" : "إضافة مستخدم جديد"}</DialogTitle>
            <DialogDescription className="text-right">
              {editingId ? "حدِّث بيانات المستخدم وكلمة المرور (اختياري)." : "أدخل بيانات المستخدم الجديد. كلمة المرور لا تقل عن 4 أحرف."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4" data-testid="users-form">
            <div className="grid gap-1.5">
              <Label htmlFor="u-display-name" className="text-xs font-bold text-slate-600">الاسم الكامل</Label>
              <Input id="u-display-name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} required data-testid="users-input-name" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-username" className="text-xs font-bold text-slate-600">اسم المستخدم (لتسجيل الدخول)</Label>
              <Input id="u-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required disabled={!!editingId} data-testid="users-input-username" />
              {editingId && <p className="text-[10px] text-slate-400">اسم المستخدم لا يمكن تغييره بعد الإنشاء.</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-password" className="text-xs font-bold text-slate-600">{editingId ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}</Label>
              <Input id="u-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} data-testid="users-input-password" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-role" className="text-xs font-bold text-slate-600">الدور</Label>
              <select
                id="u-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                data-testid="users-input-role"
              >
                {ROLE_OPTIONS.filter((r) => isSuper || r.value === "employee").map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {!isSuper && <p className="text-[10px] text-slate-400">فقط المدير الأعلى يستطيع تعيين دور أدمن أو مدير أعلى.</p>}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span className="text-xs font-bold text-slate-600">حساب مُفعَّل (يمكنه تسجيل الدخول)</span>
              <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="users-input-active" />
            </div>

            {form.role !== "super_admin" && (
              <div className="grid gap-2 rounded-lg border border-slate-200 p-3" data-testid="users-portals-block">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-600">صلاحيات الوصول للبوابات</Label>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, portal_permissions: allPortals.filter((p) => p.key !== "admin" && p.key !== "users").map((p) => p.key) })} data-testid="users-portals-select-all">الكل (عدا الأدمن)</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, portal_permissions: [] })} data-testid="users-portals-clear">إلغاء الكل</Button>
                  </div>
                </div>
                <div className="grid gap-1 md:grid-cols-2 items-stretch max-h-56 overflow-y-auto">
                  {allPortals.map((p) => {
                    const has = (form.portal_permissions || []).includes(p.key);
                    return (
                      <button type="button" key={p.key} onClick={() => togglePortal(p.key)} className={`flex items-center gap-2 rounded border px-2 py-1.5 text-start text-xs transition min-h-[2.5rem] ${has ? "border-[#0f3a73] bg-[#0f3a73]/5 font-bold text-[#0f3a73]" : "border-slate-200 bg-white hover:bg-slate-50"}`} data-testid={`users-portal-${p.key}`}>
                        <span className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded ${has ? "bg-[#0f3a73] text-white" : "bg-slate-200"}`}>{has ? "✓" : ""}</span>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400">المدير الأعلى والأدمن لديهم وصول كامل تلقائيًا، لذا لا تظهر هذه الصلاحيات لهم.</p>
              </div>
            )}

            {error && <p className="text-sm text-rose-600" data-testid="users-form-error">{error}</p>}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="users-cancel-btn">إلغاء</Button>
              <Button type="submit" className="bg-[#0f3a73] hover:bg-[#103e7d]" disabled={busy} data-testid="users-submit-btn">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
