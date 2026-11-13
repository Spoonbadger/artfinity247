// Every scheduled job: what it does, when it runs, and the function behind it. Server only.
// Each one has a cron route at /api/cron/<name> (CRON_SECRET, see lib/jobs/cron.ts) listed in vercel.json with the
// same schedule, and a "Run now" button on /admin/jobs. Schedules are UTC (Vercel cron); `when` says it in New York time.
import { isDigestHour, sendWeeklyDigests } from "@/lib/digest";
import { JOB as RETRY_JOB, retryWorkOrders } from "@/lib/jobs/workOrderRetries";
import { JOB as STUCK_JOB, sweepStuckOrders } from "@/lib/jobs/stuckOrders";
import { JOB as PRODIGI_JOB, runProdigiSync } from "@/lib/prodigiSync";
import { runBookkeeping, runPayouts } from "@/lib/jobs/monthly";
import type { JobContext, JobResult } from "@/lib/jobs/run";
import { sweepAdminAlerts } from "@/lib/alertSweep";
import { sendAdminDigest } from "@/lib/alerts";
import { SOCIAL_JOB, runSocialJob } from "@/lib/social/publish";

export type JobDef = {
  name: string;
  label: string;
  description: string;
  /** Vercel cron expression, UTC. Keep in step with vercel.json. Null: not scheduled on its own. */
  schedule: string | null;
  /** The schedule in words, New York time. */
  when: string;
  /** Cron calls outside this window are ignored without a JobRun ("Run now" skips the check). */
  gate?: { ok: (now: Date) => boolean; reason: string };
  /** Who may press "Run now" beyond owner/admin (money jobs need the money capability). */
  money?: boolean;
  /** Its cron route is written by hand elsewhere (admin alerts); listed here so it shows on /admin/jobs. */
  external?: boolean;
  run: (ctx: JobContext) => Promise<JobResult>;
};

export const JOBS: JobDef[] = [
  {
    name: RETRY_JOB,
    label: "Work order retries",
    description: "Sends failed work orders to the print lab again: one try a day, 3 tries, then an alert. Retry by hand from the order any time.",
    schedule: "7 14 * * *",
    when: "Daily at 9:07am New York (10:07am in summer)",
    run: retryWorkOrders,
  },
  {
    name: PRODIGI_JOB,
    label: "Prodigi order sync",
    description: "Checks every Prodigi order that hasn't shipped and applies its status: tracking marks it shipped and emails the buyer, cancellations and problems raise alerts. Catches any callback Prodigi missed. Skipped unless PRINTER_PROVIDER=prodigi.",
    schedule: "37 14 * * *",
    when: "Daily at 9:37am New York (10:37am in summer)",
    run: runProdigiSync,
  },
  {
    name: STUCK_JOB,
    label: "Stuck orders sweep",
    description: "Alerts for orders not sent to the printer after 24h, at the lab 5 business days with no tracking, or shipped 10+ days without delivery.",
    schedule: "23 12 * * *",
    when: "Daily at 7:23am New York (8:23am in summer)",
    run: sweepStuckOrders,
  },
  {
    name: "artist-digest",
    label: "Artist weekly digest",
    description: "Monday email to each artist with activity: scans, views, sales, earnings, best painting, reviews, followers and one tip.",
    schedule: "0 13 * * 1",
    when: "Mondays at 8am New York (9am in summer)",
    gate: { ok: isDigestHour, reason: "Not Monday morning in New York" },
    run: async (ctx) => {
      const r = await sendWeeklyDigests(ctx.now);
      const parts = [`${r.sent.length} sent`, `${r.skippedInactive} inactive skipped`, `${r.skippedOptOut} opted out`];
      if (r.alreadySent) parts.push(`${r.alreadySent} already had this week's`);
      if (r.failed.length) parts.push(`${r.failed.length} failed`);
      return { ok: r.failed.length === 0 || r.sent.length > 0, summary: `Week of ${r.week}: ${parts.join(", ")}`, details: r };
    },
  },
  {
    name: "payouts",
    label: "Monthly payouts",
    description: "Pays every connected artist's closed months by Stripe transfer (same as Pay all). Artists get a \"your payout is on its way\" email; failures and a low Stripe balance raise alerts. Artists without Stripe set up are held and get a reminder (one a week at most).",
    schedule: "17 15 5 * *",
    when: "5th of the month at 10:17am New York (11:17am in summer)",
    money: true,
    run: runPayouts,
  },
  {
    name: "bookkeeping",
    label: "Bookkeeping export",
    description: "Emails the owners last month's books: sales, tax, profit, artist payouts, reprint costs, refunds, plus one line per order (CSV).",
    schedule: "37 13 1 * *",
    when: "1st of the month at 8:37am New York (9:37am in summer), for the month before",
    money: true,
    run: runBookkeeping,
  },
  {
    name: "admin-digest",
    label: "Admin alerts digest",
    description: "Sweeps admin alerts (late payouts, stuck orders, failed jobs…) and emails each admin what's new since yesterday.",
    schedule: "7 12 * * *",
    when: "Daily at 7:07am New York (8:07am in summer)",
    external: true,
    run: async ({ now }) => {
      const sweep = await sweepAdminAlerts(now);
      const digest = await sendAdminDigest(now);
      const summary = digest.skipped
        ? `No digest: ${digest.skipped.toLowerCase()} (sweep: ${sweep.raised} new, ${sweep.resolved} resolved)`
        : `Digest of ${digest.alerts} alert${digest.alerts === 1 ? "" : "s"} to ${digest.sent.length} admin${digest.sent.length === 1 ? "" : "s"} (sweep: ${sweep.raised} new, ${sweep.resolved} resolved)`;
      return { summary, details: { sweep, digest } };
    },
  },
  {
    name: SOCIAL_JOB,
    label: "Instagram posts",
    description: "Drafts a post for each newly approved piece (if auto-queue is on), checks the Instagram token (refreshes it or warns 7 days ahead) and publishes approved posts whose time has come. Without Instagram keys it only drafts: posts are made by hand from /admin/social.",
    schedule: "5 17 * * *",
    when: "Daily at 12:05pm New York (1:05pm in summer)",
    run: runSocialJob,
  },
  {
    name: "alert-sweep",
    label: "Admin alerts sweep",
    description: "Raises time-based admin alerts and resolves ones whose problem is gone. Also runs inside the daily admin digest.",
    schedule: null,
    when: "Inside the admin digest; run it by hand any time",
    external: true,
    run: async ({ now }) => {
      const s = await sweepAdminAlerts(now);
      return { summary: `${s.current} open conditions, ${s.raised} new alerts, ${s.resolved} resolved`, details: s };
    },
  },
];

export const jobByName = (name: string) => JOBS.find((j) => j.name === name) ?? null;
