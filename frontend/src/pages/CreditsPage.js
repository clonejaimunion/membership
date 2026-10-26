import { useEffect, useState } from "react";
import { Award, BadgeCheck, Fingerprint, Mail, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import AppShell from "../components/AppShell";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { api, API_BASE, getErrorMessage } from "../lib/api";

export default function CreditsPage() {
  const [credits, setCredits] = useState(null);
  const [error, setError] = useState("");
  const [signatureBlob, setSignatureBlob] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/credits");
        setCredits(data);
        // Fetch the signature with auth header → as blob URL for safe rendering
        try {
          const res = await api.get("/credits/signature", { responseType: "blob" });
          setSignatureBlob(URL.createObjectURL(res.data));
        } catch { /* signature missing — fall back to nothing */ }
      } catch (err) {
        setError(getErrorMessage(err));
      }
    })();
    return () => { if (signatureBlob) URL.revokeObjectURL(signatureBlob); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentUser = JSON.parse(localStorage.getItem("archive_user") || "{}");
  if (currentUser.role !== "super_admin") {
    return (
      <AppShell title="بصمة المبرمج" subtitle="هذه الصفحة مقتصرة على المدير العام.">
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-6 text-center text-red-700" data-testid="credits-denied">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10" />
          <p className="font-bold">صلاحية غير كافية</p>
          <p className="text-sm">هذه الصفحة مخصصة لـ Super Admin فقط.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="بصمة المبرمج وحقوق الملكية الفكرية" subtitle="معلومات المبرمج وحقوق التأليف — للعرض الإداري فقط.">
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="credits-error">{error}</div>}

      {credits && (
        <Card className="overflow-hidden border-[#0f3a73]/20 shadow-xl" data-testid="credits-card">
          {/* Gradient header */}
          <div className="relative bg-gradient-to-l from-[#0f3a73] via-[#1a4d8f] to-[#0f3a73] px-6 py-8 text-white">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 80%, white 0, transparent 40%)" }} />
            <div className="relative flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                <Award className="h-8 w-8 text-amber-300" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">شهادة حقوق ملكية فكرية</h2>
                <p className="mt-1 text-sm text-white/80">جميع حقوق التأليف والملكية الفكرية محفوظة © {credits.copyright_year}</p>
              </div>
            </div>
          </div>

          <CardContent className="grid gap-6 p-6 md:grid-cols-2">
            {/* Programmer info */}
            <div className="grid gap-3" data-testid="credits-info">
              <h3 className="border-r-4 border-amber-500 pr-3 text-lg font-extrabold text-slate-950">بيانات المبرمج</h3>

              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm">
                <Field icon={<BadgeCheck className="h-4 w-4 text-emerald-600" />} label="الاسم بالعربية" value={credits.name_ar} testid="credits-name-ar" />
                <Field icon={<BadgeCheck className="h-4 w-4 text-emerald-600" />} label="Name (English)" value={credits.name_en} testid="credits-name-en" dir="ltr" />
                <Field icon={<Fingerprint className="h-4 w-4 text-slate-700" />} label="الرقم القومي" value={credits.national_id} testid="credits-nid" tabular />
                <Field icon={<Phone className="h-4 w-4 text-slate-700" />} label="رقم الموبايل" value={credits.mobile} testid="credits-mobile" tabular dir="ltr" />
                <Field icon={<Mail className="h-4 w-4 text-slate-700" />} label="البريد الإلكتروني" value={credits.email} testid="credits-email" dir="ltr" />
              </div>
            </div>

            {/* Signature */}
            <div className="grid gap-3" data-testid="credits-signature-wrap">
              <h3 className="border-r-4 border-amber-500 pr-3 text-lg font-extrabold text-slate-950">التوقيع الشخصي المعتمد</h3>
              <div className="grid place-items-center gap-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/30 p-6">
                {signatureBlob ? (
                  <img
                    src={signatureBlob}
                    alt="توقيع المبرمج"
                    className="max-h-56 max-w-full rounded-md object-contain"
                    data-testid="credits-signature-img"
                  />
                ) : (
                  <div className="text-center text-sm text-slate-500">جاري تحميل التوقيع...</div>
                )}
                <div className="text-center text-xs font-bold text-amber-700">
                  {credits.name_ar}
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs leading-6 text-blue-900" data-testid="credits-legal-note">
                <strong>إشعار قانوني:</strong> هذا البرنامج وكافة محتوياته (الواجهة، قاعدة البيانات، الكود المصدري، التصميم) مملوكون حصرياً للمبرمج المذكور أعلاه. لا يجوز نسخ أو إعادة توزيع أي جزء بدون إذن خطّي مسبق.
              </div>
            </div>

            {/* Verification footer */}
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4" data-testid="credits-verify-footer">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
                <div className="text-sm">
                  <p className="font-extrabold text-emerald-900">بصمة معتمدة وموثّقة</p>
                  <p className="text-xs text-emerald-700">هذه الصفحة لا تظهر إلا للمدير العام (Super Admin) وتُعدّ توثيقاً رسمياً لحقوق المبرمج.</p>
                </div>
              </div>
              <Button onClick={() => window.print()} variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-100" data-testid="credits-print-btn">
                طباعة الشهادة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <style>{`@media print { 
        body * { visibility: hidden; }
        [data-testid="credits-card"], [data-testid="credits-card"] * { visibility: visible; }
        [data-testid="credits-card"] { position: absolute; right: 0; top: 0; width: 100%; box-shadow: none; border: 1px solid #cbd5e1; }
      }`}</style>
    </AppShell>
  );
}

function Field({ icon, label, value, testid, tabular = false, dir }) {
  return (
    <div className="grid grid-cols-3 items-center gap-3" data-testid={testid}>
      <div className="col-span-1 flex items-center gap-2 text-slate-600">
        {icon}
        <span className="text-xs font-bold">{label}</span>
      </div>
      <div className={`col-span-2 rounded-md border border-slate-200 bg-white px-3 py-2 font-bold text-slate-950 ${tabular ? "tabular-nums" : ""}`} dir={dir}>
        {value || "—"}
      </div>
    </div>
  );
}
