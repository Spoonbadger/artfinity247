import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { roleCan } from "@/lib/adminRoles";
import { JOBS } from "@/lib/jobs/registry";
import { previousMonth } from "@/lib/bookkeeping";
import { monthLabel } from "../_components/util";
import { adminRoleOrRedirect } from "../_components/gate";
import RunNowButton from "./RunNowButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jobs" };

const TZ = "America/New_York";
const STALE_MS = 15 * 60_000;

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });

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

const STATUS: Record<Status, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-earned/15 text-earned" },
  failed: { label: "Failed", cls: "bg-coral/15 text-coral" },
  running: { label: "Running", cls: "bg-scan/15 text-scan" },
  never: { label: "Never run", cls: "bg-line text-ink-2" },
};

function Badge({ s }: { s: Status }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", STATUS[s].cls)}>{STATUS[s].label}</span>;
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
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">Automation</p>
        <h1 className="display text-[44px] sm:text-[56px]">Jobs</h1>
        <p className="max-w-[70ch] text-[15px] text-ink-2">
          What runs by itself, when it last ran and what it did. Times are New York time. A failed run raises an alert on{" "}
          <Link href="/admin/alerts" className="text-scan">Alerts</Link>.
        </p>
      </div>

      <section aria-labelledby="jobs-h" className="af-card grid gap-1 p-4 sm:p-5">
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
                    <b className="text-[16.5px]">{j.label}</b>
                    <Badge s={s} />
                    <code className="text-[12px] text-ink-2">{j.name}</code>
                  </p>
                  <p className="text-[14px] text-ink-2">{j.description}</p>
                  <p className="text-[13.5px]">
                    <span className="font-semibold">Schedule:</span> {j.when}
                    {j.schedule && <span className="text-ink-2"> · <code className="text-[12px]">{j.schedule}</code> UTC</span>}
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
                  {s === "failed" && lastOk && <p className="text-[12.5px] text-ink-2">Last good run {when(lastOk)}.</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {j.name === "bookkeeping" && canMoney && (
                    <a href={`/api/admin/bookkeeping?month=${thisMonth}`} className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">This month so far</a>
                  )}
                  <RunNowButton job={j.name} label={j.label} disabled={locked || s === "running"} reason={locked ? "Needs the money permission" : "Running"} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="books-h" className="af-card grid content-start gap-3 p-4 sm:p-5">
          <h2 id="books-h" className="text-[20px] font-bold">Bookkeeping export</h2>
          <p className="text-[14px] text-ink-2">
            Gross sales, tax collected, Artfinity profit, artist share and payouts, reprint costs and refunds, plus one line per order. Same math as the
            dashboard. Emailed to the owners on the 1st.
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
              <button type="submit" className="btn btn-blue btn-sm mb-1 min-h-[44px] md:min-h-0">Download CSV</button>
            </form>
          ) : (
            <p className="text-[14px]">Needs the money permission.</p>
          )}
        </section>

        <section aria-labelledby="setup-h" className="af-card grid content-start gap-3 p-4 sm:p-5">
          <h2 id="setup-h" className="text-[20px] font-bold">Setup</h2>
          <ul className="grid gap-2">
            {setup.map((x) => (
              <li key={x.name} className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3">
                <span aria-label={x.ok ? "Set" : "Not set"} className="mt-1.5 inline-block h-3 w-3 rounded-full" style={{ background: x.ok ? "var(--af-earned)" : "#e3b23c" }} />
                <span className="text-[14px]"><code className="text-[12.5px] font-bold">{x.name}</code> <span className="text-ink-2">{x.ok ? "set" : "not set"}. {x.note}</span></span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="runs-h" className="af-card grid gap-3 p-4 sm:p-5">
        <h2 id="runs-h" className="text-[20px] font-bold">Recent runs</h2>
        {recent.length === 0 ? (
          <p className="text-[14px] text-ink-2">Nothing has run yet.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] uppercase tracking-[0.06em] text-ink-2">
                  <th className="py-2 pr-3 font-bold">Started</th>
                  <th className="py-2 pr-3 font-bold">Job</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 pr-3 font-bold">Took</th>
                  <th className="py-2 font-bold">Summary</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const s = statusOf(r, now);
                  const ms = r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : null;
                  return (
                    <tr key={r.id} className="border-b border-line align-top last:border-b-0">
                      <td className="num whitespace-nowrap py-2 pr-3">{when(r.startedAt)}</td>
                      <td className="whitespace-nowrap py-2 pr-3 font-semibold">{labelOf.get(r.job) ?? r.job}</td>
                      <td className="py-2 pr-3"><Badge s={s} /></td>
                      <td className="num whitespace-nowrap py-2 pr-3 text-ink-2">{ms == null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}</td>
                      <td className="min-w-[260px] py-2">{r.summary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
