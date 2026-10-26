import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, CalendarClock, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { api, getErrorMessage } from "../lib/api";

/**
 * Backup & restore UI block — meant to sit inside AdminPage.
 *
 * Three actions:
 *   1. "تنزيل نسخة احتياطية الآن" — downloads a JSON file of all program data
 *      directly to the user's computer. Passwords are stripped server-side.
 *   2. "استرداد من نسخة احتياطية" — uploads a JSON file and replays it onto
 *      the local MongoDB (merge by id; passwords are never restored).
 *   3. "جدولة نسخة سنوية" — saves a preferred month + day and shows a banner
 *      whenever a backup is due.
 */
export default function BackupRestoreCard() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [schedule, setSchedule] = useState({ enabled: false, month: 1, day: 1, last_backup_at: "", due: false });
  const [savingSched, setSavingSched] = useState(false);
  const fileInputRef = useRef(null);

  const loadSchedule = async () => {
    try {
      const { data } = await api.get("/admin/backup/schedule");
      setSchedule(data);
    } catch {
      /* admin-only — silently ignore for non-admins */
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const triggerExport = async () => {
    setDownloading(true);
    const tId = toast.loading("جاري إنشاء النسخة الاحتياطية ...");
    try {
      const { data } = await api.get("/admin/backup/export");
      const ts = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(data, null, 0)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `electronic-archive-backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success("تم تنزيل النسخة الاحتياطية بنجاح", { id: tId, duration: 2200 });
      await loadSchedule();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setDownloading(false);
    }
  };

  const triggerRestore = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!window.confirm(`سيتم استرداد البيانات من الملف "${file.name}". هل تريد المتابعة؟ ملاحظة: لن يتم استرجاع كلمات المرور — المستخدمون الجدد سيُعطّلون مؤقتاً لحين إعادة تعيين كلمة المرور.`)) {
      event.target.value = "";
      return;
    }
    setRestoring(true);
    const tId = toast.loading("جاري قراءة الملف ...");
    try {
      const text = await file.text();
      let payload;
      try { payload = JSON.parse(text); } catch { throw new Error("الملف ليس بصيغة JSON صحيحة."); }
      if (payload?.kind !== "electronic-archive-backup") {
        throw new Error("هذا الملف ليس نسخة احتياطية صادرة من البرنامج.");
      }
      toast.loading("جاري استرداد البيانات ...", { id: tId });
      const { data } = await api.post("/admin/backup/restore?mode=merge", payload);
      const totals = data?.collections || {};
      const summary = Object.entries(totals)
        .filter(([, v]) => (v.inserted || 0) + (v.updated || 0) > 0)
        .map(([k, v]) => `${k}: +${v.inserted || 0}/~${v.updated || 0}`)
        .join("، ");
      toast.success(`تم الاسترداد. ${summary || "لا تغييرات."}`, { id: tId, duration: 5000 });
    } catch (err) {
      toast.error(err?.message || getErrorMessage(err), { id: tId });
    } finally {
      setRestoring(false);
      event.target.value = "";
    }
  };

  const saveSchedule = async () => {
    setSavingSched(true);
    const tId = toast.loading("جاري حفظ الجدولة ...");
    try {
      const { data } = await api.put("/admin/backup/schedule", {
        enabled: schedule.enabled,
        month: schedule.month,
        day: schedule.day,
      });
      setSchedule((prev) => ({ ...prev, ...data }));
      toast.success("تم حفظ جدولة النسخة الاحتياطية", { id: tId, duration: 2000 });
      await loadSchedule();
    } catch (err) {
      toast.error(getErrorMessage(err), { id: tId });
    } finally {
      setSavingSched(false);
    }
  };

  return (
    <Card data-testid="backup-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          النسخ الاحتياطي والاسترداد
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-slate-600 leading-relaxed">
          نسخة احتياطية كاملة لكل بيانات البرنامج تُحفظ على جهازك في ملف JSON واحد. <strong>كلمات المرور غير مشمولة</strong> في النسخة لأسباب أمنية. يمكنك أيضاً جدولة تذكير سنوي لإنشاء نسخة احتياطية جديدة تلقائياً.
        </p>

        {schedule.due && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 text-sm">
            ⚠️ موعد النسخة الاحتياطية السنوية قد حان. يُرجى تنزيل نسخة الآن.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Button
            data-testid="backup-download-btn"
            onClick={triggerExport}
            disabled={downloading}
            className="gap-2"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            تنزيل نسخة احتياطية الآن
          </Button>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={triggerRestore}
              className="hidden"
              data-testid="backup-restore-file-input"
            />
            <Button
              data-testid="backup-restore-btn"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoring}
              className="gap-2 w-full"
            >
              {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              استرداد من ملف نسخة احتياطية
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
            <CalendarClock className="h-4 w-4 text-blue-700" />
            جدولة سنوية
            {schedule.last_backup_at && (
              <Badge variant="secondary" className="ms-auto">
                آخر نسخة: {schedule.last_backup_at.slice(0, 10)}
              </Badge>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4 items-end">
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="bk-enabled"
                checked={schedule.enabled}
                onChange={(e) => setSchedule((p) => ({ ...p, enabled: e.target.checked }))}
                data-testid="backup-schedule-enabled"
                className="h-4 w-4 cursor-pointer"
              />
              <label htmlFor="bk-enabled" className="text-sm cursor-pointer">
                تفعيل تذكير سنوي بعمل نسخة احتياطية
              </label>
            </div>
            <div>
              <Label className="text-xs">اليوم</Label>
              <Input
                data-testid="backup-schedule-day"
                type="number"
                min={1}
                max={31}
                value={schedule.day}
                onChange={(e) => setSchedule((p) => ({ ...p, day: parseInt(e.target.value || "1", 10) }))}
              />
            </div>
            <div>
              <Label className="text-xs">الشهر</Label>
              <Input
                data-testid="backup-schedule-month"
                type="number"
                min={1}
                max={12}
                value={schedule.month}
                onChange={(e) => setSchedule((p) => ({ ...p, month: parseInt(e.target.value || "1", 10) }))}
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              data-testid="backup-schedule-save"
              size="sm"
              variant="secondary"
              onClick={saveSchedule}
              disabled={savingSched}
              className="gap-2"
            >
              {savingSched ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              حفظ الجدولة
            </Button>
          </div>

          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            عند وصول التاريخ المحدد كل عام، سيظهر تنبيه أعلى هذه البطاقة لتذكيرك بأخذ نسخة احتياطية جديدة.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
