import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Lightweight banner shown when the browser detects it has gone offline.
 * Anchored to the top of the page (RTL-friendly) and fades out automatically
 * a few seconds after connectivity is restored.
 */
export default function OfflineBanner() {
  const initiallyOnline =
    typeof navigator === "undefined" ? true : navigator.onLine;
  const [isOnline, setIsOnline] = useState(initiallyOnline);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(t);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showBackOnline) return null;

  return (
    <div
      data-testid="offline-banner"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "8px 14px",
        fontFamily: "'Cairo','Tahoma',sans-serif",
        fontSize: "13.5px",
        fontWeight: 700,
        color: "#fff",
        background: isOnline ? "#15803d" : "#b91c1c",
        boxShadow: "0 4px 16px rgba(0,0,0,.18)",
        transition: "background .25s ease",
      }}
    >
      <WifiOff size={16} aria-hidden="true" />
      {isOnline
        ? "تم استعادة الاتصال — يتم تحديث البيانات الآن."
        : "أنت تعمل دون اتصال. البيانات المعروضة مأخوذة من النسخة المحفوظة محلياً."}
    </div>
  );
}
