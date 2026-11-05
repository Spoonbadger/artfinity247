// Shipping automation: saving tracking (admin, the print lab's form, or a provider), registering it with the carrier
// tracking provider, and moving orders along when the provider's webhook reports progress. Server only.
//
//   tracking entered  -> columns + Message saved, registered with Shippo/EasyPost, order "shipped", shipped email
//   in_transit event  -> shippedAt set if missing; a still-pending order becomes "shipped" (shipped email)
//   delivered event   -> deliveredAt, "delivered", delivered email, review request (once: claimed on deliveredAt)
//   returned/failure  -> a "shipping_problem" alert for an admin
import { prisma } from "@/lib/prisma";
import type { Tracking } from "@/lib/tracking";
import { sendShippingEmail } from "@/lib/orderEmails";
import { sendReviewRequest } from "@/lib/reviews";
import { alertKey, raiseAlert, resolveAlert } from "@/lib/alerts";
import { orderNumber } from "@/lib/printer";
import { shippingProvider, type TrackingEvent } from "@/lib/shipping/providers";
import { getTracking, orderIdForTracking, writeTracking } from "@/lib/shipping/store";

export { getTracking, trackingForOrders, shippedDate, shippedDates } from "@/lib/shipping/store";

/** Alert key for "sent to the lab 5+ business days ago, still no tracking" (raised by the stuck-orders job). */
export const noTrackingKey = (orderId: string) => `order_no_tracking:${orderId}`;

/** Tells the provider to watch this number. Never throws (tracking still works by hand without it). */
export async function registerTracking(orderId: string, t: Tracking): Promise<string | null> {
  const p = shippingProvider();
  if (!p || t.carrier === "Other") return null;
  try {
    const id = await p.register({ carrier: t.carrier, number: t.number, orderId });
    console.log(`[shipping:${p.id}] watching ${t.carrier} ${t.number} for order ${orderId} (${id})`);
    return id;
  } catch (err) {
    console.error(`[shipping:${p.id}] couldn't register ${t.number}`, err);
    return null;
  }
}

/** Saves tracking and registers a new number with the provider. Doesn't change the status or email anyone. */
export async function recordTracking(orderId: string, t: Tracking): Promise<boolean> {
  const changed = await writeTracking(orderId, t);
  if (changed) await registerTracking(orderId, t);
  return changed;
}

/**
 * Tracking from the lab's form (or any caller that isn't the admin status route): saves it, and the first time moves the
 * order from pending to shipped and sends the buyer the shipped email with the tracking link.
 */
export async function markShipped(orderId: string, t: Tracking): Promise<{ changed: boolean; shippedNow: boolean }> {
  const changed = await recordTracking(orderId, t);
  const { count } = await prisma.order.updateMany({ where: { id: orderId, shippingStatus: "pending" }, data: { shippingStatus: "shipped" } });
  if (count) {
    await sendShippingEmail(orderId, "shipped", t).catch((err) => console.error("Shipped email failed", orderId, err));
    await resolveAlert(noTrackingKey(orderId));
  }
  return { changed, shippedNow: count > 0 };
}

export type EventResult = { matched: boolean; orderId?: string; action: string };

/** Applies one provider event. Safe to receive twice (providers retry): each transition is claimed in the database. */
export async function applyTrackingEvent(ev: TrackingEvent): Promise<EventResult> {
  let orderId = ev.orderId && (await prisma.order.findUnique({ where: { id: ev.orderId }, select: { id: true } }))?.id;
  if (!orderId) orderId = await orderIdForTracking(ev.trackingNumber);
  if (!orderId) return { matched: false, action: "no order has this tracking number" };
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, shippingStatus: true, shippedAt: true, deliveredAt: true } });
  if (!o) return { matched: false, action: "order gone" };

  if (ev.status === "in_transit") {
    if (!o.shippedAt) await prisma.order.updateMany({ where: { id: o.id, shippedAt: null }, data: { shippedAt: ev.at } });
    const { count } = await prisma.order.updateMany({ where: { id: o.id, shippingStatus: "pending" }, data: { shippingStatus: "shipped" } });
    if (count) {
      await sendShippingEmail(o.id, "shipped", await getTracking(o.id)).catch((err) => console.error("Shipped email failed", o.id, err));
      await resolveAlert(noTrackingKey(o.id));
      return { matched: true, orderId: o.id, action: "shipped" };
    }
    return { matched: true, orderId: o.id, action: "in transit (already shipped)" };
  }

  if (ev.status === "delivered") {
    const { count } = await prisma.order.updateMany({
      where: { id: o.id, deliveredAt: null },
      data: { deliveredAt: ev.at, shippingStatus: "delivered", shippedAt: o.shippedAt ?? ev.at },
    });
    if (!count) return { matched: true, orderId: o.id, action: "already delivered" };
    if (o.shippingStatus !== "delivered") {
      await sendShippingEmail(o.id, "delivered", null).catch((err) => console.error("Delivered email failed", o.id, err));
      await sendReviewRequest(o.id).catch((err) => console.error("Review request failed", o.id, err));
    }
    await resolveAlert(alertKey.orderUndelivered(o.id));
    await resolveAlert(`shipping_problem:${o.id}`);
    return { matched: true, orderId: o.id, action: "delivered" };
  }

  if (ev.status === "problem") {
    await raiseAlert({
      kind: "shipping_problem",
      key: `shipping_problem:${o.id}`,
      title: `Order #${orderNumber(o.id)}: carrier reports a problem (${ev.detail || "returned or failed"})`.slice(0, 200),
      link: `/admin/orders/${o.id}`,
      severity: "normal",
    });
    return { matched: true, orderId: o.id, action: "problem alert" };
  }
  return { matched: true, orderId: o.id, action: `ignored (${ev.status})` };
}
