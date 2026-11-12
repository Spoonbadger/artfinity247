// Monthly jobs: the payout run (5th) and the bookkeeping export (1st). Server only.
import { prisma } from "@/lib/prisma";
import { emailEnabled, resend } from "@/lib/resend";
import { emailHtml } from "@/lib/artistEmails";
import { alertKey, raiseAlert, resolveAlert, resolveAlerts } from "@/lib/alerts";
import { payoutFailedAlert } from "@/lib/alertBuilders";
import { PAYOUT_DAY_OF_MONTH, monthLabel } from "@/lib/balance";
import { INSUFFICIENT_FUNDS, lastClosedMonth, payReadyPayouts, remindWaitingArtists } from "@/lib/payouts";
import { connectMode } from "@/lib/stripeConnect";
import { SUMMARY_ROWS, booksCsv, buildBooks, monthBounds, previousMonth } from "@/lib/bookkeeping";
import type { JobContext, JobResult } from "@/lib/jobs/run";

const FROM = "Artfinity <notifications@theartfinity.com>";
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

// ---------- Payouts ----------

/** Key for "the Stripe balance couldn't cover this month's transfers" (one per month). */
export const insufficientKey = (month: string) => `payout_insufficient:${month}`;

/**
 * Same as "Pay all" on /admin/payouts, from the 5th on, only with real Stripe keys (never simulates). Each paid month
 * already emails the artist "Your Artfinity payout for <month> is on its way" (lib/payouts.ts). Right after the run,
 * every artist whose money is held (Stripe not set up) gets a "Connect Stripe" reminder, unless one went out in the
 * last 7 days. Failed transfers and a too-low Stripe balance raise alerts; paid months resolve earlier failure alerts.
 */
export async function runPayouts(ctx: JobContext): Promise<JobResult> {
  if (connectMode() !== "live") return { summary: "Skipped: STRIPE_SECRET_KEY is not set (payouts never run simulated from here; use Pay all on /admin/payouts)." };
  if (ctx.now.getUTCDate() < PAYOUT_DAY_OF_MONTH) return { summary: `Skipped: payouts go out from the ${PAYOUT_DAY_OF_MONTH}th.` };
  const month = lastClosedMonth(ctx.now);
  const r = await payReadyPayouts({ now: ctx.now, source: "cron" });

  for (const p of r.paid) await resolveAlert(alertKey.payoutFailed(p.artistId, p.month));
  for (const f of r.failed) await raiseAlert(payoutFailedAlert(f.artistId, f.artistName, f.month, f.reason));
  if (r.insufficientFunds) {
    const short = r.failed.filter((f) => f.reason === INSUFFICIENT_FUNDS).reduce((n, f) => n + f.amountCents, 0);
    await raiseAlert({ kind: "payout_insufficient_funds", key: insufficientKey(month), title: `Stripe balance too low: ${usd(short)} of payouts for ${monthLabel(month)} couldn't be sent. Add funds, then Pay all.`, link: "/admin/payouts", severity: "urgent" });
  } else {
    await resolveAlerts({ prefix: "payout_insufficient:" });
  }
  // Held artists: the monthly "Connect Stripe to get paid" email (rate-limited per artist, lib/payoutPlan.ts).
  const reminders = r.held.length ? await remindWaitingArtists(ctx.now, r.held) : { sent: 0, skipped: 0, failed: 0 };
  const paidCents = r.paid.reduce((n, p) => n + p.amountCents, 0);
  const heldCents = r.held.reduce((n, h) => n + h.totalCents, 0);
  const summary = [
    `${r.paid.length} paid (${usd(paidCents)})`,
    r.failed.length ? `${r.failed.length} failed (alerted)` : null,
    r.insufficientFunds ? "Stripe balance too low" : null,
    r.held.length ? `${r.held.length} held until they connect Stripe (${usd(heldCents)}; ${reminders.sent} reminded)` : null,
  ].filter(Boolean).join(", ");
  return {
    summary: `${monthLabel(month)}: ${summary}`,
    details: {
      month,
      paid: r.paid.map((p) => ({ artistId: p.artistId, month: p.month, cents: p.amountCents, transferId: p.transferId })),
      failed: r.failed.map((f) => ({ artistId: f.artistId, month: f.month, reason: f.reason })),
      held: r.held.map((h) => ({ artistId: h.artistId, cents: h.totalCents, stripe: h.stripeStatus })),
      reminders,
      insufficientFunds: r.insufficientFunds,
    },
  };
}

// ---------- Bookkeeping ----------

/** Who gets the books: BOOKKEEPING_EMAIL (comma-separated) if set, else the owners on the admin team, else every admin. */
export async function bookkeepingRecipients(): Promise<string[]> {
  const env = (process.env.BOOKKEEPING_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (env.length) return env;
  const admins = await prisma.artist.findMany({ where: { role: "ADMIN", closedAt: null, suspendedAt: null }, select: { email: true, adminRole: true } });
  const owners = admins.filter((a) => a.adminRole === "owner");
  return (owners.length ? owners : admins).map((a) => a.email);
}

/** Emails last month's books (CSV attached) to the owners. A cron run skips a month that already went out. */
export async function runBookkeeping(ctx: JobContext): Promise<JobResult> {
  const month = previousMonth(ctx.now);
  if (ctx.source === "cron") {
    const done = await prisma.jobRun.findFirst({ where: { job: "bookkeeping", ok: true, details: { path: ["month"], equals: month } }, select: { id: true } });
    if (done) return { summary: `Skipped: the books for ${monthLabel(month)} already went out.` };
  }
  const books = await buildBooks(monthBounds(month)!, month);
  const csv = booksCsv(books);
  const to = await bookkeepingRecipients();
  if (!to.length) return { ok: false, summary: "No one to send the books to (set BOOKKEEPING_EMAIL or add an owner)." };
  const t = books.totals;
  const text = [
    `Artfinity books for ${monthLabel(month)}. The CSV (summary and one line per order) is attached.`,
    SUMMARY_ROWS.map((r) => `${r.label}: ${r.money ? usd(t[r.key]) : t[r.key]}`).join("\n"),
    `Download it again any time: ${APP_URL()}/api/admin/bookkeeping?month=${month}\nAll jobs: ${APP_URL()}/admin/jobs`,
  ].join("\n\n");
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Artfinity books: ${monthLabel(month)} (${usd(t.grossSalesCents)} sales, ${usd(t.profitCents)} profit)`,
    text,
    html: emailHtml(text, "Artfinity bookkeeping export"),
    attachments: [{ filename: `artfinity-books-${month}.csv`, content: Buffer.from(csv, "utf8") }],
  });
  if (error) throw new Error(typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "Email failed");
  if (!emailEnabled) console.log(`[email:dev] bookkeeping ${month}\n${text}\n[/email:dev]`);
  return {
    summary: `${monthLabel(month)}: ${usd(t.grossSalesCents)} sales, ${usd(t.taxCents)} tax, ${usd(t.profitCents)} profit, ${books.lines.length} lines → ${to.join(", ")}`,
    details: { month, to, totals: t, lines: books.lines.length },
  };
}
