import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpLeft, Building2, FolderArchive, Loader2 } from "lucide-react";
import AppShell from "../components/AppShell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { api, getErrorMessage } from "../lib/api";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/departments")
      .then(({ data }) => setDepartments(data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="اختيار الإدارة" subtitle="اختر الإدارة المطلوبة لبدء أرشفة الملفات والعضويات.">
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]" data-testid="departments-page">
        <div className="grid gap-4 md:grid-cols-2" data-testid="departments-grid">
          {loading && <div className="flex items-center gap-2 text-slate-500" data-testid="departments-loading"><Loader2 className="h-4 w-4 animate-spin" /> تحميل الإدارات...</div>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" data-testid="departments-error-message">{error}</div>}
          {departments.filter((department) => department.active).map((department) => (
            <Link
              key={department.id}
              to={`/project/${department.id}`}
              className="group rounded-lg border border-slate-200 bg-white p-6 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-[#0047AB] hover:shadow-md"
              data-testid={`department-card-${department.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-[#0047AB]" data-testid={`department-icon-${department.id}`}>
                  <Building2 className="h-6 w-6" />
                </div>
                <ArrowUpLeft className="h-5 w-5 text-slate-400 transition-transform duration-200 group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:text-[#0047AB]" />
              </div>
              <div className="mt-6">
                <Badge variant="outline" className="mb-3" data-testid={`department-code-${department.id}`}>{department.code || "إدارة"}</Badge>
                <h2 className="text-2xl font-bold text-slate-950" data-testid={`department-name-${department.id}`}>{department.name}</h2>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500" data-testid={`department-description-${department.id}`}>{department.description || "جاهزة لاستقبال الملفات والأعضاء."}</p>
              </div>
            </Link>
          ))}
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-6" data-testid="departments-summary-panel">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-emerald-50 text-emerald-700" data-testid="departments-summary-icon">
            <FolderArchive className="h-6 w-6" />
          </div>
          <h3 className="mt-6 text-xl font-bold text-slate-950" data-testid="departments-summary-title">التحكم من الأدمن</h3>
          <p className="mt-3 text-sm leading-6 text-slate-500" data-testid="departments-summary-text">يمكنك إضافة الإدارات وتعديل بيانات اتصال الطابعة/الماسح من صفحة الأدمن.</p>
          <Button asChild className="mt-6 w-full bg-[#0047AB] hover:bg-[#003380]" data-testid="go-to-admin-button">
            <Link to="/admin">فتح صفحة الأدمن</Link>
          </Button>
        </aside>
      </section>
    </AppShell>
  );
}
