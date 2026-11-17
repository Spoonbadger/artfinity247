"use client";

import { useEffect } from "react";
import { easeInOutCubic, glideMs, samePageHash } from "@/lib/anchorScroll";

/**
 * Same-page links (href="#step-2") glide to their section instead of jumping: a short eased scroll that lands
 * where the browser would (the target's scroll-margin-top keeps it clear of sticky headers). The URL hash still
 * changes and hashchange still fires, so tabs that listen for it (artist page, share kit) keep working.
 * Scrolling by hand stops the glide, and reduced motion gets the usual instant jump. Mounted once in app/layout.
 */
export default function SmoothAnchors() {
  useEffect(() => {
    let frame = 0;
    const stop = () => cancelAnimationFrame(frame);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    function topOf(el: HTMLElement) {
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return Math.max(0, Math.min(max, el.getBoundingClientRect().top + window.scrollY - margin));
    }

    function glide(to: number, done: () => void) {
      const from = window.scrollY;
      const ms = glideMs(to - from);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        window.scrollTo(0, from + (to - from) * easeInOutCubic(t));
        if (t < 1) frame = requestAnimationFrame(step);
        else done();
      };
      stop();
      frame = requestAnimationFrame(step);
    }

    /** Move keyboard focus to the section, as a real anchor jump does, without scrolling again. */
    function focusOn(el: HTMLElement) {
      if (!el.matches("a[href], button, input, select, textarea, [tabindex]")) {
        el.setAttribute("tabindex", "-1");
        el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true });
      }
      el.focus({ preventScroll: true });
    }

    function onClick(e: MouseEvent) {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const hash = samePageHash({ href: a.getAttribute("href") || "", target: a.target, hasDownload: a.hasAttribute("download") }, location, e);
      if (!hash) return;
      const id = decodeURIComponent(hash.slice(1));
      const top = id === "" || id === "top";
      if (!top && !document.getElementById(id)) return; // nothing to glide to: let the browser handle it
      e.preventDefault();

      const oldURL = location.href;
      if (location.hash !== hash) {
        history.pushState(history.state, "", hash);
        window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL: location.href }));
      }
      // let anything listening (tabs) show the section before measuring where it is
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const el = top ? null : document.getElementById(id);
          if (!top && !el) return;
          const to = el ? topOf(el) : 0;
          if (reduce.matches) {
            window.scrollTo(0, to);
            if (el) focusOn(el);
            return;
          }
          glide(to, () => el && focusOn(el));
        }),
      );
    }

    document.addEventListener("click", onClick);
    // the reader takes over: stop gliding
    for (const ev of ["wheel", "touchstart", "keydown"] as const) window.addEventListener(ev, stop, { passive: true });
    return () => {
      stop();
      document.removeEventListener("click", onClick);
      for (const ev of ["wheel", "touchstart", "keydown"] as const) window.removeEventListener(ev, stop);
    };
  }, []);
  return null;
}
