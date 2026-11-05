"use client";
// "You have unsaved changes" guard for long forms. While `dirty` is true:
//  - closing the tab, reloading or typing a new URL shows the browser's own "Leave site?" prompt;
//  - clicking a link inside the app asks first (App Router has no route-change event, so links are caught on click).
// Links that open a new tab, downloads, hash links on the same page and links marked data-skip-unsaved are let through.
import { useEffect, useRef } from "react";

export const UNSAVED_MESSAGE = "You have changes that aren't saved. Leave without saving?";

export function useUnsavedChanges(dirty: boolean, message = UNSAVED_MESSAGE) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = message; // older browsers want a value; modern ones show their own words
      return message;
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.closest("[data-skip-unsaved]")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      const here = window.location;
      if (url.origin === here.origin && url.pathname === here.pathname && url.search === here.search) return; // same page (hash links)
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
