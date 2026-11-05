// Free reprints, server side: signed help links, the request/decision writes and the emails.
// Rules, storage format and pure helpers: lib/reprintFormat.ts.
//
// Buyers have no account, so the "Problem with your print?" link carries a signature of `help:<orderId>`
// (HMAC, same secret and approach as review links in lib/reviews.ts). Anyone holding it can ask about that order only.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { emailHtml, firstNameOf, joinTitles } from "@/lib/artistEmails";
import { calcItemProfitCents } from "@/lib/revenue";
import { normalizeSize } from "@/lib/sales";
import { shippedDate } from "@/lib/shipping/store";
import { sendWorkOrder } from "@/lib/printer";
import { alertKey, raiseAlert, resolveAlert } from "@/lib/alerts";
import { reprintAlert } from "@/lib/alertBuilders";
import { logAdminAction } from "@/lib/audit";
import {
  MAX_NOTE, MAX_PHOTOS, REPRINT_DIRECTION, REPRINT_KIND, REPRINT_PAYMENT, helpState, isReprintReason, parseReprintBody,
  reasonLabel, statusOf, statusSubject, type ReprintBody, type ReprintStatus,
} from "@/lib/reprintFormat";

const SECRET = process.env.SCAN_SIGNING_SECRET || process.env.JWT_SECRET || "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const FROM = "Artfinity <notifications@theartfinity.com>";
const ADMIN_TO = "craig@theartfinity.com";

// ---------- Signing ----------

export function signHelp(orderId: string): string {
  return crypto.createHmac("sha256", SECRET).update(`help:${orderId}`).digest("base64url").slice(0, 22);
}

