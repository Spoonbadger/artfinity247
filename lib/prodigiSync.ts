// Applying Prodigi's order status to our orders: used by the callback (app/api/webhook/prodigi) and the daily
// "prodigi-sync" job, so a missed callback never leaves an order stuck. Server only.
//
// Both always read the order fresh from Prodigi (GET /v4.0/Orders/{id}) and never trust a callback body, then go
// through planSync (lib/prodigi.ts), which never moves an order backwards. Every write is claimed or compared first:
//   printing / in production -> recorded on the order's audit log (stage, Prodigi's last update)
//   shipment with tracking   -> lib/shipping markShipped: the same path as the lab's tracking form. Saves the tracking,
//                               registers it with Shippo/EasyPost, pending -> shipped once, buyer gets the shipped email
//   Complete                 -> recorded (all parcels shipped)
//   Cancelled                -> urgent "print_lab_problem" alert, recorded
//   issues / failed step     -> "print_lab_problem" alert, resolved when Prodigi clears it
//
// Delivery: Prodigi doesn't report it. The tracking saved above is registered with the carrier tracking provider
// (SHIPPO_API_KEY or EASYPOST_API_KEY), whose webhook marks the order delivered, emails the buyer and asks for a
// review (lib/shipping applyTrackingEvent). Without one, the daily stuck-orders job flags orders shipped 10+ days ago
// for an admin to check (order_undelivered). Nothing here marks an order delivered.
//
// Where it's kept (no new columns): printerRef "prodigi:<ord_id>", the tracking columns, and an AdminAction row
// "order.prodigi_status" (by "Prodigi") each time the stage, a step, an issue or a parcel changes.
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { alertKey, raiseAlert, resolveAlert } from "@/lib/alerts";
import { markShipped } from "@/lib/shipping";
import { orderNumber, usingProdigi } from "@/lib/printer";
import { PHASE_LABEL, getOrder, ourOrderIdOf, planSync, validProdigiId, type Phase, type ProdigiOrder, type ShipTracking } from "@/lib/prodigi";
import type { JobContext, JobResult } from "@/lib/jobs/run";

export const JOB = "prodigi-sync";
export const STATUS_ACTION = "order.prodigi_status";
const PRODIGI = { id: "prodigi", email: "Prodigi (print lab)" };
/** How long after sending the poller keeps checking an order that hasn't shipped. */
export const POLL_DAYS = 45;
const POLL_LIMIT = 100;

export const prodigiRef = (id: string) => `prodigi:${id}`;

/** The Prodigi order id in printerRef, or null. */
export function prodigiIdOf(printerRef: string | null | undefined): string | null {
  if (!printerRef?.startsWith("prodigi:")) return null;
  const id = printerRef.slice("prodigi:".length);
  return validProdigiId(id) ? id : null;
}

export type ProdigiStatus = {
  stage: string;
  phase: Phase;
  label: string;
  summary: string;
  /** Prodigi's own last-updated time for the order. */
  lastUpdated: string | null;
  /** When we recorded it. */
  recordedAt: Date;
  extraTracking: ShipTracking[];
  notes: string[];
};

type StatusDetails = { prodigiId?: string; stage?: string; phase?: Phase; lastUpdated?: string | null; signature?: string; extraTracking?: ShipTracking[]; notes?: string[] };

/** The latest recorded Prodigi status from an order's audit rows (newest first), for the admin order page. */
export function latestProdigiStatus(rows: { action: string; summary: string; details: unknown; createdAt: Date }[], prodigiId: string | null): ProdigiStatus | null {
  const row = rows.find((r) => r.action === STATUS_ACTION && (!prodigiId || (r.details as StatusDetails | null)?.prodigiId === prodigiId));
  if (!row) return null;
  const d = (row.details ?? {}) as StatusDetails;
  const phase = d.phase && d.phase in PHASE_LABEL ? d.phase : "received";
  return {
    stage: d.stage || "Unknown",
    phase,
    label: PHASE_LABEL[phase],
    summary: row.summary.replace(/^Prodigi:\s*/, ""),
    lastUpdated: d.lastUpdated ?? null,
    recordedAt: row.createdAt,
    extraTracking: Array.isArray(d.extraTracking) ? d.extraTracking : [],
    notes: Array.isArray(d.notes) ? d.notes : [],
  };
}

