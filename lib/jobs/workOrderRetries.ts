// Job "work-order-retries" (hourly): work orders that failed to reach the print lab are sent again with backoff,
// up to MAX_TRIES over about 6 hours, then an admin gets an alert. Server only.
//
// No schema change: each run's details list the orders it tried ({ tried: [{ orderId, ok, error }] }), so the attempt
// count and the last attempt time come from the JobRun log of the last 24 hours. The first retry waits for
// DELAYS_MIN[0] after the order was placed, then DELAYS_MIN[n] after the previous try (30 min, 2 h, 3 h: ~5.5 h).
// A successful retry resolves the order's work_order_failed alert. sendWorkOrder (lib/printer.ts) claims the order
// itself, so a retry racing an admin's "Retry" can't send twice.
import { prisma } from "@/lib/prisma";
import { alertKey, raiseAlert, resolveAlert } from "@/lib/alerts";
import { workOrderAlert } from "@/lib/alertBuilders";
import { activeProvider, sendWorkOrder } from "@/lib/printer";
import type { JobContext, JobResult } from "@/lib/jobs/run";

export const JOB = "work-order-retries";
export const MAX_TRIES = 3;
export const DELAYS_MIN = [30, 120, 180];
const STUCK_SENDING_MS = 5 * 60_000;
const WINDOW_MS = 24 * 3_600_000;

type Tried = { orderId: string; ok: boolean; error?: string };

/** orderId -> { tries, last } from this job's runs in the last 24 hours. */
async function history(now: Date) {
  const runs = await prisma.jobRun.findMany({
    where: { job: JOB, finishedAt: { not: null }, startedAt: { gte: new Date(now.getTime() - WINDOW_MS) } },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true, details: true },
  });
  const out = new Map<string, { tries: number; last: Date }>();
  for (const r of runs) {
    const tried = ((r.details as { tried?: Tried[] } | null)?.tried ?? []) as Tried[];
    for (const t of tried) {
      const cur = out.get(t.orderId) ?? { tries: 0, last: r.startedAt };
      out.set(t.orderId, { tries: cur.tries + 1, last: r.startedAt });
    }
  }
  return out;
}

export async function retryWorkOrders(ctx: JobContext): Promise<JobResult> {
  if (!activeProvider()) return { summary: "Skipped: PRINTER_PROVIDER is none (work orders are sent by hand)." };
  const now = ctx.now;
  const failed = await prisma.order.findMany({
    where: {
      OR: [{ paymentStatus: "paid" }, { kind: "reprint" }],
      shippingStatus: "pending",
      printerSentAt: null,
      sentToPrinter: false,
      AND: [{ OR: [{ printerRef: { startsWith: "failed" } }, { printerRef: { startsWith: "sending:" } }] }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, printerRef: true },
    take: 100,
  });
  const past = await history(now);
  const tried: Tried[] = [];
  let waiting = 0;
  const gaveUp: string[] = [];

  for (const o of failed) {
    let ref = o.printerRef || "";
    if (ref.startsWith("sending:")) {
      // A send that never finished (the function died): mark it failed so it can be claimed again.
      if (now.getTime() - (Number(ref.split(":")[1]) || 0) < STUCK_SENDING_MS) continue;
      const { count } = await prisma.order.updateMany({ where: { id: o.id, printerRef: ref }, data: { printerRef: "failed: The send didn't finish." } });
      if (!count) continue;
      ref = "failed: The send didn't finish.";
    }
    const h = past.get(o.id) ?? { tries: 0, last: o.createdAt };
    if (h.tries >= MAX_TRIES) {
      gaveUp.push(o.id);
      await raiseAlert({ ...workOrderAlert(o.id, `${ref.replace(/^failed:\s*/, "")} (retried ${MAX_TRIES} times)`), severity: "urgent" });
      continue;
    }
    if (now.getTime() < h.last.getTime() + DELAYS_MIN[h.tries] * 60_000) {
      waiting++;
      continue;
    }
    const r = await sendWorkOrder(o.id);
    if (r.status === "skipped") continue; // someone else sent it, or it isn't printable any more
    const ok = r.status === "sent";
    tried.push({ orderId: o.id, ok, ...(ok ? {} : { error: r.error }) });
    if (ok) await resolveAlert(alertKey.workOrderFailed(o.id));
    else if (h.tries + 1 >= MAX_TRIES) {
      gaveUp.push(o.id);
      await raiseAlert({ ...workOrderAlert(o.id, `${r.error || "send failed"} (retried ${MAX_TRIES} times)`), severity: "urgent" });
    }
  }
  const sent = tried.filter((t) => t.ok).length;
  const again = tried.length - sent;
  const parts = [`${failed.length} failed work ${failed.length === 1 ? "order" : "orders"}`, `${sent} sent`, `${again} failed again`, `${waiting} waiting for the next try`];
  if (gaveUp.length) parts.push(`${gaveUp.length} need a person (alerted)`);
  return { summary: failed.length ? parts.join(", ") : "No failed work orders.", details: { tried, waiting, gaveUp } };
}
