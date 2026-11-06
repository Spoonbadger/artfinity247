import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { roleCan } from "@/lib/adminRoles";
import { JOBS } from "@/lib/jobs/registry";
import { previousMonth } from "@/lib/bookkeeping";
import { dayTime, monthLabel } from "../_components/util";
import { PageHead, Pill, type Tone } from "../_components/ui";
import { DataTable, type Row } from "../_components/table";
import { EmptyState } from "@/components/studio/EmptyState";
import { adminRoleOrRedirect } from "../_components/gate";
import RunNowButton from "./RunNowButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jobs" };

const TZ = "America/New_York";
const STALE_MS = 15 * 60_000;

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });

function ago(d: Date, now: number) {
  const m = Math.round((now - d.getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

type Run = { id: string; job: string; startedAt: Date; finishedAt: Date | null; ok: boolean; summary: string; details: unknown };
type Status = "ok" | "failed" | "running" | "never";

function statusOf(r: Run | undefined, now: number): Status {
  if (!r) return "never";
  if (!r.finishedAt) return now - r.startedAt.getTime() < STALE_MS ? "running" : "failed";
  return r.ok ? "ok" : "failed";
}

const STATUS: Record<Status, { label: string; tone: Tone }> = {
  ok: { label: "OK", tone: "green" },
  failed: { label: "Failed", tone: "red" },
  running: { label: "Running", tone: "blue" },
  never: { label: "Never run", tone: "grey" },
};

function Badge({ s }: { s: Status }) {
  return <Pill tone={STATUS[s].tone}>{STATUS[s].label}</Pill>;
}

const set = (v: string | undefined) => !!v?.trim();

export default async function AdminJobsPage() {
  // Owner and admin only (support is sent back to /admin and doesn't see the menu link).
  const admin = await adminRoleOrRedirect("/admin/jobs", "admin");
  const now = Date.now();
  const names = JOBS.map((j) => j.name);
  const [latest, recent] = await Promise.all([
    Promise.all(names.map((job) => prisma.jobRun.findFirst({ where: { job }, orderBy: { startedAt: "desc" } }))),
    prisma.jobRun.findMany({ where: { job: { in: names } }, orderBy: { startedAt: "desc" }, take: 40 }),
  ]);
  const lastOf = new Map(latest.filter(Boolean).map((r) => [r!.job, r as Run]));
  const lastOkOf = new Map(
    (await Promise.all(names.map((job) => prisma.jobRun.findFirst({ where: { job, ok: true, finishedAt: { not: null } }, orderBy: { startedAt: "desc" }, select: { job: true, startedAt: true } }))))
      .filter(Boolean)
      .map((r) => [r!.job, r!.startedAt]),
  );
  const canMoney = roleCan(admin.adminRole, "money");
  const labelOf = new Map(JOBS.map((j) => [j.name, j.label]));

  // Bookkeeping download: the last 12 months, last month first.
  const months: string[] = [];
  for (let i = 0, m = previousMonth(new Date(now)); i < 12; i++) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
  }
  const thisMonth = new Date(now).toISOString().slice(0, 7);

  const setup = [
    { name: "CRON_SECRET", ok: set(process.env.CRON_SECRET), note: "Vercel Cron sends it. Without it no job runs on schedule (Run now still works)." },
    { name: "SHIPPO_API_KEY or EASYPOST_API_KEY", ok: set(process.env.SHIPPO_API_KEY) || set(process.env.EASYPOST_API_KEY), note: "Carrier tracking: orders move to shipped and delivered by themselves." },
    { name: "SHIPPING_WEBHOOK_SECRET", ok: set(process.env.SHIPPING_WEBHOOK_SECRET), note: "Protects /api/shipping/webhook (Shippo: add ?token=<secret> to the URL)." },
    { name: "PRINTER_EMAIL", ok: set(process.env.PRINTER_EMAIL), note: "Where work orders go. Their emails carry the lab's tracking link." },
    { name: "BOOKKEEPING_EMAIL", ok: set(process.env.BOOKKEEPING_EMAIL), note: "Optional. Who gets the monthly books; otherwise the owners on the team." },
  ];

  return (
    <div className="grid gap-5">
      <PageHead title="Jobs" sub={<>What runs by itself. Failures show up in <Link href="/admin/alerts" className="font-semibold text-scan">Alerts</Link>.</>} />

      <section aria-labelledby="jobs-h" className="af-panel grid gap-1 p-4 sm:p-5">
        <h2 id="jobs-h" className="sr-only">Scheduled jobs</h2>
        <ul className="grid divide-y divide-line">
          {JOBS.map((j) => {
            const last = lastOf.get(j.name);
            const s = statusOf(last, now);
            const lastOk = lastOkOf.get(j.name);
            const locked = j.money && !canMoney;
            return (
              <li key={j.name} className="grid gap-2 py-4 first:pt-1 last:pb-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-6">
                <div className="grid min-w-0 gap-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <b className="text-[16px]">{j.label}</b>
                    <Badge s={s} />
                  </p>
                  <p className="line-clamp-2 text-[14px] text-ink-2 lg:line-clamp-1" title={j.description}>{j.description}</p>
                  <p className="text-[13.5px]" title={j.schedule ? `${j.schedule} UTC` : undefined}>
                    <span className="font-semibold">Runs:</span> {j.when}
                  </p>
                  <p className="text-[13.5px]">
                    <span className="font-semibold">Last run:</span>{" "}
                    {last ? (
                      <>
                        {when(last.startedAt)} <span className="text-ink-2">({ago(last.startedAt, now)}{(last.details as { source?: string } | null)?.source === "manual" ? ", by hand" : ""})</span>
                        {" — "}
                        <span className={cn(s === "failed" && "font-semibold text-coral")}>{last.summary}</span>
                      </>
                    ) : (
                      <span className="text-ink-2">never</span>
                    )}
                  </p>
                  {s === "failed" && lastOk && <p className="text-[13px] text-ink-2">Last good run {when(lastOk)}.</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {j.name === "bookkeeping" && canMoney && (
                    <a href={`/api/admin/bookkeeping?month=${thisMonth}`} className="btn btn-ghost btn-sm min-h-[40px]">This month so far</a>
                  )}
                  <RunNowButton job={j.name} label={j.label} disabled={locked || s === "running"} reason={locked ? "Needs the money permission" : "Running"} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="books-h" className="af-panel grid content-start gap-3 p-4 sm:p-5">
          <h2 id="books-h" className="t-card">Bookkeeping export</h2>
          <p className="text-[14px] text-ink-2" title="Gross sales, tax, Artfinity profit, artist share and payouts, reprint costs, refunds, plus one line per order.">
            The month&apos;s books as a CSV. Emailed to the owners on the 1st.
          </p>
          {canMoney ? (
            <form action="/api/admin/bookkeeping" method="get" className="flex flex-wrap items-end gap-2">
              <label className="af-field min-w-[200px] py-1.5">
                <small>Month</small>
                <select name="month" defaultValue={months[0]} className="cursor-pointer py-1 !text-[16px] font-semibold md:py-0 md:!text-[15px]">
                  {[thisMonth, ...months].map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}{m === thisMonth ? " (so far)" : ""}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn btn-ghost btn-sm mb-1 min-h-[40px]">Download CSV</button>
            </form>
          ) : (
            <p className="text-[14px]">Needs the money permission.</p>
          )}
        </section>

        <details className="af-panel grid content-start gap-3 p-4 sm:p-5" open={setup.some((x) => !x.ok && x.name === "CRON_SECRET")}>
          <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[18px] font-bold">Setup {setup.every((x) => x.ok) ? <Pill tone="green">All set</Pill> : <Pill tone="amber">{setup.filter((x) => !x.ok).length} not set</Pill>}</summary>
          <ul className="mt-3 grid gap-2">
            {setup.map((x) => (
              <li key={x.name} className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3">
                <span role="img" aria-label={x.ok ? "Set" : "Not set"} className="mt-1.5 inline-block h-3 w-3 rounded-full" style={{ background: x.ok ? "var(--af-earned)" : "#e3b23c" }} />
                <span className="text-[14px]"><code className="text-[13px] font-bold">{x.name}</code> <span className="text-ink-2">{x.ok ? "set" : "not set"}. {x.note}</span></span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <section aria-labelledby="runs-h" className="grid gap-2">
        <h2 id="runs-h" className="t-card">Recent runs</h2>
        <DataTable
          id="job-runs"
          caption="Recent job runs"
          minWidth={640}
          defaultSort={{ key: "started", dir: "desc" }}
          search="Job or summary"
          statuses={[{ value: "ok", label: "OK" }, { value: "failed", label: "Failed" }, { value: "running", label: "Running" }]}
          dates
          columns={[
            { key: "started", label: "Started", firstDir: "desc" },
            { key: "job", label: "Job" },
            { key: "status", label: "Status" },
            { key: "took", label: "Took", align: "right" },
            { key: "summary", label: "Summary", sortable: false },
          ]}
          rows={recent.map((r): Row => {
            const st = statusOf(r, now);
            const ms = r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null;
            return {
              id: r.id,
              status: st,
              date: r.startedAt.toISOString(),
              search: `${labelOf.get(r.job) ?? r.job} ${r.summary}`,
              sort: { started: r.startedAt.toISOString(), job: labelOf.get(r.job) ?? r.job, status: STATUS[st].label, took: ms },
              cells: {
                started: <span className="num whitespace-nowrap">{dayTime(r.startedAt)}</span>,
                job: <span className="whitespace-nowrap font-semibold">{labelOf.get(r.job) ?? r.job}</span>,
                status: <Badge s={st} />,
                took: <span className="text-ink-2">{ms == null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}</span>,
                summary: <span className="block min-w-[240px]">{r.summary}</span>,
              },
            };
          })}
          empty={<EmptyState compact title="Nothing has run yet" body="Press Run now on a job above." />}
        />
      </section>
    </div>
  );
}