export type SyncResult = { orderId: string | null; phase?: Phase; actions: string[]; ignored?: string };

/**
 * Our order for a Prodigi order: by printerRef, else (a send that reached Prodigi but wasn't saved here) by the order
 * id we put in metadata / the idempotency key, adopting the Prodigi id when the order has no other Prodigi order.
 */
async function ourOrderFor(p: ProdigiOrder): Promise<{ id: string } | { ignored: string }> {
  const byRef = await prisma.order.findFirst({ where: { printerRef: prodigiRef(p.id) }, select: { id: true } });
  if (byRef) return byRef;
  const id = ourOrderIdOf(p);
  if (!id) return { ignored: "no Artfinity order for this Prodigi order" };
  const o = await prisma.order.findUnique({ where: { id }, select: { id: true, printerRef: true, kind: true, paymentStatus: true } });
  if (!o || (o.paymentStatus !== "paid" && o.kind !== "reprint")) return { ignored: "no paid Artfinity order for this Prodigi order" };
  if (prodigiIdOf(o.printerRef)) return { ignored: `superseded by ${o.printerRef}` };
  const { count } = await prisma.order.updateMany({
    where: { id: o.id, OR: [{ printerRef: null }, { printerRef: { startsWith: "failed" } }, { printerRef: { startsWith: "sending:" } }] },
    data: { printerRef: prodigiRef(p.id), printerSentAt: p.created ? new Date(p.created) : new Date(), sentToPrinter: true },
  });
  if (!count) return { ignored: "order changed while adopting" };
  console.log(`[prodigi] adopted ${p.id} for order ${o.id}`);
  await resolveAlert(alertKey.workOrderFailed(o.id));
  await resolveAlert(alertKey.orderStuck(o.id));
  return { id: o.id };
}

/** Applies Prodigi's current order to ours. Safe to call any number of times, in any order. */
export async function applyProdigiOrder(p: ProdigiOrder): Promise<SyncResult> {
  const found = await ourOrderFor(p);
  if ("ignored" in found) return { orderId: null, actions: [], ignored: found.ignored };
  const id = found.id;
  const o = await prisma.order.findUnique({ where: { id }, select: { id: true, shippingStatus: true, trackingNumber: true, deliveredAt: true, sentToPrinter: true } });
  if (!o) return { orderId: null, actions: [], ignored: "order gone" };
  const plan = planSync(o, p);
  const actions: string[] = [];

  if (plan.markSent) {
    const { count } = await prisma.order.updateMany({ where: { id, sentToPrinter: false }, data: { sentToPrinter: true } });
    if (count) actions.push("marked sent to printer");
  }

  if (plan.ship) {
    const r = await markShipped(id, plan.ship);
    if (r.changed || r.shippedNow) {
      await logAdminAction(PRODIGI, "order.ship", { type: "order", id }, `Prodigi shipped it: ${plan.ship.carrier} ${plan.ship.number}`, { to: "shipped", tracking: plan.ship, source: "prodigi" });
    }
    if (r.shippedNow) actions.push("shipped (buyer emailed)");
    else if (r.changed) actions.push("tracking saved");
  }

  if (plan.problem) {
    const key = plan.problem.key === "cancelled" ? alertKey.printLabCancelled(id) : alertKey.printLabProblem(id);
    const a = await raiseAlert({ kind: "print_lab_problem", key, title: `Order #${orderNumber(id)}: ${plan.problem.text}`, link: `/admin/orders/${id}`, severity: plan.problem.severity,
      // A cancellation is raised once per Prodigi order (the poller skips cancelled ones), so it may reopen; a problem
      // is seen on every sync while it lasts, so an admin's "resolve" sticks.
      reopen: plan.problem.key === "cancelled" });
    if (a?.created) actions.push(`alert: ${plan.problem.key}`);
  } else if (plan.clearProblem) {
    await resolveAlert(alertKey.printLabProblem(id));
  }

  // One audit row per change. A slower, older read finishing after a newer one doesn't overwrite it.
  const last = await prisma.adminAction.findFirst({ where: { targetType: "order", targetId: id, action: STATUS_ACTION }, orderBy: { createdAt: "desc" }, select: { details: true } });
  const ld = (last?.details ?? null) as StatusDetails | null;
  const older = !!(ld?.prodigiId === p.id && ld.lastUpdated && p.lastUpdated && ld.lastUpdated > p.lastUpdated);
  if (!older && (ld?.signature !== plan.signature || ld?.prodigiId !== p.id)) {
    await logAdminAction(PRODIGI, STATUS_ACTION, { type: "order", id }, `Prodigi: ${plan.summary}`, {
      prodigiId: p.id, stage: plan.stage, phase: plan.phase, lastUpdated: p.lastUpdated ?? null, signature: plan.signature,
      details: p.status?.details ?? {}, extraTracking: plan.extraTracking, notes: plan.notes,
    });
    actions.push(`recorded ${plan.stage}`);
  }
  return { orderId: id, phase: plan.phase, actions };
}