export function verifyHelp(orderId: string, sig: unknown): boolean {
  if (!SECRET || !orderId || typeof sig !== "string" || sig.length !== 22) return false;
  const want = Buffer.from(signHelp(orderId));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export const helpPath = (orderId: string) => `/order/${orderId}/help?t=${signHelp(orderId)}`;
export const helpUrl = (orderId: string) => `${APP_URL}${helpPath(orderId)}`;
/** One plain line for the shipped/delivered emails. */
export const helpLine = (orderId: string) => `Problem with your print? ${helpUrl(orderId)}`;

/** Only photos uploaded through this order's help link (POST /api/uploads with helpOrder). */
export function photoOk(orderId: string, url: string) {
  const id = orderId.replace(/[^\w-]/g, "");
  return (
    new RegExp(`^/uploads/reprints/${id}/[\\w-]+\\.jpg$`).test(url) ||
    new RegExp(`^https://res\\.cloudinary\\.com/[\\w./-]+/reprints/${id}/[\\w./-]+$`).test(url)
  );
}

// ---------- Reads ----------

/** Shipped date: Order.shippedAt, else when admin saved the tracking number (older orders kept it as a Message). */
export async function shippedAtFor(orderId: string): Promise<Date | null> {
  return shippedDate(orderId);
}

export type ReprintRow = { id: string; orderId: string; status: ReprintStatus; body: ReprintBody; createdAt: Date; decidedAt: Date | null };

function toRow(m: { id: string; orderId: string | null; subject: string | null; body: string; createdAt: Date; sentAt: Date | null }): ReprintRow | null {
  const status = statusOf(m.subject);
  const body = parseReprintBody(m.body);
  return status && body && m.orderId ? { id: m.id, orderId: m.orderId, status, body, createdAt: m.createdAt, decidedAt: m.sentAt } : null;
}

const rowSelect = { id: true, orderId: true, subject: true, body: true, createdAt: true, sentAt: true } as const;

export async function requestsForOrder(orderId: string): Promise<ReprintRow[]> {
  const rows = await prisma.message.findMany({ where: { orderId, direction: REPRINT_DIRECTION }, orderBy: { createdAt: "asc" }, select: rowSelect });
  return rows.map(toRow).filter((r): r is ReprintRow => !!r);
}

export async function listRequests(status?: ReprintStatus, take = 200): Promise<ReprintRow[]> {
  const rows = await prisma.message.findMany({
    where: { direction: REPRINT_DIRECTION, ...(status ? { subject: statusSubject(status) } : {}) },
    orderBy: { createdAt: status === "open" ? "asc" : "desc" },
    take,
    select: rowSelect,
  });
  return rows.map(toRow).filter((r): r is ReprintRow => !!r);
}

export const openRequestCount = () => prisma.message.count({ where: { direction: REPRINT_DIRECTION, subject: statusSubject("open") } });

/** Approved reprints on these orders, for the artist's customer timeline: orderId -> reason. */
export async function approvedReprintReasons(orderIds: string[]): Promise<Map<string, string>> {
  if (!orderIds.length) return new Map();
  const rows = await prisma.message.findMany({
    where: { orderId: { in: orderIds }, direction: REPRINT_DIRECTION, subject: statusSubject("approved") },
    select: rowSelect,
  });
  const out = new Map<string, string>();
  for (const r of rows.map(toRow)) if (r) out.set(r.orderId, r.body.reason);
  return out;
}

// ---------- Buyer: new request ----------

export class ReprintError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function createRequest(orderId: string, input: { items?: unknown; reason?: unknown; photos?: unknown; note?: unknown }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, email: true, shippingName: true, kind: true, paymentStatus: true, shippingStatus: true, createdAt: true, amountTotal: true,
      items: { select: { id: true, quantity: true, title: true, artwork: { select: { artistId: true } } } },
    },
  });
  if (!order) throw new ReprintError("We couldn't find that order.", 404);
  const state = helpState(order, await shippedAtFor(order.id));
  if (state === "never") throw new ReprintError("This order can't take a reprint request.", 403);
  if (state === "waiting") throw new ReprintError("Your print hasn't shipped yet. Write to us if something's wrong.", 409);
  if (state === "closed") throw new ReprintError("It's been more than 14 days since delivery. Write to us and we'll take a look.", 409);
  const earlier = await requestsForOrder(order.id);
  if (earlier.some((r) => r.status === "open")) throw new ReprintError("We already have your request. We'll email you soon.", 409);

  if (!isReprintReason(input.reason)) throw new ReprintError("Pick what went wrong.");
  const byId = new Map(order.items.map((i) => [i.id, i]));
  const picked = (Array.isArray(input.items) ? input.items : [])
    .map((x: any) => {
      const it = byId.get(String(x?.id ?? ""));
      if (!it) return null;
      const max = it.quantity ?? 1;
      return { id: it.id, qty: Math.min(max, Math.max(1, Math.round(Number(x?.qty) || 1))) };
    })
    .filter((x): x is { id: string; qty: number } => !!x);
  const items = Array.from(new Map(picked.map((p) => [p.id, p])).values());
  if (!items.length) throw new ReprintError("Pick the print that needs fixing.");
  const photos = (Array.isArray(input.photos) ? input.photos : []).filter((p): p is string => typeof p === "string").slice(0, MAX_PHOTOS);
  if (!photos.length) throw new ReprintError("Add a photo of the problem.");
  if (photos.some((p) => !photoOk(order.id, p))) throw new ReprintError("A photo didn't upload properly. Try adding it again.");
  const note = String(input.note ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_NOTE);

  // Message.artistId is required: hang it on the artist of the first picked print.
  const artistId = items.map((i) => byId.get(i.id)?.artwork?.artistId).find(Boolean) ?? order.items.map((i) => i.artwork?.artistId).find(Boolean);
  if (!artistId) throw new ReprintError("This piece isn't listed anymore. Write to us and we'll sort it out.", 410);

  const body: ReprintBody = { v: 1, reason: input.reason, note, photos, items };
  const msg = await prisma.message.create({
    data: { artistId, email: `reprint:${order.id}`, orderId: order.id, direction: REPRINT_DIRECTION, subject: statusSubject("open"), body: JSON.stringify(body) },
    select: { id: true },
  });

  const titles = joinTitles(items.map((i) => byId.get(i.id)?.title || ""));

  // Auto-approve: the buyer's first request on this order, with a photo, on an order of REPRINT_AUTO_MAX or less.
  // The reprint order and its work order go out now, the buyer gets the "on its way" email, and admins get a low alert
  // to glance at (plus an audit row). Anything else waits for an admin, as before.
  if (autoApproves(order.amountTotal, earlier.length, photos.length)) {
    try {
      const r = await decideRequest(msg.id, "approve", "");
      await logAdminAction(AUTOMATION, "reprint.approve", { type: "reprint", id: msg.id },
        `auto-approved: reprint of ${titles} (first request, photo attached, order ${usd(order.amountTotal)} within the ${usd(autoMaxCents())} limit)`,
        { orderId: order.id, reprintOrderId: r.reprintOrderId, auto: true, reason: body.reason });
      await raiseAlert({
        kind: "reprint_auto",
        key: `reprint_auto:${msg.id}`,
        title: `Reprint auto-approved on order #${order.id.slice(-8).toUpperCase()} (${reasonLabel(body.reason)}, ${usd(order.amountTotal)}): have a glance at the photos`,
        link: `/admin/orders/${order.id}`,
        severity: "low",
      });
      return msg.id;
    } catch (err) {
      // Leave it open for an admin, the normal way.
      console.error("Reprint auto-approve failed, leaving it for an admin", msg.id, err);
    }
  }

  await raiseAlert(reprintAlert(msg.id, order.id, reasonLabel(body.reason)));
  await sendBuyer(order.email, "We got your photos", [
    `Hi ${firstNameOf(order.shippingName)},`,
    `Sorry about ${titles}. Thank you for the photos.`,
    `We'll look today or tomorrow and email you. If it's on us, we reprint it free.`,
  ]).catch((err) => console.error("Reprint confirmation email failed", err));
  await resend.emails.send({
    from: FROM,
    to: ADMIN_TO,
    subject: `Reprint request: ${reasonLabel(body.reason)}`,
    html: emailHtml(`${order.shippingName || order.email} asked about ${titles}.\n\n${note || "(no note)"}\n\n${APP_URL}/admin/reprints`),
    text: `${order.shippingName || order.email} asked about ${titles}.\n\n${note || "(no note)"}\n\n${APP_URL}/admin/reprints`,
  }).catch((err) => console.error("Reprint admin email failed", err));
  return msg.id;
}

