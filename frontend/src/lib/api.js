import axios from "axios";

// In local LAN deployment, REACT_APP_BACKEND_URL may be empty so the frontend
// uses relative paths (/api/...) served by the same FastAPI host.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("archive_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Lightweight in-memory + sessionStorage cache for slow-moving GET endpoints
// (e.g. /departments, /classifications?…). Cuts redundant network traffic when
// the user navigates between pages.
const _memCache = new Map(); // key -> { data, ts }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _isCacheable = (url, method) => {
  if ((method || "get").toLowerCase() !== "get") return false;
  if (!url) return false;
  if (url === "/departments" || url.endsWith("/departments")) return true;
  if (url.startsWith("/classifications") || url.includes("/classifications?")) return true;
  if (url.startsWith("/retirement-schedules") || url.endsWith("/retirement-schedules")) return true;
  return false;
};
const _cacheKey = (cfg) => `${(cfg.baseURL || "")}${cfg.url || ""}`;
const _readSession = (key) => {
  try {
    const raw = sessionStorage.getItem(`__ea_cache__${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
};
const _writeSession = (key, payload) => {
  try { sessionStorage.setItem(`__ea_cache__${key}`, JSON.stringify(payload)); } catch { /* ignore */ }
};
export const invalidateApiCache = (pattern) => {
  // pattern can be a substring like "departments" — drops any cache key containing it.
  const drop = (k) => { _memCache.delete(k); try { sessionStorage.removeItem(`__ea_cache__${k}`); } catch {} };
  if (!pattern) {
    _memCache.clear();
    try { Object.keys(sessionStorage).filter((k) => k.startsWith("__ea_cache__")).forEach((k) => sessionStorage.removeItem(k)); } catch {}
    return;
  }
  Array.from(_memCache.keys()).forEach((k) => { if (k.includes(pattern)) drop(k); });
  try { Object.keys(sessionStorage).filter((k) => k.startsWith("__ea_cache__") && k.includes(pattern)).forEach((k) => sessionStorage.removeItem(k)); } catch {}
};

api.interceptors.request.use((config) => {
  if (!_isCacheable(config.url, config.method)) return config;
  const key = _cacheKey(config);
  const mem = _memCache.get(key);
  const fresh = mem || _readSession(key);
  if (fresh && Date.now() - fresh.ts <= CACHE_TTL_MS) {
    // Short-circuit: resolve with cached payload by abusing axios adapter.
    config.adapter = () => Promise.resolve({
      data: fresh.data, status: 200, statusText: "OK (cached)",
      headers: {}, config, request: null,
    });
  }
  return config;
});

// Cache the departments list locally so the browser-tab title can resolve the
// current department name without an extra round-trip on every page.
api.interceptors.response.use((response) => {
  try {
    const url = response.config?.url || "";
    if (url === "/departments" || url.endsWith("/departments")) {
      if (Array.isArray(response.data)) {
        const slim = response.data.map((d) => ({ id: d.id, name: d.name, code: d.code }));
        localStorage.setItem("archive_departments_cache", JSON.stringify(slim));
      }
    }
    // Persist cacheable GET responses to mem + session storage.
    if (_isCacheable(url, response.config?.method) && response.status === 200) {
      const key = _cacheKey(response.config);
      const payload = { data: response.data, ts: Date.now() };
      _memCache.set(key, payload);
      _writeSession(key, payload);
    }
    // Invalidate cache on writes to related collections.
    const wmethod = (response.config?.method || "").toLowerCase();
    if (wmethod && wmethod !== "get") {
      if (url.includes("/departments")) invalidateApiCache("departments");
      if (url.includes("/classifications") || url.includes("/members") || url.includes("/merge-committees")) invalidateApiCache("classifications");
      if (url.includes("/retirement-schedules")) invalidateApiCache("retirement-schedules");
    }
  } catch { /* cache write is best-effort */ }
  return response;
});

export const getErrorMessage = (error) => {
  if (error?.message === "Network Error") {
    return "تعذر الاتصال من المتصفح. تأكد من اتصال الشبكة ثم جرّب مرة أخرى.";
  }
  
  const detail = error?.response?.data?.detail;
  
  // إذا كان detail عبارة عن string، استخدمه مباشرة
  if (typeof detail === "string") {
    return detail;
  }
  
  // إذا كان detail عبارة عن array من validation errors
  if (Array.isArray(detail)) {
    return detail.map(err => err.msg || JSON.stringify(err)).join(", ");
  }
  
  // إذا كان detail عبارة عن object
  if (detail && typeof detail === "object") {
    return detail.msg || JSON.stringify(detail);
  }
  
  return error?.message || "حدث خطأ غير متوقع";
};

// ─── Auto-reload when a new build is deployed ─────────────────────────────
// The backend serves /api/version which changes whenever the frontend bundle
// is rebuilt. We poll lightly and reload the page if the version drifts —
// so the user never has to clear the browser cache manually.
let __knownAppVersion = null;
const __checkAppVersion = async () => {
  try {
    const res = await api.get("/version", { __skipRetry: true });
    const v = res?.data?.version;
    if (!v) return;
    if (__knownAppVersion === null) {
      __knownAppVersion = v;
      return;
    }
    if (v !== __knownAppVersion) {
      // A new build has been deployed. Force a hard reload that bypasses cache.
      try { sessionStorage.removeItem("__ea_cache__"); } catch {}
      window.location.reload();
    }
  } catch {
    /* server might be restarting — ignore */
  }
};
// Initial probe shortly after mount + every 60s thereafter.
if (typeof window !== "undefined") {
  setTimeout(__checkAppVersion, 1500);
  setInterval(__checkAppVersion, 60_000);
  // Re-check whenever the tab regains focus.
  window.addEventListener("focus", __checkAppVersion);
}

// ─── Resilient request retry for transient network blips ──────────────────
// During a server hot-reload or a brief Wi-Fi hiccup the request fails with
// "Network Error". We retry up to 2 more times with a short backoff so the
// user does not see a scary message for a 1-second outage.
api.interceptors.response.use(undefined, async (error) => {
  const cfg = error?.config || {};
  if (cfg.__skipRetry) return Promise.reject(error);
  const method = (cfg.method || "get").toLowerCase();
  const isTransient = !error.response && error.message === "Network Error";
  // Only auto-retry idempotent methods to avoid double-posting forms.
  if (!isTransient || !["get", "head", "options"].includes(method)) {
    return Promise.reject(error);
  }
  cfg.__retryCount = (cfg.__retryCount || 0) + 1;
  if (cfg.__retryCount > 2) return Promise.reject(error);
  const delayMs = 600 * cfg.__retryCount; // 600ms, 1.2s
  await new Promise((r) => setTimeout(r, delayMs));
  return api.request(cfg);
});

export const downloadFile = async (url, filename) => {
  const res = await api.get(url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};
