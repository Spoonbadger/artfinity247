// Building blocks for /admin/milestones. Server-safe (no hooks), so the client calculator can use them too.
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Pill, type Tone } from "../_components/ui";

export type Status = "done" | "going" | "todo" | "needs";
export const STATUS: Record<Status, { label: string; tone: Tone }> = {
  done: { label: "Done", tone: "green" },
  going: { label: "On the way", tone: "blue" },
  todo: { label: "Not started", tone: "grey" },
  needs: { label: "Needs your numbers", tone: "amber" },
};

export function StatusPill({ s }: { s: Status }) {
  return <Pill tone={STATUS[s].tone}>{STATUS[s].label}</Pill>;
}

/** One milestone: title and status, the numbers, then the one next step. */
export function Card({ n, title, status, next, link, children, className, id }: { n: number; title: string; status: Status; next?: ReactNode; link?: { href: string; label: string }; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("box grid min-w-0 content-start gap-4 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h2 id={`${id}-h`} className="t-card min-w-0"><span className="num text-ink-2">{n}.</span> {title}</h2>
        <StatusPill s={status} />
      </div>
      {children}
      {(next || link) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
          {next && <p className="min-w-0 flex-1 text-[15px]"><b>Next:</b> {next}</p>}
          {link && <Link href={link.href} className="btn btn-ghost btn-sm min-h-[40px] shrink-0">{link.label}</Link>}
        </div>
      )}
    </section>
  );
}

/** A label over a number. */
export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "earned" | "loss" }) {
  return (
    <div className="box-inset min-w-0 p-3">
      <dt className="t-small">{label}</dt>
      <dd className={cn("num break-words text-[20px] font-bold leading-tight", tone === "earned" && "text-earned", tone === "loss" && "text-coral")}>{value}</dd>
      {note && <dd className="t-small mt-0.5 break-words">{note}</dd>}
    </div>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-2 sm:gap-3">{children}</dl>;
}

/** Progress toward a target, with the two numbers under it. */
export function Bar({ value, max, label, left, right, done }: { value: number; max: number; label: string; left: ReactNode; right: ReactNode; done?: boolean }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="h-3 overflow-hidden rounded-full bg-wall ring-1 ring-line" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={Math.max(max, 0)} aria-valuenow={Math.min(Math.max(value, 0), Math.max(max, 0))}>
        <div className={cn("h-full rounded-full", done ? "bg-earned" : "bg-scan")} style={{ width: `${w}%` }} />
      </div>
      <div className="num flex flex-wrap justify-between gap-x-3 text-[13.5px] text-ink-2">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

/** "Set" / "Missing" for an env var. Presence only, never the value. */
export function EnvRow({ name, on, what }: { name: string; on: boolean; what: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
      <span className="min-w-0 text-[14.5px]"><b>{what}</b> <code className="break-all text-[13px] text-ink-2">{name}</code></span>
      <Pill tone={on ? "green" : "amber"}>{on ? "Set" : "Missing"}</Pill>
    </li>
  );
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
