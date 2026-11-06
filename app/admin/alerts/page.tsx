import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminRoleOrRedirect } from "../_components/gate";
import { activeSnoozes } from "@/lib/alerts";
import { kindMeta } from "@/lib/alertKinds";
import { cn } from "@/lib/utils";
import { SweepButton } from "./AlertActions";
import AlertsTable, { type AlertRow } from "./AlertsTable";
import { PageHead } from "../_components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alerts" };

const TABS = [
  { id: "open", label: "Open" },
  { id: "snoozed", label: "Snoozed" },
  { id: "history", label: "Resolved" },
] as const;
const RANK: Record<string, number> = { urgent: 0, normal: 1, low: 2 };

export default async function AlertsPage({ searchParams }: { searchParams: { tab?: string } }) {
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
  const counts = { open: open.length, snoozed: snoozed.length, history: null as number | null };
  const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  const rows: AlertRow[] = list.map((a) => {
    const until = snoozes.get(a.id);
    const meta = [
      a.emailedAt ? "emailed" : a.digestedAt ? `in ${day(a.digestedAt)} digest` : !a.resolvedAt ? "next digest" : "",
      until ? `snoozed to ${day(until)}` : "",
      a.resolvedAt ? `resolved ${day(a.resolvedAt)}` : "",
    ].filter(Boolean).join(" · ");
    return { id: a.id, severity: a.severity, kind: a.kind, kindLabel: kindMeta(a.kind).label, title: a.title, href: a.link || kindMeta(a.kind).queue, at: a.createdAt.toISOString(), meta, state: a.resolvedAt ? "resolved" : until ? "snoozed" : "open" };
  });

  return (
    <div className="grid gap-5">
      <PageHead
        title="Alerts"
        sub={<>Urgent ones are emailed now, the rest in the 8am digest. <Link href="/admin/settings/notifications" className="font-semibold text-scan">Emails</Link></>}
        action={<SweepButton />}
      />

      <nav aria-label="Alert lists" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/alerts?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined}
            className={cn("flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold no-underline", tab === t.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>
            {t.label}{counts[t.id] != null && <span className="num opacity-70">{counts[t.id]}</span>}
          </Link>
        ))}
      </nav>

      <AlertsTable key={tab} rows={rows} tab={tab} />
      {tab === "history" && <p className="text-[13px] text-ink-2">Latest 150. Who did what is in <Link href="/admin/activity" className="font-semibold text-scan">Activity</Link>.</p>}
    </div>
  );
}
