import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminRoleOrRedirect } from "../_components/gate";
import { activeSnoozes } from "@/lib/alerts";
import { kindMeta } from "@/lib/alertKinds";
import { cn } from "@/lib/utils";
import AlertActions, { SweepButton } from "./AlertActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alerts" };

const TABS = [
  { id: "open", label: "Open" },
  { id: "snoozed", label: "Snoozed" },
  { id: "history", label: "Resolved" },
] as const;
const SEV: Record<string, string> = { urgent: "bg-coral text-white", normal: "bg-sticker text-ink", low: "bg-wall text-ink-2 ring-1 ring-line" };
const RANK: Record<string, number> = { urgent: 0, normal: 1, low: 2 };

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

export default async function AlertsPage({ searchParams }: { searchParams: { tab?: string; kind?: string } }) {
  await adminRoleOrRedirect("/admin/alerts");
  const tab = TABS.some((t) => t.id === searchParams.tab) ? searchParams.tab! : "open";
  const now = new Date();
  const [openRows, resolved, snoozes] = await Promise.all([
    prisma.adminAlert.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 500 }),
    tab === "history" ? prisma.adminAlert.findMany({ where: { resolvedAt: { not: null } }, orderBy: { resolvedAt: "desc" }, take: 150 }) : Promise.resolve([]),
    activeSnoozes(now),
  ]);
  const open = openRows.filter((a) => !snoozes.has(a.id)).sort((a, b) => (RANK[a.severity] ?? 1) - (RANK[b.severity] ?? 1) || b.createdAt.getTime() - a.createdAt.getTime());
  const snoozed = openRows.filter((a) => snoozes.has(a.id));
  const list = tab === "open" ? open : tab === "snoozed" ? snoozed : resolved;
  const kinds = Array.from(new Set(list.map((a) => a.kind)));
  const kind = searchParams.kind && kinds.includes(searchParams.kind) ? searchParams.kind : null;
  const rows = kind ? list.filter((a) => a.kind === kind) : list;
  const counts = { open: open.length, snoozed: snoozed.length, history: null as number | null };
  const href = (t: string, k?: string | null) => `/admin/alerts?tab=${t}${k ? `&kind=${encodeURIComponent(k)}` : ""}`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Needs attention</p>
          <h1 className="display text-[44px] sm:text-[56px]">Alerts</h1>
          <p className="max-w-[640px] text-[14px] text-ink-2">
            Urgent ones (DMCA notices, failed payouts) are emailed right away; the rest go in the 8am digest.
            Alerts resolve themselves when you handle the thing in its queue. <Link href="/admin/settings/notifications" className="font-semibold text-scan">Your alert emails →</Link>
          </p>
        </div>
        <SweepButton />
      </div>

      <nav aria-label="Alert lists" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link key={t.id} href={href(t.id)} aria-current={tab === t.id ? "page" : undefined}
            className={cn("flex min-h-[38px] items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold no-underline", tab === t.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>
            {t.label}{counts[t.id] != null && <span className="num opacity-70">{counts[t.id]}</span>}
          </Link>
        ))}
      </nav>

      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-1.5 text-[13px]">
          <Link href={href(tab)} className={cn("rounded-full px-2.5 py-1 font-semibold no-underline", !kind ? "bg-white text-ink ring-1 ring-ink" : "text-ink-2 hover:text-ink")}>All</Link>
          {kinds.map((k) => (
            <Link key={k} href={href(tab, k)} className={cn("rounded-full px-2.5 py-1 font-semibold no-underline", kind === k ? "bg-white text-ink ring-1 ring-ink" : "text-ink-2 hover:text-ink")}>
              {kindMeta(k).label} <span className="num">{list.filter((a) => a.kind === k).length}</span>
            </Link>
          ))}
        </div>
      )}

      <section className="af-card p-2 sm:p-3">
        {rows.length === 0 ? (
          <p className="flex items-center gap-2 px-2 py-8 text-[15px]">
            <span className="paint-dab h-5 w-5" style={{ ["--dab" as string]: "var(--af-earned)" }} />
            {tab === "open" ? "Nothing needs you right now." : tab === "snoozed" ? "Nothing snoozed." : "No resolved alerts yet."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((a) => {
              const until = snoozes.get(a.id);
              const state = a.resolvedAt ? "resolved" : until ? "snoozed" : "open";
              return (
                <li key={a.id} className="grid gap-2 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                      <span className={cn("rounded-full px-2 py-px font-bold uppercase tracking-[0.04em]", SEV[a.severity] ?? SEV.normal)}>{a.severity}</span>
                      <span className="font-semibold text-ink-2">{kindMeta(a.kind).label}</span>
                    </div>
                    <Link href={a.link || kindMeta(a.kind).queue} className="mt-0.5 block break-words text-[15px] font-semibold text-ink no-underline hover:text-scan">{a.title}</Link>
                    <p className="text-[12.5px] text-ink-2">
                      {when(a.createdAt)}
                      {a.emailedAt ? ` · emailed ${when(a.emailedAt)}` : ""}
                      {a.digestedAt ? ` · in the ${a.digestedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })} digest` : !a.resolvedAt && !a.emailedAt ? " · next digest" : ""}
                      {until ? ` · snoozed until ${when(until)}` : ""}
                      {a.resolvedAt ? ` · resolved ${when(a.resolvedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Link href={a.link || kindMeta(a.kind).queue} className="btn btn-ghost btn-sm">Open</Link>
                    <AlertActions id={a.id} state={state} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {tab === "history" && <p className="text-[12.5px] text-ink-2">The latest 150 resolved alerts. Who resolved or snoozed what is in <Link href="/admin/activity" className="font-semibold text-scan">Activity</Link>.</p>}
    </div>
  );
}
