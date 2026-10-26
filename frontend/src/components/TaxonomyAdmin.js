import { useEffect, useState } from "react";
import { Building2, Layers, Loader2, Plus, Pencil, GitMerge } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { api, getErrorMessage } from "../lib/api";

/**
 * Admin card cluster for manually registering a new governorate or
 * committee — useful when the operator needs to set up the taxonomy
 * BEFORE any member is added under it.
 *
 * Backend enforces duplicate detection (normalised Arabic compare). The UI
 * surfaces the 409 response as a friendly inline error.
 */
export default function TaxonomyAdmin({ departments }) {
  const [deptId, setDeptId] = useState("");
  const [govName, setGovName] = useState("");
  const [govBusy, setGovBusy] = useState(false);

  const [comGov, setComGov] = useState("");
  const [comName, setComName] = useState("");
  const [comBusy, setComBusy] = useState(false);

  // Rename forms — independent governorate + committee selectors.
  const [renGovOld, setRenGovOld] = useState("");
  const [renGovNew, setRenGovNew] = useState("");
  const [renGovBusy, setRenGovBusy] = useState(false);
  const [renComGov, setRenComGov] = useState("");
  const [renComOld, setRenComOld] = useState("");
  const [renComNew, setRenComNew] = useState("");
  const [renComBusy, setRenComBusy] = useState(false);

  // Merge forms — source → target.
  const [mgGovSrc, setMgGovSrc] = useState("");
  const [mgGovDst, setMgGovDst] = useState("");
  const [mgGovBusy, setMgGovBusy] = useState(false);
  const [mgComSrcGov, setMgComSrcGov] = useState("");
  const [mgComSrc, setMgComSrc] = useState("");
  const [mgComDstGov, setMgComDstGov] = useState("");
  const [mgComDst, setMgComDst] = useState("");
  const [mgComBusy, setMgComBusy] = useState(false);

  // Auto-select the only department on load so the rename/merge selectors
  // get populated immediately (the operator typically has a single project).
  useEffect(() => {
    if (!deptId && departments && departments.length === 1) {
      setDeptId(departments[0].id);
    }
  }, [departments]); // eslint-disable-line

  // For the committee form's governorate dropdown.
  const [classifications, setClassifications] = useState({ governorates: [], committees_by_governorate: {} });
  const reloadClassifications = async () => {
    if (!deptId) return;
    try {
      const { data } = await api.get(`/classifications?department_id=${deptId}`);
      setClassifications(data);
      const govs = data.governorates || [];
      if (!comGov && govs.length) setComGov(govs[0]);
      if (!renGovOld && govs.length) setRenGovOld(govs[0]);
      if (!renComGov && govs.length) setRenComGov(govs[0]);
      if (!mgGovSrc && govs.length) setMgGovSrc(govs[0]);
      if (!mgGovDst && govs.length > 1) setMgGovDst(govs[1]);
      if (!mgComSrcGov && govs.length) setMgComSrcGov(govs[0]);
      if (!mgComDstGov && govs.length) setMgComDstGov(govs[0]);
    } catch { /* silent */ }
  };
  useEffect(() => { reloadClassifications(); }, [deptId]); // eslint-disable-line

  const addGovernorate = async (e) => {
    e?.preventDefault?.();
    if (!deptId || !govName.trim()) { toast.error("اختر الإدارة واكتب اسم المحافظة"); return; }
    setGovBusy(true);
    const tId = toast.loading("جاري التحقق وإضافة المحافظة...");
    try {
      await api.post("/admin/taxonomy/governorate", { department_id: deptId, name: govName.trim() });
      toast.success(`تمت إضافة المحافظة "${govName.trim()}"`, { id: tId, duration: 3000 });
      setGovName("");
      reloadClassifications();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setGovBusy(false);
    }
  };

  const addCommittee = async (e) => {
    e?.preventDefault?.();
    if (!deptId || !comGov || !comName.trim()) { toast.error("اختر الإدارة والمحافظة واكتب اسم اللجنة"); return; }
    setComBusy(true);
    const tId = toast.loading("جاري التحقق وإضافة اللجنة...");
    try {
      await api.post("/admin/taxonomy/committee", { department_id: deptId, governorate: comGov, name: comName.trim() });
      toast.success(`تمت إضافة اللجنة "${comName.trim()}" في ${comGov}`, { id: tId, duration: 3000 });
      setComName("");
      reloadClassifications();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setComBusy(false);
    }
  };

  const renameGovernorate = async (e) => {
    e?.preventDefault?.();
    if (!deptId || !renGovOld || !renGovNew.trim()) { toast.error("اختر الإدارة والمحافظة القديمة واكتب الاسم الجديد"); return; }
    if (!window.confirm(`تأكيد إعادة تسمية المحافظة "${renGovOld}" إلى "${renGovNew.trim()}"؟ سيتم تحديث كل الأعضاء واللجان والاشتراكات والإعانات المرتبطة.`)) return;
    setRenGovBusy(true);
    const tId = toast.loading("جاري إعادة التسمية وتحديث السجلات...");
    try {
      const { data } = await api.post("/admin/taxonomy/governorate/rename", {
        department_id: deptId, old_name: renGovOld, new_name: renGovNew.trim(),
      });
      toast.success(`تم تحديث ${data.total} سجل (${renGovOld} → ${data.new_name})`, { id: tId, duration: 4500 });
      setRenGovNew("");
      reloadClassifications();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setRenGovBusy(false);
    }
  };

  const renameCommittee = async (e) => {
    e?.preventDefault?.();
    if (!deptId || !renComGov || !renComOld || !renComNew.trim()) { toast.error("اختر الإدارة والمحافظة واللجنة القديمة والجديدة"); return; }
    if (!window.confirm(`تأكيد إعادة تسمية اللجنة "${renComOld}" داخل ${renComGov} إلى "${renComNew.trim()}"؟ سيتم تحديث كل الأعضاء والاشتراكات والإعانات المرتبطة.`)) return;
    setRenComBusy(true);
    const tId = toast.loading("جاري إعادة التسمية وتحديث السجلات...");
    try {
      const { data } = await api.post("/admin/taxonomy/committee/rename", {
        department_id: deptId, governorate: renComGov, old_name: renComOld, new_name: renComNew.trim(),
      });
      toast.success(`تم تحديث ${data.total} سجل (${renComOld} → ${data.new_name})`, { id: tId, duration: 4500 });
      setRenComNew("");
      reloadClassifications();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setRenComBusy(false);
    }
  };

  const mergeGovernorate = async (e) => {
    e?.preventDefault?.();
    if (!deptId || !mgGovSrc || !mgGovDst) { toast.error("اختر المحافظتين"); return; }
    if (mgGovSrc === mgGovDst) { toast.error("المصدر والهدف متطابقان"); return; }
    if (!window.confirm(`تأكيد دمج محافظة "${mgGovSrc}" بالكامل داخل "${mgGovDst}"؟ كل الأعضاء واللجان والسجلات تحتها هتتحول للمحافظة الجديدة، والاسم القديم هيختفي.`)) return;
    setMgGovBusy(true);
    const tId = toast.loading("جاري الدمج وتحديث السجلات...");
    try {
      const { data } = await api.post("/admin/taxonomy/governorate/merge", {
        department_id: deptId, source: mgGovSrc, target: mgGovDst,
      });
      toast.success(`تم دمج ${data.total} سجل (${mgGovSrc} → ${mgGovDst})`, { id: tId, duration: 4500 });
      reloadClassifications();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setMgGovBusy(false);
    }
  };

  const mergeCommittee = async (e) => {
    e?.preventDefault?.();
    if (!deptId || !mgComSrcGov || !mgComSrc || !mgComDstGov || !mgComDst) { toast.error("اختر كل الحقول"); return; }
    if (mgComSrcGov === mgComDstGov && mgComSrc === mgComDst) { toast.error("المصدر والهدف متطابقان"); return; }
    if (!window.confirm(`تأكيد دمج لجنة "${mgComSrc}" (${mgComSrcGov}) داخل "${mgComDst}" (${mgComDstGov})؟ كل السجلات هتتحول، واسم اللجنة المصدر هيختفي.`)) return;
    setMgComBusy(true);
    const tId = toast.loading("جاري الدمج وتحديث السجلات...");
    try {
      const { data } = await api.post("/admin/taxonomy/committee/merge", {
        department_id: deptId,
        source_governorate: mgComSrcGov, source_committee: mgComSrc,
        target_governorate: mgComDstGov, target_committee: mgComDst,
      });
      toast.success(`تم دمج ${data.total} سجل`, { id: tId, duration: 4500 });
      reloadClassifications();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setMgComBusy(false);
    }
  };

  const renComCandidates = (classifications.committees_by_governorate || {})[renComGov] || [];
  const mgComSrcCandidates = (classifications.committees_by_governorate || {})[mgComSrcGov] || [];
  const mgComDstCandidates = (classifications.committees_by_governorate || {})[mgComDstGov] || [];
  // Reset old-committee selection when the rename/merge governorate changes.
  useEffect(() => { setRenComOld(renComCandidates[0] || ""); }, [renComGov, renComCandidates.length]); // eslint-disable-line
  useEffect(() => { setMgComSrc(mgComSrcCandidates[0] || ""); }, [mgComSrcGov, mgComSrcCandidates.length]); // eslint-disable-line
  useEffect(() => { setMgComDst(mgComDstCandidates[0] || ""); }, [mgComDstGov, mgComDstCandidates.length]); // eslint-disable-line

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 space-y-4" data-testid="taxonomy-admin-card">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-600 text-white"><Layers className="h-5 w-5" /></div>
        <div>
          <h3 className="text-base font-extrabold text-slate-950">إضافة محافظة أو لجنة جديدة</h3>
          <p className="text-xs text-slate-500">يمنع النظام تكرار أي اسم تلقائياً (يتحقق من الإملاء والتشكيل).</p>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs font-bold text-slate-600">الإدارة</Label>
        <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-dept-select">
          <option value="">— اختر إدارة —</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <form onSubmit={addGovernorate} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_auto] md:items-end" data-testid="taxonomy-gov-form">
        <div className="grid gap-1.5">
          <Label className="text-xs font-bold text-sky-700 flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> اسم المحافظة الجديدة</Label>
          <Input value={govName} onChange={(e) => setGovName(e.target.value)} placeholder="مثال: السويس" data-testid="taxonomy-gov-input" />
        </div>
        <Button type="submit" disabled={govBusy || !deptId} className="bg-sky-600 hover:bg-sky-700" data-testid="taxonomy-add-gov-btn">
          {govBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} إضافة محافظة
        </Button>
      </form>

      <form onSubmit={addCommittee} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto] md:items-end" data-testid="taxonomy-com-form">
        <div className="grid gap-1.5">
          <Label className="text-xs font-bold text-sky-700">المحافظة</Label>
          <select value={comGov} onChange={(e) => setComGov(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-com-gov-select">
            <option value="">— اختر —</option>
            {(classifications.governorates || []).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-bold text-sky-700">اسم اللجنة الجديدة</Label>
          <Input value={comName} onChange={(e) => setComName(e.target.value)} placeholder="مثال: مديرية الزراعة" data-testid="taxonomy-com-input" />
        </div>
        <Button type="submit" disabled={comBusy || !deptId} className="bg-sky-600 hover:bg-sky-700" data-testid="taxonomy-add-com-btn">
          {comBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} إضافة لجنة
        </Button>
      </form>

      {/* Rename block — separate visual section so the operator can clearly
          tell it apart from the "Add" forms above. */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 text-sm font-extrabold">
          <Pencil className="h-4 w-4" /> تعديل/إعادة تسمية محافظة أو لجنة
        </div>
        <p className="text-[11px] text-amber-800">
          إعادة التسمية تحدّث كل الأعضاء والاشتراكات والإعانات وتسويات المستحقات المرتبطة بالاسم القديم. لا تستخدمها لدمج اسمين موجودين — استخدم أداة دمج المتطابقات بدلاً من ذلك.
        </p>

        <form onSubmit={renameGovernorate} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto] md:items-end" data-testid="taxonomy-rename-gov-form">
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-amber-800 flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> المحافظة الحالية</Label>
            <select value={renGovOld} onChange={(e) => setRenGovOld(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-rename-gov-old-select">
              <option value="">— اختر —</option>
              {(classifications.governorates || []).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-amber-800">الاسم الجديد للمحافظة</Label>
            <Input value={renGovNew} onChange={(e) => setRenGovNew(e.target.value)} placeholder="اكتب الاسم الصحيح" data-testid="taxonomy-rename-gov-new-input" />
          </div>
          <Button type="submit" disabled={renGovBusy || !deptId || !renGovOld} className="bg-amber-600 hover:bg-amber-700" data-testid="taxonomy-rename-gov-btn">
            {renGovBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} تعديل المحافظة
          </Button>
        </form>

        <form onSubmit={renameCommittee} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end" data-testid="taxonomy-rename-com-form">
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-amber-800">المحافظة</Label>
            <select value={renComGov} onChange={(e) => setRenComGov(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-rename-com-gov-select">
              <option value="">— اختر —</option>
              {(classifications.governorates || []).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-amber-800">اللجنة الحالية</Label>
            <select value={renComOld} onChange={(e) => setRenComOld(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-rename-com-old-select">
              {renComCandidates.length === 0 && <option value="">— لا توجد لجان —</option>}
              {renComCandidates.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-amber-800">الاسم الجديد للجنة</Label>
            <Input value={renComNew} onChange={(e) => setRenComNew(e.target.value)} placeholder="اكتب الاسم الصحيح" data-testid="taxonomy-rename-com-new-input" />
          </div>
          <Button type="submit" disabled={renComBusy || !deptId || !renComGov || !renComOld} className="bg-amber-600 hover:bg-amber-700" data-testid="taxonomy-rename-com-btn">
            {renComBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} تعديل اللجنة
          </Button>
        </form>
      </div>

      {/* Merge block — moves all records under a source name into an
          existing target name. The source name disappears afterwards. */}
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-3 space-y-3">
        <div className="flex items-center gap-2 text-violet-900 text-sm font-extrabold">
          <GitMerge className="h-4 w-4" /> دمج محافظة أو لجنة داخل أخرى موجودة
        </div>
        <p className="text-[11px] text-violet-800">
          الدمج يحوّل كل الأعضاء والاشتراكات والإعانات والتسويات من اسم المصدر إلى الاسم الهدف، ثم يحذف اسم المصدر نهائياً. عملية لا يمكن التراجع عنها — تأكد قبل الموافقة.
        </p>

        <form onSubmit={mergeGovernorate} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto] md:items-end" data-testid="taxonomy-merge-gov-form">
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-violet-800 flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> محافظة المصدر</Label>
            <select value={mgGovSrc} onChange={(e) => setMgGovSrc(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-merge-gov-src-select">
              <option value="">— اختر —</option>
              {(classifications.governorates || []).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-bold text-violet-800">محافظة الهدف</Label>
            <select value={mgGovDst} onChange={(e) => setMgGovDst(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-merge-gov-dst-select">
              <option value="">— اختر —</option>
              {(classifications.governorates || []).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={mgGovBusy || !deptId || !mgGovSrc || !mgGovDst} className="bg-violet-600 hover:bg-violet-700" data-testid="taxonomy-merge-gov-btn">
            {mgGovBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />} دمج المحافظة
          </Button>
        </form>

        <form onSubmit={mergeCommittee} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2 md:items-end" data-testid="taxonomy-merge-com-form">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 space-y-2">
            <div className="text-[11px] font-bold text-violet-900">المصدر (سيُحذف)</div>
            <div className="grid grid-cols-2 gap-2">
              <select value={mgComSrcGov} onChange={(e) => setMgComSrcGov(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-merge-com-src-gov-select">
                <option value="">— محافظة —</option>
                {(classifications.governorates || []).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={mgComSrc} onChange={(e) => setMgComSrc(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-merge-com-src-select">
                {mgComSrcCandidates.length === 0 && <option value="">— لا توجد لجان —</option>}
                {mgComSrcCandidates.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 space-y-2">
            <div className="text-[11px] font-bold text-violet-900">الهدف (سيتلقّى السجلات)</div>
            <div className="grid grid-cols-2 gap-2">
              <select value={mgComDstGov} onChange={(e) => setMgComDstGov(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-merge-com-dst-gov-select">
                <option value="">— محافظة —</option>
                {(classifications.governorates || []).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={mgComDst} onChange={(e) => setMgComDst(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="taxonomy-merge-com-dst-select">
                {mgComDstCandidates.length === 0 && <option value="">— لا توجد لجان —</option>}
                {mgComDstCandidates.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={mgComBusy || !deptId || !mgComSrc || !mgComDst} className="bg-violet-600 hover:bg-violet-700 md:col-span-2" data-testid="taxonomy-merge-com-btn">
            {mgComBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />} دمج اللجنة
          </Button>
        </form>
      </div>
    </div>
  );
}
