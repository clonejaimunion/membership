import { Link } from "react-router-dom";
import { ChevronLeft, ShieldCheck } from "lucide-react";

/**
 * Hero header for gateway pages.
 * crumbs: [{ to: "/path", label: "..." }, ...]  last item should be { label: "..." } without `to`
 */
export default function GatewayHero({ title, subtitle, crumbs = [], stats = [], icon: Icon, badge }) {
  return (
    <header
      className="relative overflow-hidden rounded-2xl border border-[#0f3a73]/15 bg-gradient-to-br from-[#0f3a73] via-[#103e7d] to-[#1c4f9c] p-7 text-white shadow-[0_18px_46px_-22px_rgba(15,58,115,0.55)]"
      data-testid="gateway-hero"
    >
      <div className="pointer-events-none absolute -end-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -start-32 -bottom-32 h-64 w-64 rounded-full bg-amber-300/15 blur-3xl" aria-hidden />

      {crumbs.length > 0 && (
        <nav className="relative flex flex-wrap items-center gap-1.5 text-xs text-white/85" data-testid="gateway-hero-breadcrumb">
          {crumbs.map((crumb, idx) => {
            const isLast = idx === crumbs.length - 1;
            return (
              <span key={idx} className="inline-flex items-center gap-1.5" data-testid={`gateway-crumb-${idx}`}>
                {!isLast && crumb.to ? (
                  <Link to={crumb.to} className="rounded-md px-1 py-0.5 font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white" data-testid={`gateway-crumb-link-${idx}`}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="rounded-md bg-white/15 px-2 py-0.5 font-bold text-white" data-testid={`gateway-crumb-active-${idx}`}>{crumb.label}</span>
                )}
                {!isLast && <ChevronLeft className="h-3.5 w-3.5 text-white/60" />}
              </span>
            );
          })}
        </nav>
      )}

      <div className="relative mt-3 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          {Icon ? (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/30 bg-white/10 text-white backdrop-blur-sm" data-testid="gateway-hero-icon">
              <Icon className="h-7 w-7" />
            </div>
          ) : null}
          <div>
            {badge && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-100" data-testid="gateway-hero-badge">
                <ShieldCheck className="h-3.5 w-3.5" /> {badge}
              </span>
            )}
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight" data-testid="gateway-hero-title">{title}</h1>
            {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/85" data-testid="gateway-hero-subtitle">{subtitle}</p>}
          </div>
        </div>
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-3" data-testid="gateway-hero-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-[120px] rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm" data-testid={`gateway-hero-stat-${stat.key || stat.label}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70" data-testid={`gateway-hero-stat-label-${stat.key || stat.label}`}>{stat.label}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums" data-testid={`gateway-hero-stat-value-${stat.key || stat.label}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
