import { useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { Archive, ArrowRight, Building2, LogOut, Settings, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import PresenceIndicator from "./PresenceIndicator";
import { announceLogout } from "../lib/usePresence";

const allNavItems = [
  { to: "/departments", label: "الإدارات", icon: Building2, testId: "shell-nav-departments-link", roles: ["super_admin", "admin", "employee"] },
  { to: "/admin", label: "الأدمن", icon: Settings, testId: "shell-nav-admin-link", roles: ["super_admin", "admin"] },
];

const DEFAULT_DEPARTMENT_NAME = "مشروع التكافل الاجتماعي";

function resolveDepartmentName(pathname) {
  // Match /project/:deptId/... and look up the cached departments
  const projectMatch = pathname.match(/^\/project\/([^/]+)/);
  if (!projectMatch) return DEFAULT_DEPARTMENT_NAME;
  const deptId = projectMatch[1];
  try {
    const cached = JSON.parse(localStorage.getItem("archive_departments_cache") || "[]");
    const found = Array.isArray(cached) ? cached.find((d) => d.id === deptId) : null;
    return (found && found.name) || DEFAULT_DEPARTMENT_NAME;
  } catch {
    return DEFAULT_DEPARTMENT_NAME;
  }
}

export default function AppShell({ children, title, subtitle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("archive_user") || "{}");
  const navItems = allNavItems.filter((it) => !it.roles || it.roles.includes(user.role));

  // Browser-tab title: "[Current page] | [Department name]". The department name
  // is resolved from the URL via the cached departments list, falling back to
  // the project's default name. Updates automatically when route or title change.
  useEffect(() => {
    const pageTitle = (title || "الأرشيف الإلكتروني").trim();
    const deptName = resolveDepartmentName(location.pathname);
    document.title = `${pageTitle} | ${deptName}`;
  }, [title, location.pathname]);
  // Show back button on every page except the top departments landing page.
  const showBack = !["/", "/departments"].includes(location.pathname);
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/departments");
  };

  const logout = () => {
    // Best-effort: tell the backend to drop our presence row before we lose the token.
    try { announceLogout(); } catch { /* ignore */ }
    localStorage.removeItem("archive_token");
    localStorage.removeItem("archive_user");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f8fc] via-[#eef2f7] to-[#f6f8fc] text-slate-950" data-testid="app-shell">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-72 border-s border-slate-200 bg-white/90 backdrop-blur lg:block" data-testid="sidebar">
        <div className="flex h-full flex-col p-6">
          <Link to="/departments" className="flex items-center gap-3" data-testid="sidebar-brand-link">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#0f3a73] to-[#1c4f9c] text-white shadow-[0_8px_18px_-8px_rgba(15,58,115,0.6)]" data-testid="sidebar-brand-icon">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <p className="font-extrabold tracking-tight text-slate-950" data-testid="sidebar-brand-title">الأرشيف الإلكتروني</p>
              <p className="text-xs text-slate-500" data-testid="sidebar-brand-subtitle"></p>
            </div>
          </Link>

          <nav className="mt-10 space-y-2" data-testid="sidebar-navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  data-testid={item.testId}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-[background-color,color,transform] duration-200 ${
                      isActive ? "bg-gradient-to-l from-[#0f3a73] to-[#1c4f9c] text-white shadow-[0_8px_20px_-12px_rgba(15,58,115,0.6)]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="sidebar-user-box">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900" data-testid="sidebar-user-name">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {user.display_name || "مدير النظام"}
            </div>
            <Button variant="outline" className="mt-3 w-full" onClick={logout} data-testid="logout-button">
              <LogOut className="h-4 w-4" /> خروج
            </Button>
          </div>
        </div>
      </aside>

      <main className="lg:ps-72" data-testid="main-layout">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur" data-testid="top-header">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {showBack && (
                <Button type="button" variant="outline" size="sm" onClick={goBack} className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50" data-testid="header-back-button">
                  <ArrowRight className="h-4 w-4" /> رجوع
                </Button>
              )}
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950" data-testid="page-title">{title}</h1>
                <p className="mt-1 text-sm text-slate-500" data-testid="page-subtitle">{subtitle}</p>
              </div>
            </div>
            <div className="flex gap-2 lg:hidden" data-testid="mobile-nav-actions">
              {navItems.map((item) => (
                <Button key={item.to} asChild variant="outline" size="sm" data-testid={`mobile-${item.testId}`}>
                  <Link to={item.to}>{item.label}</Link>
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={logout} data-testid="mobile-logout-button">خروج</Button>
            </div>
            <div className="flex items-center gap-3" data-testid="header-right-cluster">
              <PresenceIndicator />
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8" data-testid="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
