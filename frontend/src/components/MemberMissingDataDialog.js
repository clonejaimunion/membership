import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, ListChecks, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";

/**
 * Member-data-correction dialog.
 *
 * Backend contract:
 *   GET  /api/admin/members/missing-data?department_id=&min_missing=
 *        → { total_scanned, total_flagged, summary_by_field, members[] }
 *   PUT  /api/members/{id}  (existing endpoint — partial update is fine)
 *
 * UX:
 *  - Scan returns every flagged member with the list of empty critical fields.
 *  - The summary banner shows "X members missing field Y" so the operator can
 *    decide where to focus.
 *  - Each row exposes inline inputs ONLY for the fields that are missing —
 *    the rest stay as read-only context so the operator doesn't accidentally
 *    overwrite good data.
 *  - "Save" is per-row; nothing happens until the operator clicks the row's
 *    save button. This matches the duplicate-detection feature's "no auto"
 *    contract that the user requested.
 */
export default function MemberMissingDataDialog({ open, onOpenChange, departments }) {
  const [deptId, setDeptId] = useState("");
  const [minMissing, setMinMissing] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});      // { [memberId]: { field: value } }
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState("");

  useEffect(() => {
    if (!open) {
      setData(null); setEdits({}); setSearch(""); setFieldFilter("");
    }
  }, [open]);

  const scan = async () => {
    if (!deptId) { toast.error("اختر الإدارة أولاً"); return; }
    setScanning(true); setData(null); setEdits({});
    const tId = toast.loading("جاري فحص البيانات...");
    try {
      const { data: resp } = await api.get(`/admin/members/missing-data?department_id=${deptId}&min_missing=${minMissing}`);
      setData(resp);
      toast.success(`تم فحص ${resp.total_scanned} عضو — ${resp.total_flagged} ناقص البيانات`, { id: tId, duration: 4000 });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setScanning(false);
    }
  };

  const setEdit = (memberId, field, value) => {
    setEdits((prev) => ({ ...prev, [memberId]: { ...(prev[memberId] || {}), [field]: value } }));
  };

  const saveOne = async (member) => {
    const patch = edits[member.id] || {};
    const hasChange = Object.entries(patch).some(([, v]) => (v || "").toString().trim() !== "");
    if (!hasChange) { toast.error("لم تُدخل بيانات للحفظ"); return; }
    setSavingId(member.id);
    const tId = toast.loading(`جاري حفظ بيانات ${member.name || "العضو"}...`);
    try {
      // Merge over the original snapshot so the backend's full-record validation passes.
      const payload = {
        department_id: deptId,
        name: member.name || "",
        national_id: member.national_id || "",
        membership_number: member.membership_number || "",
        governorate: member.governorate || "",
        union_committee: member.union_committee || "",
        birth_date: member.birth_date || "",
        subscription_date: member.subscription_date || "",
        phone: member.phone || "",
        address: member.address || "",
        status: member.status || "فعال",
        status_date: member.status_date || "",
        ...patch,
      };
      await api.put(`/members/${member.id}`, payload);
      // Update the local state so the row disappears from the missing list
      // (or its missing-count drops) without a full re-scan.
      setData((prev) => {
        if (!prev) return prev;
        const updated = prev.members.map((m) => m.id === member.id ? {
          ...m, ...patch,
          missing: (m.missing || []).filter((mf) => !(mf.key in patch && (patch[mf.key] || "").toString().trim())),
        } : m).filter((m) => (m.missing || []).length > 0);
        return { ...prev, members: updated, total_flagged: updated.length };
      });
      setEdits((prev) => { const next = { ...prev }; delete next[member.id]; return next; });
      toast.success("تم الحفظ", { id: tId, duration: 2000 });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setSavingId("");
    }
  };

  const filteredMembers = useMemo(() => {
    if (!data?.members) return [];
    const q = search.trim().toLowerCase();
    return data.members.filter((m) => {
      if (q) {
        const blob = `${m.name || ""} ${m.national_id || ""} ${m.membership_number || ""} ${m.governorate || ""} ${m.union_committee || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (fieldFilter) {
        const has = (m.missing || []).some((mf) => mf.key === fieldFilter);
        if (!has) return false;
      }
      return true;
    });
  }, [data, search, fieldFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col" dir="rtl" data-testid="member-missing-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-700"><ListChecks className="h-5 w-5" /> تصحيح بيانات الأعضاء</DialogTitle>
          <DialogDescription className="text-xs">
            الخوارزمية تكشف الأعضاء ذوي البيانات الناقصة (الرقم القومي، رقم العضوية، تاريخ الميلاد، العنوان، التليفون، إلخ) — أكمل الناقص مباشرة من هنا.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3" data-testid="missing-controls">
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-slate-600">الإدارة</Label>
            <select value={deptId} onChange={(e) => { setDeptId(e.target.value); setData(null); }} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="missing-dept-select">
              <option value="">— اختر إدارة —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-slate-600">حد أدنى لعدد الحقول الناقصة ({minMissing})</Label>
            <input type="range" min="1" max="6" step="1" value={minMissing} onChange={(e) => setMinMissing(Number(e.target.value))} className="h-9" data-testid="missing-min-input" />
            <p className="text-[10px] text-slate-500">1 = يظهر أي عضو ناقص حقل واحد على الأقل</p>
          </div>
          <div className="flex items-end">
            <Button onClick={scan} disabled={scanning || !deptId} className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="missing-scan-btn">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />} فحص البيانات الناقصة
            </Button>
          </div>
        </div>

        {data && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900" data-testid="missing-stats">
            <strong>إحصائيات الفحص:</strong>
            <span>تم فحص <strong className="tabular-nums">{data.total_scanned}</strong> عضو</span>
            <span>•</span>
            <span>منهم <strong className="tabular-nums">{data.total_flagged}</strong> ناقصي بيانات</span>
            {data.summary_by_field?.length > 0 && (
              <>
                <span>•</span>
                <span>الأكثر نقصاً:</span>
                {data.summary_by_field.slice(0, 4).map((s) => (
                  <button
                    key={s.field}
                    type="button"
                    onClick={() => {
                      // Map label → key (so we can filter)
                      const map = data.members.flatMap((m) => m.missing || []).find((mf) => mf.label === s.field);
                      setFieldFilter((cur) => (cur === (map?.key || "") ? "" : (map?.key || "")));
                    }}
                    className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                  >
                    {s.field} ({s.count})
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {data && (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div className="relative">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم / رقم العضوية / الرقم القومي" className="pe-9" data-testid="missing-search-input" />
              <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            {fieldFilter && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs">
                <span>تصفية بالحقل المختار</span>
                <Button size="sm" variant="ghost" onClick={() => setFieldFilter("")}>إزالة التصفية</Button>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex-1 space-y-3 overflow-y-auto pe-2">
          {!data && !scanning && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500" data-testid="missing-empty">
              اختر الإدارة ثم اضغط <strong>"فحص البيانات الناقصة"</strong>.
            </div>
          )}
          {data && filteredMembers.length === 0 && (
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-6 text-center text-sm text-emerald-700">
              ممتاز — لا يوجد أعضاء بحاجة لتصحيح بناءً على هذه التصفية ✨
            </div>
          )}
          {filteredMembers.map((m) => {
            const patch = edits[m.id] || {};
            return (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-3" data-testid={`missing-member-${m.id}`}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">{m.governorate || "—"}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{m.union_committee || "—"}</span>
                    <strong className="text-sm text-slate-900">{m.name || "(بدون اسم)"}</strong>
                    {m.national_id && <span className="text-[11px] text-slate-500 tabular-nums">رقم قومي: {m.national_id}</span>}
                    {m.membership_number && <span className="text-[11px] text-slate-500 tabular-nums">عضوية: {m.membership_number}</span>}
                  </div>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                    ناقص {m.missing_count} حقل
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {(m.missing || []).map((mf) => (
                    <div key={mf.key} className="grid gap-1">
                      <Label className="text-[11px] font-bold text-rose-700">{mf.label}</Label>
                      <Input
                        type={mf.key === "birth_date" || mf.key === "subscription_date" || mf.key === "status_date" ? "date" : "text"}
                        value={patch[mf.key] || ""}
                        onChange={(e) => setEdit(m.id, mf.key, e.target.value)}
                        className="h-8 text-xs"
                        data-testid={`missing-input-${m.id}-${mf.key}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" onClick={() => saveOne(m)} disabled={savingId === m.id} className="bg-emerald-600 hover:bg-emerald-700" data-testid={`missing-save-${m.id}`}>
                    {savingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} حفظ
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="missing-close-btn">إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
