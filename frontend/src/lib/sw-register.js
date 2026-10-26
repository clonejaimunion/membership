/**
 * Register the service worker and expose lifecycle hooks for the UI.
 * Designed to be called once from src/index.js.
 */
export function registerServiceWorker({ onOffline, onOnline, onUpdate } = {}) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // Only register in production builds (CRA exposes process.env.NODE_ENV).
  if (process.env.NODE_ENV !== "production") return;

  // After-update cache-bust: the Windows installer launches the browser with
  // `?v=<unix-ts>` to guarantee a fully fresh boot. When we see that flag we
  // wipe ALL existing SW registrations + cache buckets, reload once, and then
  // continue normally. The flag is consumed (URL is rewritten) so this only
  // runs at most once per launch.
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("v") && !sessionStorage.getItem("__sw_busted__")) {
      sessionStorage.setItem("__sw_busted__", "1");
      (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
          if (window.caches && typeof caches.keys === "function") {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
          }
        } catch { /* ignore — best-effort */ }
        // Rewrite URL so a future refresh doesn't re-trigger this branch.
        const clean = window.location.pathname + window.location.hash;
        window.location.replace(clean);
      })();
      return; // Don't register a SW for this short-lived "boot" cycle.
    }
  } catch { /* ignore */ }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        // Detect updates and notify the page.
        registration.onupdatefound = () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              if (typeof onUpdate === "function") onUpdate(registration);
            }
          };
        };
      })
      .catch(() => {
        // Silently ignore — SW is a progressive enhancement, not required.
      });
  });

  const fireOnline = () => {
    if (typeof onOnline === "function") onOnline();
  };
  const fireOffline = () => {
    if (typeof onOffline === "function") onOffline();
  };

  window.addEventListener("online", fireOnline);
  window.addEventListener("offline", fireOffline);
}
