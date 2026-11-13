"use client";
// "More ▾": tucks secondary actions away so each page has one main button.
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function MoreMenu({ label = "More", children, align = "right", className }: { label?: ReactNode; children: ReactNode; align?: "left" | "right"; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", close); };
  }, []);
  return (
    <details ref={ref} className={cn("group relative", className)}>
      <summary className="btn btn-ghost btn-sm list-none [&::-webkit-details-marker]:hidden">
        {label}
        <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 transition group-open:rotate-180"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </summary>
      <div className={cn("absolute z-30 mt-1.5 grid min-w-[220px] gap-1 rounded-xl border border-edge bg-white p-2 shadow-lg [&_.btn]:w-full [&_.btn]:justify-start [&_.btn]:border-transparent", align === "right" ? "right-0" : "left-0")}>
        {children}
      </div>
    </details>
  );
}
