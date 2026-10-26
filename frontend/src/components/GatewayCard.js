import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Premium gateway tile used in gateway grids.
 * Props: { to, label, description, icon: Icon, count, countSuffix, accent: "blue|amber|emerald|rose|violet|sky" }
 */
const ACCENT_STYLES = {
  blue:    { bar: "bg-[#0f3a73]", chipBg: "bg-blue-50",    chipText: "text-[#0f3a73]" },
  amber:   { bar: "bg-amber-500", chipBg: "bg-amber-50",   chipText: "text-amber-700" },
  emerald: { bar: "bg-emerald-500", chipBg: "bg-emerald-50", chipText: "text-emerald-700" },
  rose:    { bar: "bg-rose-500",  chipBg: "bg-rose-50",    chipText: "text-rose-700" },
  violet:  { bar: "bg-violet-500", chipBg: "bg-violet-50", chipText: "text-violet-700" },
  sky:     { bar: "bg-sky-500",   chipBg: "bg-sky-50",     chipText: "text-sky-700" },
};

export default function GatewayCard({ to, label, description, icon: Icon, count = 0, countSuffix = "سجل", accent = "blue", testIdKey }) {
  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.blue;
  return (
    <Link
      to={to}
      className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[#0f3a73]/30 hover:shadow-[0_20px_40px_-22px_rgba(15,58,115,0.4)]"
      data-testid={`gateway-card-${testIdKey}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 ${styles.bar}`} aria-hidden />
      <div className="absolute -end-12 -top-12 h-32 w-32 rounded-full bg-slate-100/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />

      <div className="relative flex items-start justify-between gap-4">
        <div className={`grid h-14 w-14 place-items-center rounded-xl ${styles.chipBg} ${styles.chipText}`} data-testid={`gateway-card-icon-${testIdKey}`}>
          {Icon ? <Icon className="h-7 w-7" /> : null}
        </div>
        <div className={`inline-flex items-center gap-1 rounded-full ${styles.chipBg} px-3 py-1 text-[11px] font-bold ${styles.chipText}`} data-testid={`gateway-card-count-${testIdKey}`}>
          <span className="tabular-nums">{count}</span> {countSuffix}
        </div>
      </div>

      <h3 className="relative mt-5 text-xl font-extrabold tracking-tight text-slate-950" data-testid={`gateway-card-title-${testIdKey}`}>{label}</h3>
      {description && <p className="relative mt-2 text-sm leading-relaxed text-slate-500" data-testid={`gateway-card-desc-${testIdKey}`}>{description}</p>}

      <div className="relative mt-5 flex items-center justify-between border-t border-dashed border-slate-200 pt-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400" data-testid={`gateway-card-tag-${testIdKey}`}></span>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0f3a73] transition-transform duration-300 group-hover:-translate-x-1" data-testid={`gateway-card-open-${testIdKey}`}>
          فتح البوابة <ArrowLeft className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
