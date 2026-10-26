import { useState } from "react";
import { Users } from "lucide-react";
import usePresence from "../lib/usePresence";

// Two-letter Arabic initials from a display name. Fallback to "?".
const initialsOf = (name) => {
  if (!name) return "؟";
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || parts[0]?.[1] || "";
  return (first + second) || "؟";
};

// Deterministic colour per user_id so the same person always shows the same hue.
const palette = [
  "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-rose-500",
  "bg-amber-500", "bg-cyan-500", "bg-fuchsia-500", "bg-teal-500",
];
const hueFor = (id) => {
  if (!id) return palette[0];
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

const roleLabel = {
  super_admin: "مدير أعلى",
  admin: "أدمن",
  employee: "موظف",
};

export default function PresenceIndicator() {
  const { others, count } = usePresence();
  const [open, setOpen] = useState(false);

  // Hide entirely when nobody else is online — avoids a confusing empty badge.
  if (!count) return null;

  const shown = others.slice(0, 3);
  const hidden = Math.max(0, count - shown.length);

  return (
    <div className="relative" data-testid="presence-indicator">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
        data-testid="presence-toggle"
        title={`${count} مستخدم آخر متصل الآن`}
      >
        <Users className="h-3.5 w-3.5 text-emerald-600" />
        <div className="flex -space-x-1.5 -space-x-reverse" data-testid="presence-stack">
          {shown.map((u) => (
            <span
              key={u.user_id}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white ${hueFor(u.user_id)}`}
              title={u.display_name || u.username}
              data-testid={`presence-avatar-${u.user_id}`}
            >
              {initialsOf(u.display_name || u.username)}
            </span>
          ))}
          {hidden > 0 && (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-[10px] font-bold text-white" data-testid="presence-overflow">
              +{hidden}
            </span>
          )}
        </div>
        <span className="hidden tabular-nums sm:inline" data-testid="presence-count">{count} متصل</span>
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} data-testid="presence-backdrop" />
          <div
            className="absolute end-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            data-testid="presence-panel"
          >
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600">
              المتواجدون الآن ({count})
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {others.map((u) => (
                <li
                  key={u.user_id}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50"
                  data-testid={`presence-row-${u.user_id}`}
                >
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${hueFor(u.user_id)}`}>
                    {initialsOf(u.display_name || u.username)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-bold text-slate-900">{u.display_name || u.username}</span>
                      <span className="relative flex h-1.5 w-1.5" aria-hidden>
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="truncate">{u.page_title || "—"}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {roleLabel[u.role] || u.role || "—"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
