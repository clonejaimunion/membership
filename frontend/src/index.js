import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { registerServiceWorker } from "@/lib/sw-register";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Enable offline support and background updates.
registerServiceWorker({
  onUpdate: () => {
    // The next page load will pick up the new service worker. We also rely on
    // the /api/version poller in lib/api.js to trigger an automatic reload
    // when the backend ships a new bundle.
  },
});
