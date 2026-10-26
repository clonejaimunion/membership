import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Calculator, Clock, Eye, HandCoins, Loader2, Plus, RefreshCw, RotateCcw, Save, Search, Trash2, Wallet } from "lucide-react";
import AppShell from "../components/AppShell";
import GatewayHero from "../components/GatewayHero";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api, getErrorMessage } from "../lib/api";
import InheritanceCalculatorDialog from "../components/InheritanceCalculatorDialog";

const fmtNum = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const aidTypeBadge = (t) =>
  t === "وفاة"
    ? "bg-slate-200 text-slate-700 border-slate-300"
    : "bg-purple-100 text-purple-700 border-purple-200";

const emptyDisburse = { cheque_number: "", cheque_date: "", cheque_bank: "", amount: "", beneficiaries: [""] };

export default function AidPendingPage() {
  const { id } = useParams();
  const [department, setDepartment] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [form, setForm] = useState(emptyDisburse);
  const [busy, setBusy] = useState(false);
  
  // حالة الحاسبة
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calcBusy, setCalcBusy] = useState(false);

  const load = async () => {
    const params = new URLSearchParams({ department_id: id, status: "pending" });
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

  const openDisburse = (aid) => {
    setActive(aid);
    setForm({ ...emptyDisburse, beneficiaries: aid.member_beneficiary_name ? [aid.member_beneficiary_name] : [""] });
    setError("");
    setOpen(true);
  };

  const openView = (aid) => {
    // فتح استمارة بحث الحالة في نافذة جديدة
    const apiUrl = process.env.REACT_APP_BACKEND_URL || "";
    const token = localStorage.getItem("archive_token");
    const url = `${apiUrl}/api/members/${aid.member_id}/case-form?mode=view`;
    
    // فتح نافذة جديدة
    const newWindow = window.open("", "_blank", "width=1200,height=900");
    
    if (newWindow) {
      // كتابة صفحة تحميل أولية
      newWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
          <head>
            <meta charset="UTF-8">
            <title>استمارة بحث الحالة - ${aid.member_name}</title>
            <style>
              body { margin: 0; padding: 0; overflow: auto; }
              .loader { 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                font-family: Arial, sans-serif;
                color: #64748b;
                font-size: 18px;
              }
            </style>
          </head>
          <body>
            <div class="loader">جاري تحميل الاستمارة...</div>
          </body>
        </html>
      `);
      newWindow.document.close();
      
      // جلب الاستمارة
      fetch(url, {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      })
      .then(res => {
        if (!res.ok) throw new Error('فشل تحميل الاستمارة');
        return res.text();
      })
      .then(html => {
        // استبدال محتوى الصفحة بالاستمارة
        newWindow.document.open();
        newWindow.document.write(html);
        newWindow.document.close();
      })
      .catch(err => {
        newWindow.document.open();
        newWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl">
            <head>
              <meta charset="UTF-8">
              <title>خطأ</title>
              <style>
                body { 
                  margin: 0; 
                  padding: 40px; 
                  font-family: Arial, sans-serif;
                  text-align: center;
                }
                .error { 
                  color: #ef4444; 
                  font-size: 18px;
                  margin-top: 20px;
                }
              </style>
            </head>
            <body>
              <div class="error">⚠️ حدث خطأ أثناء تحميل الاستمارة</div>
              <p style="color: #64748b; margin-top: 10px;">${err.message}</p>
            </body>
          </html>
        `);
        newWindow.document.close();
      });
    }
  };
  
  const openCalculator = (aid) => {
    setActive(aid);
    setCalculatorOpen(true);
  };

  const setBeneficiary = (idx, val) => {
    setForm((f) => {
      const copy = [...f.beneficiaries];
      copy[idx] = val;
      return { ...f, beneficiaries: copy };
    });
  };
  const addBeneficiary = () => setForm((f) => ({ ...f, beneficiaries: [...f.beneficiaries, ""] }));
  const removeBeneficiary = (idx) => setForm((f) => ({ ...f, beneficiaries: f.beneficiaries.filter((_, i) => i !== idx) }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const payload = {
        cheque_number: form.cheque_number.trim(),
        cheque_date: form.cheque_date,
        cheque_bank: form.cheque_bank.trim(),
        amount: Number(form.amount || 0),
        beneficiaries: form.beneficiaries.map((b) => (b || "").trim()).filter(Boolean),
      };
      await api.post(`/aids/${active.id}/disburse`, payload);
      setOpen(false); setActive(null); setForm(emptyDisburse);
      await load();
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const togglePrintNote = async (aidId, enabled) => {
    try {
      await api.patch(`/aids/${aidId}/print-note`, { enabled });
      setItems((prev) => prev.map((it) => (it.id === aidId ? { ...it, print_dues_note: enabled } : it)));
    } catch (err) { setError(getErrorMessage(err)); }
  };

  const currentUser = JSON.parse(localStorage.getItem("archive_user") || "{}");
  const isAdmin = currentUser.role === "super_admin" || currentUser.role === "admin";

  const restoreMember = async (aid) => {
    const memberName = aid.member_name || "العضو";
    if (!window.confirm(`هل تريد رد ${memberName} إلى حالة "فعّال" وحذف هذه الإعانة المعلّقة؟`)) return;
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
    if (!window.confirm(`هل تريد حذف هذه الإعانة المعلّقة الخاصة بـ ${memberName} نهائياً؟\n\nملاحظة: العضو سيبقى بحالته الحالية (متوفي/عجز).`)) return;
    const tId = toast.loading("جاري التنفيذ — حذف الإعانة...");
    try {
      await api.delete(`/aids/${aid.id}`);
      toast.success("تم حذف الإعانة المعلّقة", { id: tId, duration: 2000 });
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
      // Patch the row in-place so the user sees the new number without a full reload.
      setItems((prev) => prev.map((it) => (
        it.id === aid.id ? { ...it, ...(data?.aid || {}), committee_dues: dues } : it
      )));
      toast.success(
        owed > 0
          ? `تم التحديث — مديونية حالية ${owed.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`
          : "تم التحديث — لا توجد متأخرات على هذا العضو.",
        { id: tId, duration: 3500 },
      );
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
      setError(getErrorMessage(err));
    }
  };

  const total = useMemo(() => items.length, [items]);

  return (
    <AppShell title="إعانات في انتظار الموافقة" subtitle="حالات الإعانة المُسجَّلة آليًا من تغيير حالة العضو، في انتظار قرار الصرف.">
      <div className="space-y-7" data-testid="aid-pending-page">
        <GatewayHero
          icon={Clock}
          badge="بوابة فرعية"
          title="إعانات في انتظار الموافقة"
          subtitle={`حالات الوفاة والعجز المسجَّلة آليًا في ${department?.name || "المشروع"} بانتظار قرار الصرف.`}
          crumbs={[
            { to: "/departments", label: "الإدارات" },
            { to: `/project/${id}`, label: department?.name || "مشروع التكافل الاجتماعي" },
            { to: `/project/${id}/financial`, label: "الموقف المالي" },
            { to: `/project/${id}/financial/aid`, label: "الإعانات" },
            { label: "في انتظار الموافقة" },
          ]}
          stats={[{ key: "pending", label: "إجمالي الإعانات المعلّقة", value: total }]}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
              <HandCoins className="h-4 w-4 text-[#0f3a73]" />
              قائمة الحالات المعلّقة
              <span className="text-xs font-normal text-slate-400">— تنشأ تلقائيًا عند تحديد الحالة "متوفي" أو "عجز كلي/جزئي منهي للخدمة" في العضوية.</span>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="بحث بالاسم/الرقم القومي/رقم العضوية"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pe-9"
                data-testid="aid-pending-search"
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="aid-pending-error">{error}</div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <Table data-testid="aid-pending-table">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-start">نوع الإعانة</TableHead>
                  <TableHead className="text-start">اسم العضو</TableHead>
                  <TableHead className="text-start">الرقم القومي</TableHead>
                  <TableHead className="text-start">رقم العضوية</TableHead>
                  <TableHead className="text-start">المحافظة</TableHead>
                  <TableHead className="text-start">اللجنة النقابية</TableHead>
                  <TableHead className="text-start">تاريخ الميلاد</TableHead>
                  <TableHead className="text-start">تاريخ الاشتراك</TableHead>
                  <TableHead className="text-start">العنوان</TableHead>
                  <TableHead className="text-start">الهاتف</TableHead>
                  <TableHead className="text-start">المستفيد الأساسي</TableHead>
                  <TableHead className="text-start">تاريخ الحالة</TableHead>
                  <TableHead className="text-start">مستحقات اللجنة</TableHead>
                  <TableHead className="text-start">إظهار في الاستمارة</TableHead>
                  <TableHead className="text-start">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const dues = it.committee_dues || {};
                  const owed = Number(dues.owed_amount || 0);
                  return (
                    <TableRow key={it.id} data-testid={`aid-pending-row-${it.id}`}>
                      <TableCell><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${aidTypeBadge(it.aid_type)}`}>{it.aid_type}</span></TableCell>
                      <TableCell className="font-bold text-slate-950">{it.member_name || "-"}</TableCell>
                      <TableCell className="tabular-nums">{it.member_national_id || "-"}</TableCell>
                      <TableCell className="tabular-nums">{it.member_membership_number || "-"}</TableCell>
                      <TableCell>{it.member_governorate || "-"}</TableCell>
                      <TableCell>{it.member_union_committee || "-"}</TableCell>
                      <TableCell className="tabular-nums">{it.member_birth_date || "-"}</TableCell>
                      <TableCell className="tabular-nums">{it.member_subscription_date || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={it.member_address}>{it.member_address || "-"}</TableCell>
                      <TableCell className="tabular-nums">{it.member_phone || "-"}</TableCell>
                      <TableCell>{it.member_beneficiary_name || "-"}</TableCell>
                      <TableCell className="tabular-nums">{it.member_status_date || "-"}</TableCell>
                      <TableCell data-testid={`aid-dues-${it.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                          {owed > 0 ? (
                            <div className="space-y-0.5 leading-tight">
                              <div className="font-bold text-rose-700 tabular-nums">{fmtNum(owed)} ج.م</div>
                              <div className="text-[10px] text-slate-500 tabular-nums">{dues.from_month} → {dues.to_month}</div>
                            </div>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">لا توجد متأخرات</span>
                          )}
                          </div>
                          <button
                            type="button"
                            onClick={() => recalcAid(it)}
                            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0f3a73]"
                            title="إعادة احتساب المستحقات من البيانات الحالية"
                            data-testid={`aid-recalc-btn-${it.id}`}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!!it.print_dues_note}
                            onCheckedChange={(v) => togglePrintNote(it.id, v)}
                            disabled={owed <= 0}
                            data-testid={`aid-toggle-print-${it.id}`}
                          />
                          <span className="text-[10px] text-slate-500">{it.print_dues_note && owed > 0 ? "نعم" : "لا"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-slate-600 hover:bg-slate-100 hover:text-slate-900" 
                            onClick={() => openView(it)} 
                            data-testid={`aid-view-btn-${it.id}`}
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" /> عرض
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-purple-600 hover:bg-purple-50 hover:text-purple-700" 
                            onClick={() => openCalculator(it)} 
                            data-testid={`aid-calc-btn-${it.id}`}
                            title="المستحقون للإعانة"
                          >
                            <Calculator className="h-4 w-4" /> المستحقون للإعانة
                          </Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openDisburse(it)} data-testid={`aid-disburse-btn-${it.id}`}>
                            <Wallet className="h-4 w-4" /> اعتماد الصرف
                          </Button>
                          <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => restoreMember(it)} data-testid={`aid-restore-btn-${it.id}`} title="رد العضو لحالة فعّال وحذف الإعانة">
                            <RotateCcw className="h-3.5 w-3.5" /> رد العضو
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => deleteAid(it)} data-testid={`aid-delete-btn-${it.id}`} title="حذف الإعانة دون تغيير حالة العضو">
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
                    <TableCell colSpan={15} className="py-10 text-center text-slate-500" data-testid="aid-pending-empty">
                      لا توجد إعانات في انتظار الموافقة حاليًا.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-right">اعتماد صرف الإعانة</DialogTitle>
            <DialogDescription className="text-right">
              {active && <>إعانة <strong>{active.aid_type}</strong> للعضو <strong>{active.member_name}</strong> — رقم قومي <span className="tabular-nums">{active.member_national_id}</span></>}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4" data-testid="aid-disburse-form">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cheque-number" className="text-xs font-bold text-slate-600">رقم الشيك</Label>
                <Input id="cheque-number" value={form.cheque_number} onChange={(e) => setForm({ ...form, cheque_number: e.target.value })} required data-testid="aid-cheque-number" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cheque-date" className="text-xs font-bold text-slate-600">تاريخ الشيك</Label>
                <Input id="cheque-date" type="date" value={form.cheque_date} onChange={(e) => setForm({ ...form, cheque_date: e.target.value })} required data-testid="aid-cheque-date" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cheque-bank" className="text-xs font-bold text-slate-600">على بنك</Label>
                <Input id="cheque-bank" value={form.cheque_bank} onChange={(e) => setForm({ ...form, cheque_bank: e.target.value })} required data-testid="aid-cheque-bank" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cheque-amount" className="text-xs font-bold text-slate-600">المبلغ (ج.م)</Label>
                <Input id="cheque-amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required data-testid="aid-cheque-amount" />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-600">المستفيدون</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBeneficiary} data-testid="aid-add-beneficiary">
                  <Plus className="h-4 w-4" /> إضافة مستفيد
                </Button>
              </div>
              <div className="space-y-2">
                {form.beneficiaries.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-xs font-bold text-slate-600 tabular-nums">{idx + 1}</span>
                    <Input
                      value={b}
                      onChange={(e) => setBeneficiary(idx, e.target.value)}
                      placeholder={`اسم المستفيد ${idx + 1}`}
                      data-testid={`aid-beneficiary-${idx}`}
                    />
                    {form.beneficiaries.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeBeneficiary(idx)} data-testid={`aid-remove-beneficiary-${idx}`} className="text-rose-600 hover:bg-rose-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-rose-600" data-testid="aid-form-error">{error}</p>}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="aid-cancel-btn">إلغاء</Button>
              <Button type="submit" className="bg-[#0f3a73] hover:bg-[#103e7d]" disabled={busy} data-testid="aid-submit-btn">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} اعتماد وصرف
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* حاسبة توزيع الإعانة */}
      <InheritanceCalculatorDialog 
        open={calculatorOpen} 
        onOpenChange={setCalculatorOpen} 
        aid={active} 
      />
    </AppShell>
  );
}
