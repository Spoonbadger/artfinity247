"use client";
// Full-screen on phones, a large centred panel on desktop. Traps focus, closes on Escape, locks page scroll,
// and gives focus back to whatever opened it.
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function EditorDialog({ label, onClose, children, wide = true }: { label: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus]") || ref.current?.querySelector<HTMLElement>("button, [tabindex='0']");
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [tabindex='0'], a[href]")].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[1000] grid bg-ink/70 sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close.current(); }}>
      <div
        ref={ref} role="dialog" aria-modal="true" aria-label={label}
        className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-paper sm:h-[min(880px,94vh)] sm:rounded-2xl sm:border sm:border-edge sm:shadow-[0_24px_60px_rgba(21,22,27,.35)] ${wide ? "sm:max-w-[960px]" : "sm:max-w-[560px]"}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
