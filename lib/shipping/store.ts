// Where an order's tracking lives. Server only, no email or provider imports (safe to use from anywhere).
//
// Order.trackingCarrier / trackingNumber / shippedAt / deliveredAt are the source of truth. Before those columns
// existed, tracking was a Message on the order ("Shipped: USPS 9400…", lib/tracking.ts). Writes still add that
// Message (it shows the artist the tracking in their customer thread); reads use the columns first and fall back to
// the Message for older orders. scripts/backfill-tracking.mjs copies the old Messages into the columns.
import { prisma } from "@/lib/prisma";
import { CARRIERS, TRACKING_SUBJECT, parseTrackingMessage, trackingText, trackingUrl, type Carrier, type Tracking } from "@/lib/tracking";

type OrderTrackingCols = { id: string; trackingCarrier: string | null; trackingNumber: string | null };

const asCarrier = (c: string | null): Carrier => (CARRIERS as readonly string[]).includes(c || "") ? (c as Carrier) : "Other";

function fromColumns(o: OrderTrackingCols, msgUrl: string | null = null): Tracking | null {
  if (!o.trackingNumber) return null;
  const carrier = asCarrier(o.trackingCarrier);
  return { carrier, number: o.trackingNumber, url: trackingUrl(carrier, o.trackingNumber) ?? msgUrl };
}

const msgSelect = { orderId: true, subject: true, body: true, createdAt: true } as const;

/** Tracking for many orders at once (list pages): orderId -> tracking. Columns first, else the newest Message. */
export async function trackingForOrders(orders: OrderTrackingCols[]): Promise<Map<string, Tracking>> {
  const out = new Map<string, Tracking>();
  const needMsg = orders.filter((o) => !o.trackingNumber || asCarrier(o.trackingCarrier) === "Other").map((o) => o.id);
  const msgs = needMsg.length
    ? await prisma.message.findMany({ where: { orderId: { in: needMsg }, subject: { startsWith: TRACKING_SUBJECT } }, orderBy: { createdAt: "asc" }, select: msgSelect })
    : [];
  const fromMsg = new Map<string, Tracking>();
  for (const m of msgs) {
    const t = parseTrackingMessage(m.subject, m.body);
    if (t && m.orderId) fromMsg.set(m.orderId, t);
  }
  for (const o of orders) {
    const t = fromColumns(o, fromMsg.get(o.id)?.url ?? null) ?? fromMsg.get(o.id) ?? null;
    if (t) out.set(o.id, t);
  }
  return out;
}

/** Latest tracking for one order, or null. */
export async function getTracking(orderId: string): Promise<Tracking | null> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, trackingCarrier: true, trackingNumber: true } });
  if (!o) return null;
  return (await trackingForOrders([o])).get(o.id) ?? null;
}

/** Shipped dates for many orders: the shippedAt column, else when the first tracking Message was saved. */
export async function shippedDates(orderIds: string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (!orderIds.length) return out;
  const rows = await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, shippedAt: true } });
  for (const r of rows) if (r.shippedAt) out.set(r.id, r.shippedAt);
  const rest = orderIds.filter((id) => !out.has(id));
  if (rest.length) {
    const msgs = await prisma.message.groupBy({ by: ["orderId"], where: { orderId: { in: rest }, subject: { startsWith: TRACKING_SUBJECT } }, _min: { createdAt: true } });
    for (const m of msgs) if (m.orderId && m._min.createdAt) out.set(m.orderId, m._min.createdAt);
  }
  return out;
}

export async function shippedDate(orderId: string): Promise<Date | null> {
  return (await shippedDates([orderId])).get(orderId) ?? null;
}

/** The order whose tracking number this is (columns, then the old Messages). */
export async function orderIdForTracking(number: string): Promise<string | null> {
  const clean = number.trim();
  if (!clean) return null;
  const o = await prisma.order.findFirst({ where: { trackingNumber: { equals: clean, mode: "insensitive" } }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (o) return o.id;
  const m = await prisma.message.findFirst({ where: { subject: { startsWith: TRACKING_SUBJECT, endsWith: ` ${clean}` }, orderId: { not: null } }, orderBy: { createdAt: "desc" }, select: { orderId: true } });
  return m?.orderId ?? null;
}

/**
 * Saves tracking on the order: the columns (shippedAt only if not set yet) and, as before, a Message per artist in the
 * order. Returns true when the number changed (so callers don't re-register or re-email the same number).
 */
export async function writeTracking(orderId: string, tracking: Tracking, opts: { shippedAt?: Date } = {}): Promise<boolean> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, email: true, trackingNumber: true, trackingCarrier: true, shippedAt: true, items: { select: { artwork: { select: { artistId: true } } } } },
  });
  if (!o) throw new Error("Order not found");
  const changed = o.trackingNumber !== tracking.number || o.trackingCarrier !== tracking.carrier;
  await prisma.order.update({
    where: { id: orderId },
    data: { trackingCarrier: tracking.carrier, trackingNumber: tracking.number, shippedAt: o.shippedAt ?? opts.shippedAt ?? new Date() },
  });
  if (!changed) return false;
  const artistIds = Array.from(new Set(o.items.map((i) => i.artwork?.artistId).filter((x): x is string => !!x)));
  if (artistIds.length) {
    await prisma.message
      .createMany({
        data: artistIds.map((artistId) => ({
          artistId,
          email: o.email.trim().toLowerCase(),
          orderId: o.id,
          direction: "out",
          subject: `${TRACKING_SUBJECT}${tracking.carrier} ${tracking.number}`,
          body: `Artfinity shipped this order.\n${trackingText(tracking)}`,
          sentAt: new Date(),
        })),
      })
      .catch((err) => console.error("Saving tracking message failed", err));
  }
  return true;
}
