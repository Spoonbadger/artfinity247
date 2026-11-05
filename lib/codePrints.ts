// "We print them for you": laminated, pre-cut QR codes mailed to the artist, at cost. Server only.
//
//   Pricing   per-card cost per format + flat shipping + optional handling, set by the owner at /admin/settings/code-prints
//             (stored in the admin settings, lib/adminSettings.ts). Until then the placeholders in PRICING_DEFAULTS apply.
//   Checkout  the same two paths as /api/studio/bulk: Stripe Checkout when STRIPE_SECRET_KEY is set (the webhook, or the
//             return page, marks the order paid), otherwise a paid test order right away (lib/testCheckout.ts).
//   Paid      queue items in the order leave the queue, the artist gets a confirmation email, admins get a
//             "New code print order" alert. Admin moves it printing -> shipped (tracking email) -> delivered.
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { readAdminSettings, writeAdminSettings, type AdminSettings } from "@/lib/adminSettings";
import { resend } from "@/lib/resend";
import { emailHtml, firstNameOf } from "@/lib/artistEmails";
import { raiseAlert, resolveAlert } from "@/lib/alerts";
import { isProActive } from "@/lib/plans";
import { FORMATS, type FormatKey } from "@/components/qr/card";
import { cardWords, codeOrderNumber, FORMAT_ORDER, PRICING_DEFAULTS, quoteFor, type CodePrintPricing, type OrderStatus } from "@/lib/printQueueFormat";
import type { Tracking } from "@/lib/tracking";

const FROM = process.env.EMAIL_FROM || "Artfinity <contact@theartfinity.com>";
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const KEY = "codePrints";

// ---------------- pricing ----------------
const cents = (v: unknown, d: number, max = 100_000) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : d;
};

export function cleanPricing(raw: unknown, base: CodePrintPricing = PRICING_DEFAULTS): CodePrintPricing {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const u = (r.unit && typeof r.unit === "object" ? r.unit : {}) as Record<string, unknown>;
  const unit = {} as Record<FormatKey, number>;
  for (const f of FORMAT_ORDER) unit[f] = cents(u[f], base.unit[f]);
  return { unit, shipping: cents(r.shipping, base.shipping), handling: cents(r.handling, base.handling), infinityFreeShipping: typeof r.infinityFreeShipping === "boolean" ? r.infinityFreeShipping : base.infinityFreeShipping };
}

/** The owner's prices, or the placeholders (`placeholder: true`) until they're saved once. */
export async function codePrintPricing(): Promise<CodePrintPricing & { placeholder: boolean }> {
  const raw = ((await readAdminSettings()) as Record<string, unknown>)[KEY];
  if (raw && typeof raw === "object") return { ...cleanPricing(raw), placeholder: false };
  return { ...PRICING_DEFAULTS, placeholder: true };
}

export async function saveCodePrintPricing(p: CodePrintPricing, by: { id: string; email?: string }) {
  await writeAdminSettings({ [KEY]: p } as Record<string, unknown> as AdminSettings, by);
}

export async function isInfinity(artistId: string) {
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { plan: true, proUntil: true } });
  return isProActive(a);
}

// ---------------- orders ----------------
export type OrderItemSnap = {
  qrCodeId: string; code: string; artworkId: string; format: FormatKey; qty: number;
  design: unknown; art: { slug: string; title: string; artist: string; imageUrl: string; markups: Record<string, number>; edition?: number | null; sensitive?: string[] };
  qrText: string;
};

export const orderItems = (raw: unknown): OrderItemSnap[] => (Array.isArray(raw) ? (raw as OrderItemSnap[]).filter((i) => i && typeof i === "object" && i.format in FORMATS) : []);

export function countsOf(items: OrderItemSnap[]) {
  const c: Partial<Record<FormatKey, number>> = {};
  for (const i of items) c[i.format] = (c[i.format] || 0) + i.qty;
  return c;
}

