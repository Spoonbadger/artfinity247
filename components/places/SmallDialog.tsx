"use client";
// A compact dialog: a sheet from the bottom on phones, a small centred panel on wider screens. Traps focus, closes on
// Escape or a click outside, and gives focus back to whatever opened it.
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function SmallDialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus]") || ref.current?.querySelector<HTMLElement>("input, select, button");
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]")).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); opener?.focus?.({ preventScroll: true }); };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-end bg-ink/60 sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close.current(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-edge bg-white p-5 shadow-[0_24px_60px_rgba(21,22,27,.35)] sm:max-w-[520px] sm:rounded-2xl sm:p-6">
        {children}
      </div>
    </div>,
    document.body,
  );
}
