"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Small cookie notice. On phones it floats as a compact pill ABOVE any sticky bottom bar:
 * pages with one (the scan page's buy bar) set `--af-bottom-bar` on :root to the bar's height.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("cookieConsent") === "accepted") return;
    } catch {}
    setVisible(true);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem("cookieConsent", "accepted");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 sm:px-4"
      style={{ bottom: "calc(var(--af-bottom-bar, 0px) + env(safe-area-inset-bottom, 0px) + 10px)" }}
    >
      <div className="pointer-events-auto flex w-full max-w-[560px] items-center gap-3 rounded-full border-2 border-ink bg-white py-1 pl-4 pr-1 text-[14px] text-ink shadow-[0_10px_30px_-10px_rgba(21,22,27,.45)]">
        <p className="m-0 min-w-0 flex-1 leading-snug">
          We use cookies.{" "}
          <Link href="/cookie-policy" className="font-semibold text-ink underline underline-offset-2">
            Details
          </Link>
        </p>
        <button type="button" onClick={accept} className="btn btn-blue min-h-[44px] shrink-0 px-5 text-[15px]">
          OK
        </button>
      </div>
    </div>
  );
}
