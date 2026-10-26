import { useState } from "react";
import { Loader2, Save, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { api, getErrorMessage } from "../lib/api";

/**
 * Member-duplicate detection & merge dialog.
 *
 * Backend contract:
 *   GET  /api/admin/members/duplicates?department_id=&threshold=
 *        → { clusters: [{ canonical_id, members: [...], signals: [...],
 *                          suggested_governorate, suggested_committee,
 *                          governorate_variants, committee_variants }], stats }
 *   POST /api/admin/members/merge { department_id, operations: [
 *        { canonical_id, alias_ids, canonical_governorate?, canonical_union_committee? } ] }
 *
 * UX rules:
 *  - Auto-merge is NOT supported. The operator must explicitly tick "Apply"
 *    for each cluster they want to keep.
 *  - Picking the canonical is a radio (exactly one per cluster).
 *  - Aliases checkbox defaults to all-non-canonical for the highest-confidence
 *    clusters (score >= 0.95) — operator can untick any they want to keep
 *    separate.
 */

const fmtScore = (s) => `${Math.round((s || 0) * 100)}%`;

export default function MemberDedupDialog({ open, onOpenChange, departments }) {
  const [deptId, setDeptId] = useState("");
  const [threshold, setThreshold] = useState(0.85);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [clusters, setClusters] = useState([]);
  const [stats, setStats] = useState(null);

  const reset = () => { setClusters([]); setStats(null); };

  const scan = async () => {
    if (!deptId) { toast.error("اختر الإدارة أولاً"); return; }
    setScanning(true); reset();
    const tId = toast.loading("جاري فحص الأعضاء...");
    try {
      const { data } = await api.get(`/admin/members/duplicates?department_id=${deptId}&threshold=${threshold}`);
      setStats(data.stats || null);
      const local = (data.clusters || []).map((c, idx) => ({
        id: idx,
        canonicalId: c.canonical_id,
        members: (c.members || []).map((m) => ({
          ...m,
          // Default: enable as alias only when the cluster is high-confidence.
          enabled: m.id !== c.canonical_id && (c.max_score || 0) >= 0.95,
        })),
        signals: c.signals || [],
        score: c.max_score || 0,
        suggestedGovernorate: c.suggested_governorate || "",
        suggestedCommittee: c.suggested_committee || "",
        governorateVariants: c.governorate_variants || [],
        committeeVariants: c.committee_variants || [],
        // When the cluster has multiple gov/com spellings, default the
        // canonical's gov/com to the suggested (most-frequent) one.
        canonicalGov: c.suggested_governorate || "",
        canonicalCom: c.suggested_committee || "",
        applied: false,
      }));
      setClusters(local);
      const s = data.stats || {};
      if (local.length === 0) {
        toast.success(`لا يوجد أعضاء مكررين عند الحساسية الحالية (تم فحص ${s.members_scanned || 0} عضو في ${s.buckets_scanned || 0} لجنة). جرّب تقليل الحساسية.`, { id: tId, duration: 5000 });
      } else {
        toast.success(`تم العثور على ${local.length} مجموعة مكررة (فحص ${s.members_scanned || 0} عضو في ${s.buckets_scanned || 0} لجنة)`, { id: tId, duration: 3500 });
      }
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setScanning(false);
    }
  };

  const setCanonical = (ci, memberId) => {
    setClusters((prev) => prev.map((c, idx) => (idx !== ci ? c : {
      ...c,
      canonicalId: memberId,
      members: c.members.map((m) => ({
        ...m,
        // When the canonical changes, automatically untick that member and
        // tick everyone else (high-confidence) so the form stays consistent.
        enabled: m.id !== memberId && c.score >= 0.95 ? true : (m.id === memberId ? false : m.enabled),
      })),
    })));
  };

  const toggleAlias = (ci, memberId) => {
    setClusters((prev) => prev.map((c, idx) => (idx !== ci ? c : {
      ...c,
      members: c.members.map((m) => m.id === memberId ? { ...m, enabled: !m.enabled } : m),
    })));
  };

  const setCanonicalGov = (ci, value) => {
    setClusters((prev) => prev.map((c, idx) => (idx !== ci ? c : { ...c, canonicalGov: value })));
  };
  const setCanonicalCom = (ci, value) => {
    setClusters((prev) => prev.map((c, idx) => (idx !== ci ? c : { ...c, canonicalCom: value })));
  };

  const removeCluster = (ci) => {
    setClusters((prev) => prev.filter((_, idx) => idx !== ci));
  };

  const apply = async () => {
    const operations = clusters
      .filter((c) => c.members.some((m) => m.enabled && m.id !== c.canonicalId))
      .map((c) => ({
        canonical_id: c.canonicalId,
        alias_ids: c.members.filter((m) => m.enabled && m.id !== c.canonicalId).map((m) => m.id),
        canonical_governorate: c.canonicalGov || null,
        canonical_union_committee: c.canonicalCom || null,
      }));
    if (operations.length === 0) {
      toast.error("لا توجد عمليات دمج جاهزة للتطبيق");
      return;
    }
    const totalAliases = operations.reduce((s, o) => s + o.alias_ids.length, 0);
    if (!window.confirm(`ستقوم بدمج ${totalAliases} عضو مكرر في ${operations.length} مجموعة.\n\nسيتم نقل كل الاشتراكات والإعانات والتسويات للسجل الصحيح، ثم حذف السجلات المكررة نهائياً.\n\nهل أنت متأكد؟`)) return;
    setApplying(true);
    const tId = toast.loading("جاري دمج الأعضاء المكررين...");
    try {
      const { data } = await api.post("/admin/members/merge", { department_id: deptId, operations });
      const sum = data.summary || {};
      toast.success(
        `تم الدمج: حُذف ${sum.members_deleted || 0} عضو • نُقل ${sum.subscriptions_reassigned || 0} اشتراك + ${sum.aids_reassigned || 0} إعانة + ${sum.dues_settlements_reassigned || 0} تسوية`,
        { id: tId, duration: 5000 },
      );
      setClusters([]);
      setStats(null);
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setApplying(false);
    }
  };

  const pendingOps = clusters.filter((c) => c.members.some((m) => m.enabled && m.id !== c.canonicalId));
  const totalAliases = pendingOps.reduce((s, c) => s + c.members.filter((m) => m.enabled && m.id !== c.canonicalId).length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl" data-testid="member-dedup-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700"><Users className="h-5 w-5" /> كشف الأعضاء المكررين</DialogTitle>
          <DialogDescription className="text-xs">
            الخوارزمية تقارن الاسم + الرقم القومي + رقم العضوية + تاريخ الميلاد داخل كل لجنة. ترشيحات للمراجعة — لا يتم الدمج إلا بعد موافقتك على كل مجموعة.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3" data-testid="member-dedup-controls">
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-slate-600">الإدارة</Label>
            <select value={deptId} onChange={(e) => { setDeptId(e.target.value); reset(); }} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="member-dedup-dept-select">
              <option value="">— اختر إدارة —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-slate-600">حساسية التشابه ({Math.round(threshold * 100)}%)</Label>
            <input type="range" min="0.75" max="0.99" step="0.01" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="h-9" data-testid="member-dedup-threshold" />
            <p className="text-[10px] text-slate-500">85% افتراضي — ترشح الحالات الواضحة فقط</p>
          </div>
          <div className="flex items-end">
            <Button onClick={scan} disabled={scanning || !deptId} className="w-full bg-rose-600 hover:bg-rose-700" data-testid="member-dedup-scan-btn">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} فحص الأعضاء
            </Button>
          </div>
        </div>

        {stats && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-900" data-testid="member-dedup-stats">
            <strong>إحصائيات الفحص:</strong>
            <span>تم فحص <strong className="tabular-nums">{stats.members_scanned}</strong> عضو</span>
            <span>•</span>
            <span>في <strong className="tabular-nums">{stats.buckets_scanned}</strong> لجنة</span>
            <span>•</span>
            <span>عُقدت <strong className="tabular-nums">{stats.pairs_compared.toLocaleString("ar-EG")}</strong> مقارنة</span>
          </div>
        )}

        <div className="mt-3 flex-1 space-y-3 overflow-y-auto pe-2">
          {clusters.length === 0 && !scanning && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500" data-testid="member-dedup-empty">
              اختر الإدارة ثم اضغط <strong>"فحص الأعضاء"</strong> لاكتشاف الأعضاء المكررين داخل اللجان.
            </div>
          )}

          {clusters.map((c, ci) => {
            const aliases = c.members.filter((m) => m.enabled && m.id !== c.canonicalId).length;
            const showCommitteeFix = c.committeeVariants.length > 1;
            const showGovFix = c.governorateVariants.length > 1;
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4" data-testid={`member-cluster-${ci}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">ثقة {fmtScore(c.score)}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{c.suggestedGovernorate}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{c.suggestedCommittee}</span>
                    <span className="text-xs text-slate-500">سيتم دمج {aliases} عضو في الصحيح</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeCluster(ci)} className="text-slate-500 hover:text-red-600" data-testid={`member-cluster-skip-${ci}`}>
                    تخطي هذه المجموعة
                  </Button>
                </div>

                {(c.signals || []).length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5" data-testid={`member-cluster-signals-${ci}`}>
                    {c.signals.map((s, si) => (
                      <span key={si} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{s}</span>
                    ))}
                  </div>
                )}

                {(showGovFix || showCommitteeFix) && (
                  <div className="mb-3 grid gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2 md:grid-cols-2" data-testid={`member-cluster-canonical-loc-${ci}`}>
                    {showGovFix && (
                      <div className="grid gap-1">
                        <Label className="text-[11px] font-bold text-amber-800">المحافظة الموحّدة لكل المجموعة:</Label>
                        <select value={c.canonicalGov} onChange={(e) => setCanonicalGov(ci, e.target.value)} className="h-8 rounded-md border border-amber-300 bg-white px-2 text-xs">
                          {c.governorateVariants.map((v, i) => <option key={i} value={v.name}>{v.name} ({v.count})</option>)}
                        </select>
                      </div>
                    )}
                    {showCommitteeFix && (
                      <div className="grid gap-1">
                        <Label className="text-[11px] font-bold text-amber-800">اللجنة الموحّدة لكل المجموعة:</Label>
                        <select value={c.canonicalCom} onChange={(e) => setCanonicalCom(ci, e.target.value)} className="h-8 rounded-md border border-amber-300 bg-white px-2 text-xs">
                          {c.committeeVariants.map((v, i) => <option key={i} value={v.name}>{v.name} ({v.count})</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="px-2 py-1 text-start font-bold w-16">الأصلي</th>
                        <th className="px-2 py-1 text-start font-bold w-16">دمج</th>
                        <th className="px-2 py-1 text-start font-bold">الاسم</th>
                        <th className="px-2 py-1 text-start font-bold">الرقم القومي</th>
                        <th className="px-2 py-1 text-start font-bold">رقم العضوية</th>
                        <th className="px-2 py-1 text-start font-bold">تاريخ الميلاد</th>
                        <th className="px-2 py-1 text-start font-bold">تاريخ الاشتراك</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.members.map((m, mi) => {
                        const isCanonical = m.id === c.canonicalId;
                        return (
                          <tr key={m.id} className={isCanonical ? "bg-emerald-50/60" : m.enabled ? "bg-rose-50/40" : ""} data-testid={`member-row-${ci}-${mi}`}>
                            <td className="px-2 py-1">
                              <input
                                type="radio"
                                name={`canonical-${ci}`}
                                checked={isCanonical}
                                onChange={() => setCanonical(ci, m.id)}
                                className="h-4 w-4 cursor-pointer accent-emerald-600"
                                data-testid={`member-canonical-${ci}-${mi}`}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="checkbox"
                                checked={isCanonical ? false : !!m.enabled}
                                disabled={isCanonical}
                                onChange={() => toggleAlias(ci, m.id)}
                                className="h-4 w-4 cursor-pointer accent-rose-600 disabled:opacity-30"
                                data-testid={`member-alias-${ci}-${mi}`}
                              />
                            </td>
                            <td className={`px-2 py-1 ${isCanonical ? "font-extrabold text-emerald-800" : "text-slate-800"}`}>
                              {m.name}
                              {isCanonical && <span className="ms-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">الأصلي</span>}
                            </td>
                            <td className="px-2 py-1 tabular-nums text-slate-700">{m.national_id || "—"}</td>
                            <td className="px-2 py-1 tabular-nums text-slate-700">{m.membership_number || "—"}</td>
                            <td className="px-2 py-1 tabular-nums text-slate-700">{m.birth_date || "—"}</td>
                            <td className="px-2 py-1 tabular-nums text-slate-700">{m.subscription_date || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-3 flex-row items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            {pendingOps.length > 0 ? (
              <span>سيتم دمج <strong className="tabular-nums">{totalAliases}</strong> عضو في <strong className="tabular-nums">{pendingOps.length}</strong> مجموعة</span>
            ) : "لا توجد عمليات معلّقة"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="member-dedup-cancel-btn">إغلاق</Button>
            <Button onClick={apply} disabled={applying || pendingOps.length === 0} className="bg-rose-600 hover:bg-rose-700" data-testid="member-dedup-apply-btn">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} تطبيق الدمج
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