export const summaryOf = (items: OrderItemSnap[]) => {
  const c = countsOf(items);
  return FORMAT_ORDER.filter((f) => c[f]).map((f) => cardWords(f, c[f]!)).join(", ");
};

export const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export function stripeClient() {
  return process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" }) : null;
}

/** A Stripe Checkout session for an order that isn't paid yet. */
export async function checkoutSession(order: { id: string; email: string; items: unknown; subtotalCents: number; shippingCents: number; handlingCents: number; pricing: unknown }, base: string) {
  const stripe = stripeClient();
  if (!stripe) throw new Error("Stripe isn't set up");
  const items = orderItems(order.items);
  const counts = countsOf(items);
  const p = cleanPricing(order.pricing);
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = FORMAT_ORDER.filter((f) => counts[f]).map((f) => ({
    quantity: counts[f]!,
    price_data: { currency: "usd", unit_amount: p.unit[f], product_data: { name: `${FORMATS[f].name} QR codes, printed, laminated and cut (at cost)` } },
  }));
  if (order.handlingCents > 0) line_items.push({ quantity: 1, price_data: { currency: "usd", unit_amount: order.handlingCents, product_data: { name: "Handling (at cost)" } } });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    locale: "en",
    customer_email: order.email,
    line_items,
    shipping_options: [{ shipping_rate_data: { display_name: order.shippingCents ? "Mail with tracking (at cost)" : "Free shipping (Infinity)", fixed_amount: { amount: order.shippingCents, currency: "usd" }, type: "fixed_amount" } }],
    metadata: { kind: "code_print", codePrintOrderId: order.id },
    success_url: `${base}/studio/qr/queue?paid=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/studio/qr/queue?canceled=${order.id}`,
  });
  await prisma.codePrintOrder.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
  return session.url;
}

/**
 * Mark paid, once (safe to call from the webhook and the return page both). The first call clears the queue items in the
 * order, emails the artist and raises the admin alert. Returns true when this call did it.
 */
export async function markCodeOrderPaid(orderId: string): Promise<boolean> {
  const { count } = await prisma.codePrintOrder.updateMany({ where: { id: orderId, status: { in: ["pending", "canceled"] } }, data: { status: "paid", paidAt: new Date(), canceledAt: null } });
  if (!count) return false;
  const o = await prisma.codePrintOrder.findUnique({ where: { id: orderId } });
  if (!o) return false;
  if (o.artistId && o.queueItemIds.length) await prisma.printQueueItem.deleteMany({ where: { id: { in: o.queueItemIds }, artistId: o.artistId } }).catch(() => null);
  const items = orderItems(o.items);
  const no = codeOrderNumber(o.id);
  await raiseAlert({ kind: "code_print_order", key: codeOrderAlertKey(o.id), title: `New code print order ${no}: ${summaryOf(items)} for ${o.artistName || o.email}`, link: `/admin/code-orders/${o.id}` });
  await sendCodeOrderEmail(o.id, "paid").catch((e) => console.error("[code-prints] confirmation email failed", o.id, e));
  return true;
}

/** From the Stripe return page: if the session is paid, mark the order paid (the webhook may not have arrived yet). */
export async function confirmFromSession(orderId: string, sessionId: string, artistId: string) {
  const stripe = stripeClient();
  if (!stripe || !sessionId.startsWith("cs_")) return false;
  const o = await prisma.codePrintOrder.findFirst({ where: { id: orderId, artistId, stripeSessionId: sessionId }, select: { id: true } });
  if (!o) return false;
  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    if (s.payment_status === "paid" || s.payment_status === "no_payment_required") return markCodeOrderPaid(o.id);
  } catch (e) {
    console.error("[code-prints] session check failed", e);
  }
  return false;
}

export const codeOrderAlertKey = (orderId: string) => `code_print_order:${orderId}`;

