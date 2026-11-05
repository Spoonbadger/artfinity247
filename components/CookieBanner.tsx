"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Small cookie notice: a slim strip at the bottom on phones, a small pill in the bottom-left corner on wider screens.
 * Pages with a sticky bottom bar (the scan page's buy bar) set `--af-bottom-bar` on :root and it docks on top of the bar.
 * There, and on pages that set `--af-cookie-wait` (painting, cart), it waits for the first scroll, so the title, price
 * and buttons stay clear on load.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("cookieConsent") === "accepted") return;
    } catch {}
    const css = getComputedStyle(document.documentElement);
    const wait = (parseFloat(css.getPropertyValue("--af-bottom-bar")) || 0) > 0 || css.getPropertyValue("--af-cookie-wait").trim() === "1";
    if (!wait || window.scrollY > 80) {
      setVisible(true);
      return;
    }
    const onScroll = () => {
      if (window.scrollY > 80) {
        setVisible(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--af-bottom-bar,0px)+env(safe-area-inset-bottom,0px))] z-40 flex justify-center sm:bottom-[calc(var(--af-bottom-bar,0px)+env(safe-area-inset-bottom,0px)+16px)] sm:justify-start sm:px-4"
    >
      <div className="pointer-events-auto flex w-full items-center gap-3 border-t border-line bg-white/95 py-1.5 pl-4 pr-4 text-[13px] text-ink backdrop-blur sm:w-auto sm:rounded-full sm:border-2 sm:border-ink sm:bg-white sm:py-1 sm:pr-1 sm:text-[14px] sm:shadow-[0_10px_30px_-10px_rgba(21,22,27,.45)]">
        <p className="m-0 min-w-0 flex-1 leading-snug">
          We use cookies.{" "}
          <Link href="/cookie-policy" className="font-semibold text-ink underline underline-offset-2">
            Details
          </Link>
        </p>
        <button type="button" onClick={accept} className="btn btn-blue btn-sm min-h-[36px] shrink-0 px-4 text-[14px] sm:min-h-[40px]">
          OK
        </button>
      </div>
    </div>
  );
}
