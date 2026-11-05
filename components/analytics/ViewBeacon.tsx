"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Counts one anonymous page view (POST /api/track) after the page loads. Renders nothing.
// Skipped with Do Not Track or Global Privacy Control. The tab remembers where the visit started
// (Instagram, a QR code...) so clicks around the artist's pages keep that source.
const KEY = "af_touch";
let last = ""; // React dev mode runs effects twice

type Touch = { ref?: string; utm?: string; src?: string; c?: string; qr?: 1 };

function landing(): Touch {
  const q = new URLSearchParams(location.search);
  const t: Touch = {};
  try { if (document.referrer && new URL(document.referrer).host !== location.host) t.ref = document.referrer; } catch { /* bad referrer */ }
  if (q.get("utm_source")) t.utm = q.get("utm_source")!;
  if (q.get("src")) t.src = q.get("src")!;
  if (q.get("c")) t.c = q.get("c")!;
  if (q.has("at") || q.has("off")) t.qr = 1; // older printed codes
  return t;
}

export default function ViewBeacon({ artistId, artworkId }: { artistId: string; artworkId?: string | null }) {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const n = navigator as Navigator & { globalPrivacyControl?: boolean };
      if (n.doNotTrack === "1" || n.globalPrivacyControl === true) return;
      const key = `${artistId}|${artworkId || ""}|${location.pathname}`;
      if (key === last) return;
      last = key;

      let touch = landing();
      try {
        if (Object.keys(touch).length) sessionStorage.setItem(KEY, JSON.stringify(touch));
        else touch = JSON.parse(sessionStorage.getItem(KEY) || "{}");
      } catch { /* storage blocked */ }

      const body = JSON.stringify({ artistId, artworkId: artworkId || null, path: location.pathname, ...touch });
      const sent = typeof n.sendBeacon === "function" && n.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      if (!sent) fetch("/api/track", { method: "POST", body, keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json" } }).catch(() => {});
    } catch { /* never break the page */ }
  }, [artistId, artworkId, pathname]);
  return null;
}
