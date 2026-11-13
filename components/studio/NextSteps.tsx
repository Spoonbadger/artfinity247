"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { readLocalEvents } from "./events-store";
import { failed, saved } from "@/lib/feedback";

export const SHARED_KEY = "af-studio-shared";
/** Optional steps the artist chose "Skip for now" on (this browser). Skipped is not done. */
export const SKIPPED_KEY = "af-studio-skipped";

/** `post`: a plain form POST (e.g. straight to Stripe onboarding), so one click lands on the final screen. */
type Step = { key: string; label: string; done: boolean; href?: string; post?: string; act?: string; onClick?: () => void; optional?: boolean };
type ConnectStatus = "not_connected" | "pending" | "ready";
/** An extra, optional idea under the checklist (not counted in the progress), e.g. "Book a scan". */
export type Suggestion = { label: string; note?: string; href: string; act: string };
/** Something to fix now, on top of the list and not counted in the progress, e.g. "2 printed labels show an old price". */
export type Alert = { label: string; href: string; act: string };

/** Before the first upload the page has no header button, so the Upload step is the blue one. */
export default function NextSteps({ hasProfile, hasArt, hasSold, stripe = "ready", hasEvent: serverHasEvent = false, slug, suggestion, alerts = [] }: {
  hasProfile: boolean; hasArt: boolean; hasSold: boolean;
  /** The artist's Stripe Connect status (lib/stripeConnect.ts connectStatus). Payouts are Stripe-only. */
  stripe?: ConnectStatus;
  hasEvent?: boolean; slug: string; suggestion?: Suggestion | null; alerts?: Alert[];
}) {
  const [shared, setShared] = useState(false);
  const [hasEvent, setHasEvent] = useState(serverHasEvent);
  const [copied, setCopied] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);

  useEffect(() => {
    try { setShared(localStorage.getItem(SHARED_KEY) === "1"); } catch {}
    try { const v = JSON.parse(localStorage.getItem(SKIPPED_KEY) || "[]"); if (Array.isArray(v)) setSkipped(v.filter((x) => typeof x === "string")); } catch {}
    // Events not yet moved from this browser still count; the Events page uploads them.
    if (!serverHasEvent && readLocalEvents().length > 0) setHasEvent(true);
  }, [serverHasEvent]);

  function skip(key: string, on: boolean) {
    const next = on ? Array.from(new Set([...skipped, key])) : skipped.filter((k) => k !== key);
    setSkipped(next);
    try { localStorage.setItem(SKIPPED_KEY, JSON.stringify(next)); } catch {}
  }

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
    { key: "upload", label: "Upload your first piece", done: hasArt, href: "/studio/art/new", act: "Upload" },
    { key: "profile", label: "Add a photo and bio", done: hasProfile, href: "/studio/page", act: "Add" },
    { key: "sale", label: "Hang a code and make a sale", done: hasSold, href: "/studio/qr", act: "Print" },
    { key: "share", label: "Share your page", done: shared, act: copied ? "Copied" : "Copy link", onClick: copyLink },
    // Optional: shown as a small suggestion under the list, never as the first step, and it can be skipped.
    { key: "event", label: "Add your next event", done: hasEvent, href: "/studio/events", act: "Add", optional: true },
  ];
  // Only shown while missing, so it reads as a warning rather than a chore.
  // Before the first upload, uploading comes first; after that, getting paid does.
  // The button posts straight to the Connect action on Money (Stripe onboarding, or a test account in test mode).
  if (stripe !== "ready") {
    steps.splice(hasArt ? 0 : 1, 0, stripe === "pending"
      ? { key: "stripe", label: "Finish Stripe setup so we can pay you", done: false, post: "/api/studio/stripe/connect", act: "Finish" }
      : { key: "stripe", label: "Connect Stripe so we can pay you", done: false, post: "/api/studio/stripe/connect", act: "Connect" });
  }
  const done = steps.filter((s) => s.done).length;
  const open = steps.filter((s) => !s.done && !skipped.includes(s.key));
  const todo = open.filter((s) => !s.optional);
  const optional = open.filter((s) => s.optional);
  const later = steps.filter((s) => !s.done && skipped.includes(s.key));
  // All done: the card goes away (bar an optional suggestion), so the dashboard leads with the numbers.
  if (!todo.length && !optional.length && !later.length && !suggestion && !alerts.length) return null;
  const counting = todo.length + optional.length + later.length > 0;
  const smallLink = "inline-flex min-h-[40px] shrink-0 items-center px-1 text-[14px] font-bold text-scan underline-offset-2 hover:underline";
  const quietBtn = "inline-flex min-h-[40px] shrink-0 items-center px-1 text-[14px] font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline";

  return (
    <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="next-h">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="next-h" className="t-card">Next up</h2>
        {counting && (
          <div className="flex items-center gap-2.5">
            <span className="t-small num font-semibold">{done} of {steps.length} done</span>
            <div className="relative h-2.5 w-24 overflow-hidden rounded-full bg-wall" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Steps done">
              {done > 0 && <span className="absolute inset-y-0 left-0 rounded-full bg-scan transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />}
            </div>
          </div>
        )}
      </div>
      {alerts.length > 0 && (
        <ul className="grid gap-2">
          {alerts.map((a) => (
            <li key={a.label} className="flex items-center gap-2.5 rounded-xl border border-sticker bg-sticker/20 px-3 py-2 text-[15px]">
              <i aria-hidden="true" className="paint-dab h-[18px] w-[18px] shrink-0" style={{ ["--dab" as string]: "var(--af-sticker)" }} />
              <span className="min-w-0 flex-1 font-semibold">{a.label}</span>
              <Link href={a.href} className="btn btn-sm inline-flex min-h-[40px] shrink-0 items-center text-[14px] font-bold">{a.act}</Link>
            </li>
          ))}
        </ul>
      )}
      {todo.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {todo.map((s, i) => {
            const cls = cn("inline-flex min-h-[40px] shrink-0 items-center text-[14px] font-bold", i === 0 ? cn("btn btn-sm", !hasArt && "btn-blue") : "px-1 text-scan underline-offset-2 hover:underline");
            return (
              <li key={s.label} className={cn("box-inset flex items-center gap-2.5 px-3 py-2 text-[15px]", i > 0 && "bg-wall/40")}>
                <span aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-md border-[1.5px] border-ink-2" />
                <span className={cn("min-w-0 flex-1", i === 0 && "font-semibold")}>{s.label}</span>
                {s.href && <Link href={s.href} className={cls}>{s.act}</Link>}
                {s.post && <form method="post" action={s.post} className="contents"><button type="submit" className={cls}>{s.act}</button></form>}
                {s.onClick && <button type="button" onClick={s.onClick} className={cls}>{s.act}</button>}
              </li>
            );
          })}
        </ul>
      )}
      {optional.map((s) => (
        <div key={s.key} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-dashed border-edge-strong px-3 py-1.5 text-[14px]">
          <span className="min-w-0 flex-1">
            {s.label} <span className="t-small">(optional)</span>
          </span>
          <span className="flex items-center gap-1">
            {s.href && <Link href={s.href} className={smallLink}>{s.act}</Link>}
            <button type="button" onClick={() => skip(s.key, true)} className={quietBtn}>Skip for now</button>
          </span>
        </div>
      ))}
      {later.length > 0 && (
        <div className="t-small flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">To do later:</span>
          {later.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1">
              {s.href ? <Link href={s.href} className="inline-flex min-h-[40px] items-center text-ink underline underline-offset-2 hover:text-scan">{s.label}</Link> : s.label}
              <button type="button" onClick={() => skip(s.key, false)} className={quietBtn} aria-label={`Put "${s.label}" back on the list`}>Undo</button>
            </span>
          ))}
        </div>
      )}
      {suggestion && (
        <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-scan/50 bg-scan-soft px-3 py-2.5 text-[14px]">
          <i aria-hidden="true" className="paint-dab h-[18px] w-[18px] shrink-0" style={{ ["--dab" as string]: "var(--af-scan)" }} />
          <span className="min-w-0 flex-1">
            <b className="block">{suggestion.label}</b>
            {suggestion.note && <span className="t-small block">{suggestion.note}</span>}
          </span>
          <Link href={suggestion.href} className="-my-3 inline-flex min-h-[44px] shrink-0 items-center px-1 text-[14px] font-bold text-scan underline-offset-2 hover:underline">{suggestion.act}</Link>
        </div>
      )}
    </section>
  );
}
