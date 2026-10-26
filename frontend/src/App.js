import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import LoginPage from "./pages/LoginPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import AdminPage from "./pages/AdminPage";
import ProjectPage from "./pages/ProjectPage";
import MembershipPage from "./pages/MembershipPage";
import FinancialGatewayPage from "./pages/FinancialGatewayPage";
import LettersGatewayPage from "./pages/LettersGatewayPage";
import AidGatewayPage from "./pages/AidGatewayPage";
import AidPendingPage from "./pages/AidPendingPage";
import AidDisbursedPage from "./pages/AidDisbursedPage";
import AidsReportPage from "./pages/AidsReportPage";
import DuesSettlementsPage from "./pages/DuesSettlementsPage";
import LettersGeneratePage from "./pages/LettersGeneratePage";
import UsersAdminPage from "./pages/UsersAdminPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import CommitteesDuesPage from "./pages/CommitteesDuesPage";
import DisclosureReportsPage from "./pages/DisclosureReportsPage";
import DisclosurePrintPage from "./pages/DisclosurePrintPage";
import CategoryArchivePage from "./pages/CategoryArchivePage";
import PensionPage from "./pages/PensionPage";
import CreditsPage from "./pages/CreditsPage";
import ManualPage from "./pages/ManualPage";
import OfflineBanner from "./components/OfflineBanner";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("archive_token");
  return token ? children : <Navigate to="/" replace />;
};

function App() {
  useEffect(() => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "ar");

    // Global Arabic-Indic digit converter for displayed text (excludes inputs/edit fields)
    const AR = "٠١٢٣٤٥٦٧٨٩";
    const toArabic = (s) => s.replace(/[0-9]/g, (d) => AR[d]);
    const SKIP_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION", "SCRIPT", "STYLE", "CODE", "PRE"]);
    const shouldSkip = (el) => {
      if (!el) return true;
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.isContentEditable) return true;
      if (el.closest && el.closest("[data-no-ar-digits]")) return true;
      return false;
    };
    const convertNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!shouldSkip(node.parentElement)) {
          const v = node.nodeValue;
          if (v && /[0-9]/.test(v)) {
            const nv = toArabic(v);
            if (nv !== v) node.nodeValue = nv;
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && !shouldSkip(node)) {
        // Also convert placeholder attributes for visible read-only displays? leave inputs alone.
        node.childNodes && node.childNodes.forEach(convertNode);
      }
    };
    const root = document.body;
    convertNode(root);
    // Batch MutationObserver work using requestAnimationFrame to avoid blocking
    // the main thread during heavy renders (e.g. paginated tables).
    let pending = new Set();
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      const targets = Array.from(pending);
      pending.clear();
      for (const t of targets) {
        try { convertNode(t); } catch { /* ignore detached nodes */ }
      }
    };
    const schedule = (target) => {
      pending.add(target);
      if (!scheduled) {
        scheduled = true;
        (window.requestAnimationFrame || window.setTimeout)(flush, 16);
      }
    };
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") {
          schedule(m.target);
        } else if (m.type === "childList") {
          m.addedNodes.forEach((n) => schedule(n));
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="App">
      <OfflineBanner />
      <BrowserRouter>
        <Toaster position="top-center" richColors closeButton dir="rtl" />
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/departments" element={<ProtectedRoute><DepartmentsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><UsersAdminPage /></ProtectedRoute>} />
          <Route path="/admin/credits" element={<ProtectedRoute><CreditsPage /></ProtectedRoute>} />
          <Route path="/manual" element={<ProtectedRoute><ManualPage /></ProtectedRoute>} />
          <Route path="/project/:id" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
          <Route path="/project/:id/membership" element={<ProtectedRoute><MembershipPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial" element={<ProtectedRoute><FinancialGatewayPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/subscriptions" element={<ProtectedRoute><SubscriptionsPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/dues-settlements" element={<ProtectedRoute><DuesSettlementsPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/dues" element={<ProtectedRoute><CommitteesDuesPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/disclosure" element={<ProtectedRoute><DisclosureReportsPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/disclosure/:kind" element={<ProtectedRoute><DisclosurePrintPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/aid" element={<ProtectedRoute><AidGatewayPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/aid/pending" element={<ProtectedRoute><AidPendingPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/aid/disbursed" element={<ProtectedRoute><AidDisbursedPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/aid/report" element={<ProtectedRoute><AidsReportPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/aid/:subcategory" element={<ProtectedRoute><CategoryArchivePage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/letters" element={<ProtectedRoute><LettersGatewayPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/letters/generate" element={<ProtectedRoute><LettersGeneratePage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/letters/:subcategory" element={<ProtectedRoute><CategoryArchivePage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/pension" element={<ProtectedRoute><PensionPage /></ProtectedRoute>} />
          <Route path="/project/:id/financial/:category" element={<ProtectedRoute><CategoryArchivePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/departments" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
