import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, LogIn, UserRound } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api, getErrorMessage } from "../lib/api";

const loginBackground = "https://static.prod-images.emergentagent.com/jobs/1ed68360-6e46-4b8e-afe3-7799ec0a4a75/images/b8fe9bf6fbdbb97faa991ef4ec0728736f98d6c79a51a222fb2ef9a51796f043.png";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("archive_token", data.token);
      localStorage.setItem("archive_user", JSON.stringify(data.user));
      navigate("/departments");
    } catch (err) {
      const status = err?.response?.status;
      // Give specific, actionable messages instead of the raw axios string.
      if (status === 404) {
        setError("⚠️ تعذّر الوصول للخادم (404). تأكد من تشغيل الخادم المحلي على المنفذ 5599 ثم حدّث الصفحة.");
      } else if (status === 401) {
        setError(err?.response?.data?.detail || "بيانات الدخول غير صحيحة. يرجى التحقق من اسم المستخدم وكلمة المرور.");
      } else if (status === 403) {
        setError("هذا الحساب موقوف. تواصل مع مدير النظام.");
      } else if (!err?.response) {
        setError("⚠️ تعذّر الاتصال بالخادم. تأكد من تشغيل البرنامج محلياً ثم أعد المحاولة.");
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white" data-testid="login-page">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden lg:block" data-testid="login-media-section">
          <img src={loginBackground} alt="أرشيف هندسي منظم" className="h-full w-full object-cover" data-testid="login-background-image" />
          <div className="absolute inset-0 bg-slate-950/35" />
          <div className="absolute bottom-12 right-12 max-w-xl" data-testid="login-brand-copy">
            <p className="mb-4 inline-flex rounded-md bg-white px-3 py-1 text-xs font-bold text-[#0047AB]" data-testid="login-brand-badge">منظومة داخلية</p>
            <h1 className="text-5xl font-bold leading-tight tracking-tight" data-testid="login-brand-title">أرشيف إلكتروني منظم للعضويات والاستمارات</h1>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[#F8FAFC] px-4 py-10 text-slate-950" data-testid="login-form-section">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8" data-testid="login-heading-block">
              <div className="mb-5 grid h-14 w-14 place-items-center rounded-lg bg-[#0047AB] text-white" data-testid="login-logo-mark">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <h2 className="text-4xl font-bold tracking-tight" data-testid="login-title">تسجيل الدخول</h2>
            </div>

            <form onSubmit={submit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm" data-testid="login-form">
              <div className="space-y-2">
                <Label htmlFor="username" data-testid="username-label">اسم المستخدم</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="pe-10" data-testid="username-input" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" data-testid="password-label">كلمة المرور</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pe-10" data-testid="password-input" />
                </div>
              </div>
              {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="login-error-message">{error}</p>}
              <Button type="submit" className="h-11 w-full bg-[#0047AB] hover:bg-[#003380]" disabled={loading} data-testid="login-submit-button">
                <LogIn className="h-4 w-4" /> {loading ? "جارٍ الدخول..." : "دخول النظام"}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
