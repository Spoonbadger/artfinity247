"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";
import { readLocalEvents } from "./events-store";
import { failed, saved } from "@/lib/feedback";

export const SHARED_KEY = "af-studio-shared";

type Step = { label: string; done: boolean; href?: string; act?: string; onClick?: () => void };
/** An extra, optional idea under the checklist (not counted in the progress), e.g. "Book a scan". */
export type Suggestion = { label: string; note?: string; href: string; act: string };

export default function NextSteps({ hasProfile, hasArt, hasSold, hasVenmo = true, hasEvent: serverHasEvent = false, slug, suggestion }: { hasProfile: boolean; hasArt: boolean; hasSold: boolean; hasVenmo?: boolean; hasEvent?: boolean; slug: string; suggestion?: Suggestion | null }) {
  const [shared, setShared] = useState(false);
  const [hasEvent, setHasEvent] = useState(serverHasEvent);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { setShared(localStorage.getItem(SHARED_KEY) === "1"); } catch {}
    // Events not yet moved from this browser still count; the Events page uploads them.
    if (!serverHasEvent && readLocalEvents().length > 0) setHasEvent(true);
  }, [serverHasEvent]);

  async function copyLink() {
    const url = `https://theartfinity.com/@${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      saved("Link copied", { description: url, next: { label: "Share kit", href: "/studio/share" } });
    } catch {
      failed("Couldn't copy the link", { description: url, fix: { label: "Open Share kit", href: "/studio/share" } });
      return;
    }
    try { localStorage.setItem(SHARED_KEY, "1"); } catch {}
    setShared(true);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const steps: Step[] = [
    { label: "Upload your first piece", done: hasArt, href: "/studio/art/new", act: "Upload" },
    { label: "Add a photo and bio", done: hasProfile, href: "/studio/page", act: "Add" },
    { label: "Hang a code, make a sale", done: hasSold, href: "/studio/qr", act: "Print" },
    { label: "Add your next event", done: hasEvent, href: "/studio/events", act: "Add" },
    { label: "Share your page", done: shared, act: copied ? "Copied" : "Copy link", onClick: copyLink },
  ];
  // Only shown while missing, so it reads as a warning rather than a chore.
  if (!hasVenmo) steps.unshift({ label: "Add your Venmo to get paid", done: false, href: "/studio/page#venmo", act: "Add" });
  const done = steps.filter((s) => s.done).length;

  return (
    <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="next-h">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="next-h" className="text-[20px] font-bold">Next steps</h2>
        <span className="num text-[12.5px] text-ink-2">{done} of {steps.length}</span>
      </div>
      <div className="relative h-6 overflow-hidden rounded-full bg-wall" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Steps done">
        {done > 0 && <BrushStroke className="absolute -left-1 top-px h-[calc(100%-2px)] transition-[width]" color="var(--af-scan)" style={{ width: `${(done / steps.length) * 100 + 2}%` }} />}
      </div>
      <ul className="grid gap-2.5 text-[14.5px]">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={cn("h-[18px] w-[18px] shrink-0 rounded-md border-2", s.done ? "border-scan bg-scan shadow-[inset_0_0_0_3px_#fff]" : "border-ink")}
            />
            <span className={cn("min-w-0 flex-1", s.done && "text-ink-2 line-through")}>
              {s.label}
              <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
            </span>
            {!s.done && s.href && (
              <Link href={s.href} className="-my-3 inline-flex min-h-[44px] items-center px-1 text-[14px] font-bold text-scan underline-offset-2 hover:underline">{s.act}</Link>
            )}
            {s.onClick && (
              <button type="button" onClick={s.onClick} className="-my-3 inline-flex min-h-[44px] items-center px-1 text-[14px] font-bold text-scan underline-offset-2 hover:underline">{s.act}</button>
            )}
          </li>
        ))}
      </ul>
      {suggestion && (
        <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-dashed border-scan/50 bg-scan-soft px-3 py-2.5 text-[14px]">
          <i aria-hidden="true" className="paint-dab h-[18px] w-[18px] shrink-0" style={{ ["--dab" as string]: "var(--af-scan)" }} />
          <span className="min-w-0 flex-1">
            <b className="block">{suggestion.label}</b>
            {suggestion.note && <span className="block text-[12.5px] text-ink-2">{suggestion.note}</span>}
          </span>
          <Link href={suggestion.href} className="-my-3 inline-flex min-h-[44px] shrink-0 items-center px-1 text-[14px] font-bold text-scan underline-offset-2 hover:underline">{suggestion.act}</Link>
        </div>
      )}
    </section>
  );
}
