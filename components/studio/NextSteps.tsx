"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
    { label: "Hang a code and make a sale", done: hasSold, href: "/studio/qr", act: "Print" },
    { label: "Add your next event", done: hasEvent, href: "/studio/events", act: "Add" },
    { label: "Share your page", done: shared, act: copied ? "Copied" : "Copy link", onClick: copyLink },
  ];
  // Only shown while missing, so it reads as a warning rather than a chore.
  // Before the first upload, uploading comes first; after that, getting paid does.
  if (!hasVenmo) steps.splice(hasArt ? 0 : 1, 0, { label: "Add Venmo so we can pay you", done: false, href: "/studio/page#venmo", act: "Add" });
  const done = steps.filter((s) => s.done).length;
  const todo = steps.filter((s) => !s.done);
  // All done: the card goes away (bar an optional suggestion), so the dashboard leads with the numbers.
  if (!todo.length && !suggestion) return null;

  return (
    <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="next-h">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="next-h" className="t-card">Next up</h2>
        {todo.length > 0 && (
          <div className="flex items-center gap-2.5">
            <span className="num text-[13px] font-semibold text-ink-2">{done} of {steps.length} done</span>
            <div className="relative h-2.5 w-24 overflow-hidden rounded-full bg-wall" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Steps done">
              {done > 0 && <span className="absolute inset-y-0 left-0 rounded-full bg-scan transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />}
            </div>
          </div>
        )}
      </div>
      {todo.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {todo.map((s, i) => {
            const cls = cn("inline-flex min-h-[40px] shrink-0 items-center text-[14px] font-bold", i === 0 ? "btn btn-sm" : "px-1 text-scan underline-offset-2 hover:underline");
            return (
              <li key={s.label} className={cn("box-inset flex items-center gap-2.5 px-3 py-2 text-[15px]", i > 0 && "bg-wall/40")}>
                <span aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-md border-[1.5px] border-ink-2" />
                <span className={cn("min-w-0 flex-1", i === 0 && "font-semibold")}>{s.label}</span>
                {s.href && <Link href={s.href} className={cls}>{s.act}</Link>}
                {s.onClick && <button type="button" onClick={s.onClick} className={cls}>{s.act}</button>}
              </li>
            );
          })}
        </ul>
      )}
      {suggestion && (
        <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-scan/50 bg-scan-soft px-3 py-2.5 text-[14px]">
          <i aria-hidden="true" className="paint-dab h-[18px] w-[18px] shrink-0" style={{ ["--dab" as string]: "var(--af-scan)" }} />
          <span className="min-w-0 flex-1">
            <b className="block">{suggestion.label}</b>
            {suggestion.note && <span className="block text-[13px] text-ink-2">{suggestion.note}</span>}
          </span>
          <Link href={suggestion.href} className="-my-3 inline-flex min-h-[44px] shrink-0 items-center px-1 text-[14px] font-bold text-scan underline-offset-2 hover:underline">{suggestion.act}</Link>
        </div>
      )}
    </section>
  );
}
