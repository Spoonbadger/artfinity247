"use client";

// "More" button for a page header: the secondary links that would otherwise crowd the one primary button.
// Closes on outside click, Escape, or picking an item.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type MoreItem = { label: string; href: string; /** An icon element, e.g. <QrCode />; sized and coloured here. Elements (not components) so server pages can pass them. */ icon?: ReactNode; /** opens in a new tab / downloads */ external?: boolean; hint?: string };

export function MoreMenu({ items, label = "More", className }: { items: MoreItem[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!items.length) return null;
  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button ref={btn} type="button" className="btn btn-ghost" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />{label}
      </button>
      {open && (
        <ul id={id} className="absolute right-0 top-[calc(100%+6px)] z-40 grid w-max min-w-[220px] max-w-[min(320px,calc(100vw-32px))] gap-0.5 rounded-xl border border-edge bg-white p-1.5 shadow-[0_14px_34px_-14px_rgba(21,22,27,.45)]">
          {items.map((it) => {
            const inner = (
              <>
                {it.icon && <span aria-hidden="true" className="mt-0.5 shrink-0 text-ink-2 [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>}
                <span className="min-w-0">
                  <span className="block">{it.label}</span>
                  {it.hint && <span className="block text-[13px] font-normal text-ink-2">{it.hint}</span>}
                </span>
              </>
            );
            const cls = "flex min-h-[40px] items-start gap-2.5 rounded-lg px-3 py-2 text-[14px] font-semibold text-ink no-underline hover:bg-wall";
            return (
              <li key={it.href}>
                {it.external ? (
                  <a href={it.href} target="_blank" rel="noopener" className={cls} onClick={() => setOpen(false)}>{inner}</a>
                ) : (
                  <Link href={it.href} className={cls} onClick={() => setOpen(false)}>{inner}</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
