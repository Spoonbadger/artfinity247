"use client";

import { RefObject, useEffect } from "react";

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Keyboard-focusable elements inside `root`, in tab order, skipping hidden ones. */
export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0 && !el.closest("[inert],[aria-hidden='true']") && el.getClientRects().length > 0,
  );
}

/**
 * For modal sheets, menus and lightboxes: while `active`, Tab and Shift+Tab cycle inside `ref`,
 * focus moves in (unless something inside already has it), and on close focus goes back to
 * whatever had it before (pass restoreFocus: false when the caller does that itself).
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, { restoreFocus = true }: { restoreFocus?: boolean } = {}) {
  useEffect(() => {
    if (!active) return;
    const before = document.activeElement as HTMLElement | null;

    const moveIn = window.setTimeout(() => {
      const root = ref.current;
      if (!root || root.contains(document.activeElement)) return;
      const first = focusables(root)[0];
      if (first) first.focus();
      else {
        if (!root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");
        root.focus();
      }
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = ref.current;
      if (!root) return;
      const items = focusables(root);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const inside = !!current && root.contains(current);
      if (e.shiftKey && (!inside || current === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || current === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(moveIn);
      document.removeEventListener("keydown", onKey);
      if (restoreFocus && before && typeof before.focus === "function" && document.contains(before)) before.focus();
    };
  }, [active, ref, restoreFocus]);
}
