"use client";

import { useEffect } from "react";
import { listenForInstallPrompt } from "@/lib/pwa/install";

/**
 * Registers the service worker (public/sw.js) in production builds only, after the page has loaded.
 * In development it removes any worker left over from a production run on the same origin,
 * so dev never serves stale cached chunks.
 */
export default function PwaSetup() {
  useEffect(() => {
    listenForInstallPrompt();
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
