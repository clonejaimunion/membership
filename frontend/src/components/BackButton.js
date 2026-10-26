import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

/**
 * BackButton - Reusable back-navigation button used across all gateways/pages/reports.
 * Uses browser history when possible; otherwise falls back to a provided `to` route or the home page.
 */
export default function BackButton({ to, label = "رجوع", className = "" }) {
  const navigate = useNavigate();
  const handle = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (to) {
      navigate(to);
    } else {
      navigate("/");
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      onClick={handle}
      className={`gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 ${className}`}
      data-testid="back-button"
    >
      <ArrowRight className="h-4 w-4" />
      {label}
    </Button>
  );
}