/** Fetches the order from Prodigi and applies it. Throws when Prodigi can't be reached (the caller decides). */
export async function syncProdigiOrder(prodigiId: string): Promise<SyncResult> {
  return applyProdigiOrder(await getOrder(prodigiId));
}

/** Job "prodigi-sync" (daily): polls every Prodigi order that hasn't shipped yet and applies the same transitions. */
export async function runProdigiSync(ctx: JobContext): Promise<JobResult> {
  if (!usingProdigi()) return { summary: "Skipped: PRINTER_PROVIDER isn't prodigi." };
  if (!process.env.PRODIGI_API_KEY?.trim()) return { ok: false, summary: "PRODIGI_API_KEY isn't set." };
  const open = await prisma.order.findMany({
    where: { printerRef: { startsWith: "prodigi:" }, shippingStatus: "pending", printerSentAt: { gte: new Date(ctx.now.getTime() - POLL_DAYS * 86_400_000) } },
    orderBy: { printerSentAt: "asc" },
    select: { id: true, printerRef: true },
    take: POLL_LIMIT,
  });
  // Skip ones already recorded as cancelled at Prodigi: an admin resends (new Prodigi id) or refunds.
  const rows = open.length
    ? await prisma.adminAction.findMany({ where: { targetType: "order", targetId: { in: open.map((o) => o.id) }, action: STATUS_ACTION }, orderBy: { createdAt: "desc" }, select: { targetId: true, details: true } })
    : [];
  const lastPhase = new Map<string, { prodigiId?: string; phase?: Phase }>();
  for (const r of rows) if (r.targetId && !lastPhase.has(r.targetId)) lastPhase.set(r.targetId, r.details as StatusDetails);

  let checked = 0;
  let cancelledSkipped = 0;
  const changed: { orderId: string; actions: string[] }[] = [];
  const failed: { orderId: string; error: string }[] = [];
  for (const o of open) {
    const pid = prodigiIdOf(o.printerRef);
    if (!pid) continue;
    const lp = lastPhase.get(o.id);
    if (lp?.prodigiId === pid && lp.phase === "cancelled") {
      cancelledSkipped++;
      continue;
    }
    checked++;
    try {
      const r = await syncProdigiOrder(pid);
      if (r.actions.length) changed.push({ orderId: o.id, actions: r.actions });
    } catch (err) {
      failed.push({ orderId: o.id, error: ((err as Error)?.message || "failed").slice(0, 200) });
    }
  }
  const parts = [`${checked} open Prodigi ${checked === 1 ? "order" : "orders"} checked`, `${changed.length} updated`];
  if (failed.length) parts.push(`${failed.length} couldn't be read`);
  if (cancelledSkipped) parts.push(`${cancelledSkipped} cancelled skipped`);
  return {
    ok: failed.length === 0 || failed.length < checked,
    summary: open.length ? parts.join(", ") : "No open Prodigi orders.",
    details: { changed, failed, cancelledSkipped },
  };
}