/** Admin status changes. Shipped needs tracking; it emails the artist the link and logs the codes as printed. */
export async function setCodeOrderStatus(orderId: string, to: OrderStatus, tracking?: Tracking | null) {
  const now = new Date();
  const o = await prisma.codePrintOrder.findUnique({ where: { id: orderId } });
  if (!o) return null;
  const data: Record<string, unknown> = { status: to };
  if (to === "printing") data.printingAt = o.printingAt ?? now;
  if (to === "shipped") {
    data.shippedAt = now;
    if (tracking) Object.assign(data, { carrier: tracking.carrier, trackingNumber: tracking.number, trackingUrl: tracking.url });
  }
  if (to === "delivered") { data.deliveredAt = now; if (!o.shippedAt) data.shippedAt = now; }
  const updated = await prisma.codePrintOrder.update({ where: { id: orderId }, data });
  if (to !== "paid") await resolveAlert(codeOrderAlertKey(orderId));
  if (to === "shipped" && o.status !== "shipped" && o.artistId) {
    // Mailed codes count as printed in My codes from the day they ship.
    const items = orderItems(o.items);
    await prisma.qrPrintLog.createMany({ data: items.map((i) => ({ qrCodeId: i.qrCodeId, artistId: o.artistId!, format: i.format, qty: i.qty, method: "mail", orderId: o.id })) }).catch(() => null);
  }
  if (to === "shipped" || to === "delivered") await sendCodeOrderEmail(orderId, to).catch((e) => console.error("[code-prints] status email failed", orderId, e));
  return updated;
}

/** The artist's emails: paid (confirmation), shipped (with tracking), delivered. */
export async function sendCodeOrderEmail(orderId: string, kind: "paid" | "shipped" | "delivered") {
  const o = await prisma.codePrintOrder.findUnique({ where: { id: orderId } });
  if (!o?.email) return false;
  const items = orderItems(o.items);
  const no = codeOrderNumber(o.id);
  const hi = `Hi ${firstNameOf(o.artistName || o.shipName)},`;
  const link = `${APP_URL()}/studio/qr/queue#orders`;
  let subject = "", body = "";
  if (kind === "paid") {
    subject = `Your QR codes are ordered (${no})`;
    body = `${hi}\n\nThanks. We're printing ${summaryOf(items)} for you: laminated, cut and ready to hang.\n\n` +
      `Paid: ${usd(o.totalCents)} (cards ${usd(o.subtotalCents)}, shipping ${usd(o.shippingCents)}${o.handlingCents ? `, handling ${usd(o.handlingCents)}` : ""}). At cost: we don't make money on these.\n\n` +
      `Mailing to:\n${o.shipName}\n${o.shipLine1}${o.shipLine2 ? `\n${o.shipLine2}` : ""}\n${o.shipCity}, ${o.shipState} ${o.shipZip}\n\n` +
      `We'll email the tracking link when they ship. See your order: ${link}`;
  } else if (kind === "shipped") {
    subject = `Your QR codes shipped (${no})`;
    body = `${hi}\n\nYour ${summaryOf(items)} are on the way.\n\n` +
      (o.trackingNumber ? `${o.carrier || "Tracking"} number: ${o.trackingNumber}${o.trackingUrl ? `\nTrack it: ${o.trackingUrl}` : ""}\n\n` : "") +
      `When they arrive, scan one with your phone before you hang them all. See your order: ${link}`;
  } else {
    subject = `Your QR codes arrived (${no})`;
    body = `${hi}\n\nYour ${summaryOf(items)} were delivered. Hang each one beside its painting, at eye height, and scan one to check.\n\nSomething wrong with them? Reply to this email and we'll fix it.`;
  }
  const { error } = await resend.emails.send({ from: FROM, to: o.email, subject, text: body, html: emailHtml(body) }, { idempotencyKey: `code-order-${kind}-${o.id}${kind === "shipped" && o.trackingNumber ? `-${o.trackingNumber.replace(/[^A-Za-z0-9]/g, "")}` : ""}` });
  if (error) throw error;
  return true;
}

export { quoteFor };