// ---------- Auto-approve rule ----------

/** The automation's name in the audit log. */
const AUTOMATION = { id: "automation", email: "automation (reprint rule)" };
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

/** REPRINT_AUTO_MAX: the largest order total (dollars, tax included) a first reprint request is approved on by itself. Default $150; 0 turns it off. */
export function autoMaxCents() {
  const v = Number(process.env.REPRINT_AUTO_MAX ?? 150);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : 15000;
}

export const autoApproves = (amountTotalCents: number, earlierRequests: number, photos: number) =>
  earlierRequests === 0 && photos > 0 && autoMaxCents() > 0 && amountTotalCents <= autoMaxCents();

// ---------- Admin: decide ----------

export type Decision = "approve" | "refund" | "decline";

export async function decideRequest(id: string, action: Decision, note: string) {
  const msg = await prisma.message.findFirst({ where: { id, direction: REPRINT_DIRECTION }, select: rowSelect });
  const row = msg && toRow(msg);
  if (!row) throw new ReprintError("Request not found.", 404);
  if (row.status !== "open") throw new ReprintError(`Already ${row.status}.`, 409);
  if (action === "decline" && !note) throw new ReprintError("Add a short note for the buyer.");

  const orig = await prisma.order.findUnique({
    where: { id: row.orderId },
    select: {
      id: true, email: true, currency: true, shippingName: true, shippingAddress: true,
      items: { select: { id: true, artworkId: true, slug: true, size: true, frameChosen: true, frameColor: true, quantity: true, title: true, artistName: true, imageUrl: true, editionNumber: true } },
    },
  });
  if (!orig) throw new ReprintError("The original order is gone.", 404);

  const status: ReprintStatus = action === "approve" ? "approved" : action === "refund" ? "refunded" : "declined";
  const now = new Date();
  const decision: NonNullable<ReprintBody["decision"]> = { note, at: now.toISOString() };

  await prisma.$transaction(async (tx) => {
    // Claim it: two admins clicking at once can't both create a reprint.
    const { count } = await tx.message.updateMany({ where: { id, subject: statusSubject("open") }, data: { subject: statusSubject(status), sentAt: now } });
    if (count !== 1) throw new ReprintError("Someone else just decided this one.", 409);

    if (action === "approve") {
      const n = await tx.order.count({ where: { stripeSessionId: { startsWith: `reprint:${orig.id}:` } } });
      const reprint = await tx.order.create({
        data: {
          stripeSessionId: `reprint:${orig.id}:${n + 1}`,
          email: orig.email,
          amountTotal: 0,
          currency: orig.currency || "usd",
          paymentStatus: REPRINT_PAYMENT,
          kind: REPRINT_KIND,
          shippingName: orig.shippingName,
          shippingAddress: orig.shippingAddress,
          // Not a sale: no receipt, no "new sale" emails (these mark them done).
          receiptSentAt: now,
          adminNotificationSentAt: now,
          artistNotificationsSentAt: now,
        },
      });
      const byId = new Map(orig.items.map((i) => [i.id, i]));
      await tx.orderItem.createMany({
        data: row.body.items.flatMap(({ id: itemId, qty }) => {
          const it = byId.get(itemId);
          if (!it) return [];
          const b = calcItemProfitCents({ lineTotal: 0, size: normalizeSize(it.size), frameChosen: it.frameChosen, quantity: qty, orderDate: now });
          return [{
            orderId: reprint.id,
            artworkId: it.artworkId, slug: it.slug, size: it.size, frameChosen: it.frameChosen, frameColor: it.frameColor,
            title: it.title, artistName: it.artistName, imageUrl: it.imageUrl,
            unitPrice: 0, quantity: qty, lineTotal: 0,
            printCost: b.printCost, shippingCost: b.shippingCost, laborCost: b.laborCost, websiteCost: b.websiteCost,
            artistSplit: null, qrCodeId: null,
            // Same numbered print, made again: keep its number when the whole line is replaced. Claims no new number.
            editionNumber: qty === (it.quantity ?? 1) ? it.editionNumber : null,
          }];
        }),
      });
      decision.reprintOrderId = reprint.id;
    }
    await tx.message.update({ where: { id }, data: { body: JSON.stringify({ ...row.body, decision }) } });
  });

  await resolveAlert(alertKey.reprint(id));

  // The reprint goes to the print lab like any order (lib/printer.ts; never throws).
  if (decision.reprintOrderId) {
    const wo = await sendWorkOrder(decision.reprintOrderId);
    if (wo.status === "failed") console.error("Reprint work order not sent", decision.reprintOrderId, wo.error);
  }

  const first = firstNameOf(orig.shippingName);
  const titles = joinTitles(row.body.items.map((i) => orig.items.find((x) => x.id === i.id)?.title || ""));
  const lines =
    action === "approve"
      ? [`Hi ${first},`, `Good news: we're reprinting ${titles} for you, free. We'll email tracking when it ships.`, note, "No need to send the old one back."]
      : action === "refund"
        ? [`Hi ${first},`, `We're refunding you for ${titles} instead of reprinting it. It goes back to your original payment method and can take 5 to 10 days to show.`, note]
        : [`Hi ${first},`, `Thank you for the photos of ${titles}. We looked closely and can't offer a reprint this time.`, note, "If we got this wrong, just reply and tell us more."];
  const subject = action === "approve" ? "Your free reprint is on its way" : action === "refund" ? "Your refund" : "About your print";
  await sendBuyer(orig.email, subject, lines.filter(Boolean)).catch((err) => console.error("Reprint outcome email failed", err));
  return { status, reprintOrderId: decision.reprintOrderId ?? null };
}

async function sendBuyer(to: string, subject: string, paras: string[]) {
  if (!to) return;
  const text = paras.join("\n\n");
  const { error } = await resend.emails.send({ from: FROM, to, subject, html: emailHtml(`${text}\n\nArtfinity`), text: `${text}\n\nArtfinity` });
  if (error) throw error;
}
