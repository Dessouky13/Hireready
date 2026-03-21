import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize PostHog analytics (no package required — CDN snippet)
const phKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
if (phKey) {
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://us-assets.i.posthog.com/static/array.js";
  script.onload = () => {
    (window as any).posthog?.init(phKey, {
      api_host: "https://us.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false, // Manual tracking only — avoids capturing sensitive interview text
      persistence: "localStorage",
    });
  };
  document.head.appendChild(script);
}

createRoot(document.getElementById("root")!).render(<App />);
