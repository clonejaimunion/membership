import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "./api";

// Heartbeat interval — server keeps a row alive for ~45s so missing 1-2 beats
// is fine. Beats stop when the tab is hidden to avoid waking up sleeping laptops.
const HEARTBEAT_MS = 15_000;

const cache = { users: [], count: 0 };
const listeners = new Set();
const notify = () => listeners.forEach((cb) => cb(cache));

const labelForPath = (pathname) => {
  // Keep this terse — the indicator tooltip shows it as "Page: <label>".
  if (!pathname) return "";
  if (pathname === "/departments") return "الإدارات";
  if (pathname.startsWith("/admin/users")) return "إدارة المستخدمين";
  if (pathname.startsWith("/admin/credits")) return "البيانات الافتتاحية";
  if (pathname.startsWith("/admin")) return "لوحة الأدمن";
  if (pathname.startsWith("/manual")) return "دليل المستخدم";
  if (/\/membership(\b|$)/.test(pathname)) return "العضوية";
  if (/\/subscriptions(\b|$)/.test(pathname)) return "الاشتراكات";
  if (/\/dues-settlements(\b|$)/.test(pathname)) return "تسويات المستحقات";
  if (/\/dues(\b|$)/.test(pathname)) return "مستحقات اللجان";
  if (/\/aid\/pending(\b|$)/.test(pathname)) return "إعانات معلّقة";
  if (/\/aid\/disbursed(\b|$)/.test(pathname)) return "إعانات مصروفة";
  if (/\/aid\/report(\b|$)/.test(pathname)) return "تقارير الإعانات";
  if (/\/aid(\b|$)/.test(pathname)) return "الإعانات";
  if (/\/letters\/generate(\b|$)/.test(pathname)) return "إنشاء خطابات";
  if (/\/letters(\b|$)/.test(pathname)) return "الخطابات";
  if (/\/financial(\b|$)/.test(pathname)) return "الموقف المالي";
  if (/^\/project\//.test(pathname)) return "بوابة المشروع";
  return "";
};

let beatTimer = null;
let pollTimer = null;
let started = false;

const beat = async (pathname) => {
  try {
    if (typeof document !== "undefined" && document.hidden) return;
    if (!localStorage.getItem("archive_token")) return;
    await api.post("/presence/heartbeat", {
      path: pathname || (typeof window !== "undefined" ? window.location.pathname : ""),
      page_title: labelForPath(pathname),
    });
  } catch { /* offline / 401 — silently skip */ }
};

const poll = async () => {
  try {
    if (!localStorage.getItem("archive_token")) return;
    const { data } = await api.get("/presence/online");
    cache.users = Array.isArray(data?.users) ? data.users : [];
    cache.count = data?.count || cache.users.length;
    notify();
  } catch { /* ignore — keep last value */ }
};

const start = (pathname) => {
  if (started) return;
  started = true;
  beat(pathname);
  poll();
  beatTimer = setInterval(() => beat(window.location.pathname), HEARTBEAT_MS);
  pollTimer = setInterval(poll, HEARTBEAT_MS);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) { beat(window.location.pathname); poll(); }
    });
  }
};

export const announceLogout = async () => {
  try { await api.post("/presence/logout"); } catch { /* ignore */ }
};

export default function usePresence() {
  const location = useLocation();
  const [state, setState] = useState(cache);

  useEffect(() => {
    const cb = (next) => setState({ users: next.users, count: next.count });
    listeners.add(cb);
    start(location.pathname);
    return () => { listeners.delete(cb); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-beat on route change so the page label updates promptly.
  useEffect(() => {
    if (started) beat(location.pathname);
  }, [location.pathname]);

  const currentUserId = (() => {
    try { return JSON.parse(localStorage.getItem("archive_user") || "{}")?.id || ""; }
    catch { return ""; }
  })();
  const others = state.users.filter((u) => u.user_id && u.user_id !== currentUserId);
  return { all: state.users, others, count: others.length };
}
