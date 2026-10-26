import { useEffect, useRef } from "react";
import { api } from "./api";

/**
 * Lightweight peer-to-peer change watcher.
 *
 * Polls the backend's /api/changes/state every `intervalMs` and invokes the
 * provided callback when the version counter of one of the watched collections
 * has been incremented (i.e. some OTHER user wrote to that collection).
 *
 * The callback receives the list of changed collection names. The caller is
 * responsible for silently refreshing its own data view — input fields and
 * open dialogs are NEVER auto-refreshed.
 *
 * Usage:
 *   useLiveChanges(["members"], (changed) => {
 *     // changed === ["members"]
 *     reloadMembersTable();   // silent refetch of the visible table
 *   });
 */
export default function useLiveChanges(watchCollections, onChange, intervalMs = 15000) {
  const lastCountersRef = useRef(null);
  const stableCb = useRef(onChange);
  stableCb.current = onChange;

  useEffect(() => {
    if (!Array.isArray(watchCollections) || watchCollections.length === 0) return undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        const { data } = await api.get("/changes/state", { __skipRetry: true });
        const counters = data?.counters || {};
        if (cancelled) return;
        if (lastCountersRef.current === null) {
          lastCountersRef.current = counters;
          return;
        }
        const changed = watchCollections.filter(
          (name) => (counters[name] || 0) !== (lastCountersRef.current[name] || 0)
        );
        lastCountersRef.current = counters;
        if (changed.length) stableCb.current?.(changed);
      } catch {
        /* peer is down or token expired — ignore */
      }
    };

    // Run once shortly after mount, then on each interval AND on tab focus.
    const initial = setTimeout(tick, 2000);
    const id = setInterval(tick, intervalMs);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchCollections.join("|"), intervalMs]);
}
