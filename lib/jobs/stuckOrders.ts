// Job "stuck-orders" (daily): orders that stalled somewhere between payment and the buyer's door. Server only.
//   not sent to the printer 24h after payment            -> order_stuck        (alertKey.orderStuck)
//   sent to the lab 5 business days ago, still no tracking -> order_no_tracking  (noTrackingKey)
//   shipped 10+ days ago, not delivered                  -> order_undelivered  (alertKey.orderUndelivered)
// Alerts for orders that moved on are resolved. Uses the same keys as lib/alertSweep.ts, so the two never raise the
// same thing twice, and reopen: false so an admin's manual "resolve" sticks.
import { prisma } from "@/lib/prisma";
import { alertKey, raiseAlert, resolveAlerts, type RaiseAlertInput } from "@/lib/alerts";
import { orderNumber } from "@/lib/printer";
import { addBusinessDays } from "@/lib/delivery";
import { TRACKING_SUBJECT } from "@/lib/tracking";
import { noTrackingKey, shippedDates } from "@/lib/shipping";
import type { JobContext, JobResult } from "@/lib/jobs/run";

export const JOB = "stuck-orders";
export const NOT_SENT_HOURS = 24;
export const NO_TRACKING_BUSINESS_DAYS = 5;
export const UNDELIVERED_DAYS = 10;
const DAY = 86_400_000;

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
const who = (o: { shippingName: string | null; kind: string; id: string }) => `${o.kind === "reprint" ? "Reprint" : "Order"} #${orderNumber(o.id)}${o.shippingName ? ` for ${o.shippingName}` : ""}`;

export async function sweepStuckOrders(ctx: JobContext): Promise<JobResult> {
  const now = ctx.now;
  const want: RaiseAlertInput[] = [];
  const printable = { OR: [{ paymentStatus: "paid" }, { kind: "reprint" }] };

  // 1) Paid, never sent to the printer.
  const notSent = await prisma.order.findMany({
    where: { ...printable, shippingStatus: "pending", sentToPrinter: false, printerSentAt: null, createdAt: { lt: new Date(now.getTime() - NOT_SENT_HOURS * 3_600_000) } },
    select: { id: true, createdAt: true, shippingName: true, kind: true },
    take: 500,
  });
  for (const o of notSent) {
    want.push({ kind: "order_stuck", key: alertKey.orderStuck(o.id), title: `${who(o)} not sent to the printer (paid ${day(o.createdAt)})`, link: `/admin/orders/${o.id}`, severity: "normal" });
  }

  // 2) At the lab, no tracking after 5 business days.
  const atLab = await prisma.order.findMany({
    where: { AND: [printable, { OR: [{ printerSentAt: { not: null } }, { sentToPrinter: true }] }], shippingStatus: "pending", trackingNumber: null },
    select: { id: true, createdAt: true, printerSentAt: true, shippingName: true, kind: true },
    take: 1000,
  });
  const withMsg = atLab.length
    ? new Set((await prisma.message.findMany({ where: { orderId: { in: atLab.map((o) => o.id) }, subject: { startsWith: TRACKING_SUBJECT } }, select: { orderId: true } })).map((m) => m.orderId))
    : new Set<string | null>();
  for (const o of atLab) {
    if (withMsg.has(o.id)) continue;
    const sentAt = o.printerSentAt ?? o.createdAt;
    if (addBusinessDays(sentAt, NO_TRACKING_BUSINESS_DAYS) > now) continue;
    want.push({ kind: "order_no_tracking", key: noTrackingKey(o.id), title: `${who(o)} went to the lab ${day(sentAt)} and has no tracking yet`, link: `/admin/orders/${o.id}`, severity: "normal" });
  }

  // 3) Shipped, not delivered after 10 days.
  const shipped = await prisma.order.findMany({ where: { shippingStatus: "shipped", deliveredAt: null }, select: { id: true, createdAt: true, shippingName: true, kind: true }, take: 2000 });
  const shippedAt = await shippedDates(shipped.map((o) => o.id));
  for (const o of shipped) {
    const at = shippedAt.get(o.id) ?? o.createdAt;
    if (at.getTime() >= now.getTime() - UNDELIVERED_DAYS * DAY) continue;
    want.push({ kind: "order_undelivered", key: alertKey.orderUndelivered(o.id), title: `${who(o)} shipped ${day(at)}, not delivered yet`, link: `/admin/orders/${o.id}`, severity: "low" });
  }

  let raised = 0;
  for (const w of want) {
    const r = await raiseAlert({ ...w, reopen: false });
    if (r?.created) raised++;
  }

  // Resolve the ones that moved on.
  const current = new Set(want.map((w) => w.key));
  const open = await prisma.adminAlert.findMany({ where: { resolvedAt: null, kind: { in: ["order_stuck", "order_no_tracking", "order_undelivered"] } }, select: { key: true } });
  const gone = open.map((a) => a.key).filter((k) => !current.has(k));
  const resolved = gone.length ? await resolveAlerts(gone) : 0;

  const counts = { notSent: notSent.length, noTracking: want.filter((w) => w.kind === "order_no_tracking").length, undelivered: want.filter((w) => w.kind === "order_undelivered").length };
  const summary = want.length
    ? `${counts.notSent} not sent to the printer, ${counts.noTracking} without tracking, ${counts.undelivered} not delivered (${raised} new alerts, ${resolved} resolved)`
    : `Nothing stuck${resolved ? ` (${resolved} alerts resolved)` : ""}.`;
  return { summary, details: { ...counts, raised, resolved, orders: want.map((w) => w.key) } };
}
