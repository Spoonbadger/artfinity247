// Print lab work orders, sent automatically when an order is paid (webhook + test checkout) or a free reprint is
// approved (lib/reprints.ts). Server only. Never throws: a failed send is recorded on the order and shown in
// /admin/orders with a Retry button; checkout carries on either way.
//
// Provider, from env PRINTER_PROVIDER:
//   "email"  Email the lab a work order at PRINTER_EMAIL (the default when PRINTER_EMAIL is set). Without
//            PRINTER_EMAIL outside production, the work order is printed to the server log instead (dev).
//   "none"   Do nothing: tick "Sent to printer" by hand, like before (the default in production without PRINTER_EMAIL).
//   "prodigi" Create the order in Prodigi's Print API (prodigi.com, v4). Also chosen by PRINTER_PROVIDER=api with
//            PRINTER_API=prodigi. Needs PRODIGI_API_KEY and PRODIGI_SKUS (lib/prodigi.ts, DEPLOY.md "Prodigi").
//            Prodigi then calls /api/webhook/prodigi as the order moves (printing, shipped with tracking, complete,
//            cancelled) and the daily prodigi-sync job polls open orders in case a callback is missed (lib/prodigiSync.ts).
//   "api"    Without PRINTER_API=prodigi: reserved for another lab with an API. Fails loudly (apiProvider below).
//
// State lives on the order (no extra columns):
//   printerSentAt  when the last work order went out automatically
//   printerRef     "<provider>:<ref>" after a send ("prodigi:ord_123" for Prodigi), "sending:<ms>" while one is in flight, "failed: <reason>" after a failure
//   sentToPrinter  set true on a successful send (the same flag the manual toggle sets)
//
// The lab can't log in, so the email carries signed links that expire after LINK_DAYS: the original file per print
// (/api/printer/originals/<orderItemId>) and the packing slip (/api/printer/slip/<orderId>).
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emailEnabled, resend } from "@/lib/resend";
import { PARCEL_TAG, emailHtml } from "@/lib/artistEmails";
import { certUrl } from "@/lib/certificates";
import { editionLabel } from "@/lib/editionFormat";
import { normalizeSize } from "@/lib/sales";
import { SIZE_LABEL, sizeInches, type PrintSize } from "@/components/art/pricing";
import { alertKey, raiseAlert, resolveAlerts } from "@/lib/alerts";
import { workOrderAlert } from "@/lib/alertBuilders";
import { buildOrderPayload, createOrder, parseSkuMap, shippingMethod, type SizeCode } from "@/lib/prodigi";

const SECRET = process.env.SCAN_SIGNING_SECRET || process.env.JWT_SECRET || "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const FROM = process.env.PRINTER_FROM || "Artfinity <orders@theartfinity.com>";
const REPLY_TO = process.env.PRINTER_REPLY_TO || "craig@theartfinity.com";
/** What every print is made on (same words as the certificate). PRINTER_PAPER overrides it. */
const PAPER = process.env.PRINTER_PAPER || "12-color giclée on smooth matte, FSC-certified 310gsm archival paper, ½-inch white border";

/** How long the lab's download and slip links work. */
export const LINK_DAYS = 14;
const SIZE_KEY: Record<string, PrintSize> = { S: "small", M: "medium", L: "large", XL: "xl" };

// ---------- Signed links for the lab ----------

const sign = (what: string, exp: number) => crypto.createHmac("sha256", SECRET).update(`printer:${what}:${exp}`).digest("base64url").slice(0, 32);

function signedQuery(what: string, days = LINK_DAYS) {
  const exp = Math.floor(Date.now() / 1000) + days * 86_400;
  return `e=${exp}&t=${sign(what, exp)}`;
}

/** True when `t` signs `what` and `e` (unix seconds) hasn't passed. */
export function verifyPrinterLink(what: string, e: unknown, t: unknown): boolean {
  const exp = Number(e);
  if (!SECRET || typeof t !== "string" || !Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const want = Buffer.from(sign(what, exp));
  const got = Buffer.from(t);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export const originalLink = (itemId: string) => `${APP_URL}/api/printer/originals/${itemId}?${signedQuery(`orig:${itemId}`)}`;
export const slipLink = (orderId: string) => `${APP_URL}/api/printer/slip/${orderId}?${signedQuery(`slip:${orderId}`)}`;
/** How long the lab's "enter tracking" link works (shipping can take longer than the file links). */
export const TRACKING_LINK_DAYS = 45;
/** The lab's form for this order's carrier + tracking number (app/api/printer/tracking). */
export const labTrackingLink = (orderId: string) => `${APP_URL}/api/printer/tracking?o=${orderId}&${signedQuery(`track:${orderId}`, TRACKING_LINK_DAYS)}`;

// ---------- The work order ----------

export const orderNumber = (orderId: string) => orderId.slice(-8).toUpperCase();

export type WorkOrderItem = {
  id: string;
  title: string;
  artist: string;
  size: string;
  /** S, M, L or XL (lib/sales normalizeSize), for labs that need a product code. */
  sizeCode: SizeCode;
  /** Frame colour (black, white, natural), or null for a print without a frame. */
  frameColor: string | null;
  inches: string;
  paper: string;
  frame: string;
  quantity: number;
  edition: string;
  originalUrl: string | null;
  certificateUrl: string | null;
};

export type WorkOrder = {
  orderId: string;
  number: string;
  placedAt: Date;
  reprintOf: string | null;
  bulk: boolean;
  shipName: string;
  shipAddress: string;
  /** The order's own name and address (null when missing), for labs that need them as fields. */
  rawShipName: string | null;
  rawShipAddress: string | null;
  email: string;
  items: WorkOrderItem[];
  parcelNotes: { artist: string; body: string }[];
  slipUrl: string;
};

/** Everything the lab needs for one order, or null when it isn't an order to print (unpaid). */
export async function buildWorkOrder(orderId: string): Promise<WorkOrder | null> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, createdAt: true, kind: true, paymentStatus: true, stripeSessionId: true, email: true, shippingName: true, shippingAddress: true,
      items: {
        select: {
          id: true, title: true, size: true, frameChosen: true, frameColor: true, quantity: true, editionNumber: true, imageUrl: true, artistName: true,
          artwork: { select: { title: true, editionSize: true, artist: { select: { artist_name: true, name: true } } } },
        },
      },
    },
  });
  if (!o || !printable(o)) return null;
  const notes = o.kind === "reprint" ? [] : await prisma.message.findMany({
    where: { orderId: o.id, direction: "out", subject: { startsWith: PARCEL_TAG } },
    orderBy: { createdAt: "asc" },
    select: { body: true, artist: { select: { artist_name: true, name: true } } },
  });
  const reprintOf = o.kind === "reprint" ? o.stripeSessionId.split(":")[1] || null : null;
  return {
    orderId: o.id,
    number: orderNumber(o.id),
    placedAt: o.createdAt,
    reprintOf,
    bulk: o.kind === "bulk",
    shipName: o.shippingName || "(no name)",
    shipAddress: o.shippingAddress || "(no address)",
    rawShipName: o.shippingName,
    rawShipAddress: o.shippingAddress,
    email: o.email,
    items: o.items.map((it) => {
      const sizeCode = normalizeSize(it.size);
      const size = SIZE_KEY[sizeCode] ?? "medium";
      const qty = Math.max(1, it.quantity ?? 1);
      const editionSize = it.artwork?.editionSize ?? null;
      return {
        id: it.id,
        title: it.artwork?.title || it.title || "Untitled",
        artist: it.artwork?.artist.artist_name || it.artwork?.artist.name || it.artistName || "",
        size: SIZE_LABEL[size],
        sizeCode,
        frameColor: it.frameChosen ? (it.frameColor || "black").toLowerCase() : null,
        inches: sizeInches(size),
        paper: PAPER,
        frame: it.frameChosen ? `${(it.frameColor || "black").replace(/^./, (c) => c.toUpperCase())} frame` : "No frame (print only)",
        quantity: qty,
        edition: editionLabel(it.editionNumber, qty, editionSize) || "Open edition",
        originalUrl: it.imageUrl ? originalLink(it.id) : null,
        // Certificates exist for paid edition lines; a reprint keeps the buyer's original certificate.
        certificateUrl: o.paymentStatus === "paid" && it.editionNumber && editionSize ? certUrl(it.id) : null,
      };
    }),
    parcelNotes: notes.map((n) => ({ artist: n.artist.artist_name || n.artist.name, body: n.body })),
    slipUrl: slipLink(o.id),
  };
}

const printable = (o: { paymentStatus: string; kind: string }) => o.paymentStatus === "paid" || o.kind === "reprint";

export function workOrderText(wo: WorkOrder): { subject: string; text: string } {
  const prints = wo.items.reduce((n, i) => n + i.quantity, 0);
  const lines: string[] = [];
  lines.push(`Work order #${wo.number}`);
  lines.push(`Artfinity order ${wo.orderId}, placed ${wo.placedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`);
  if (wo.reprintOf) lines.push(`FREE REPRINT: replacement for order #${orderNumber(wo.reprintOf)}. Please print with extra care.`);
  if (wo.bulk) lines.push("Artist's own order (bulk). Ship to the artist below.");
  lines.push("");
  lines.push(`SHIP TO\n${wo.shipName}\n${wo.shipAddress}`);
  lines.push("");
  lines.push(`PRINTS: ${prints} ${prints === 1 ? "print" : "prints"}`);
  wo.items.forEach((i, k) => {
    lines.push("");
    lines.push(`${k + 1}. "${i.title}"${i.artist ? ` by ${i.artist}` : ""}`);
    lines.push(`   Size: ${i.size}, ${i.inches}`);
    lines.push(`   Paper: ${i.paper}`);
    lines.push(`   Frame: ${i.frame}`);
    lines.push(`   Quantity: ${i.quantity}`);
    lines.push(`   Edition: ${i.edition}`);
    lines.push(`   Original file (link works ${LINK_DAYS} days): ${i.originalUrl ?? "missing, we'll send it separately"}`);
    if (i.certificateUrl) lines.push(`   Certificate of authenticity (print it and put it in the parcel): ${i.certificateUrl}`);
  });
  if (wo.parcelNotes.length) {
    lines.push("");
    lines.push("PARCEL NOTE: print this and put it in the parcel");
    for (const n of wo.parcelNotes) lines.push(`"${n.body.trim()}"\n— ${n.artist}`);
  }
  lines.push("");
  lines.push(`Packing slip: ${wo.slipUrl}`);
  lines.push("");
  lines.push(`Reply with tracking: ${labTrackingLink(wo.orderId)}`);
  lines.push("(Once it ships, enter the carrier and tracking number there. The buyer gets the tracking email right away.)");
  lines.push("");
  lines.push("Questions or a problem with a file? Reply to this email.");
  const subject = `${wo.reprintOf ? "Reprint" : "Work order"} #${wo.number}: ${prints} ${prints === 1 ? "print" : "prints"} for ${wo.shipName}`;
  return { subject, text: lines.join("\n") };
}

// ---------- Providers ----------

type ProviderId = "email" | "none" | "api" | "prodigi";

interface PrinterProvider {
  id: ProviderId;
  /** Sends the work order. Returns the lab's reference (or ours). Throws on failure. `force`: an admin's resend. */
  send(wo: WorkOrder, opts?: { force?: boolean }): Promise<string>;
}

const emailProvider: PrinterProvider = {
  id: "email",
  async send(wo) {
    const { subject, text } = workOrderText(wo);
    const to = process.env.PRINTER_EMAIL?.trim();
    if (!to) {
      if (process.env.NODE_ENV === "production") throw new Error("PRINTER_EMAIL isn't set.");
      console.log(`[email:dev] work order (set PRINTER_EMAIL to send it to the lab)\nSubject: ${subject}\n\n${text}\n[/email:dev]`);
      return "dev";
    }
    const { data, error } = await resend.emails.send({ from: FROM, to: to.split(/\s*,\s*/), replyTo: REPLY_TO, subject, text, html: emailHtml(text, "Sent by Artfinity") });
    if (error) throw new Error(typeof error === "object" && "message" in error ? String(error.message) : "Email failed");
    if (!emailEnabled) console.log(`[email:dev] work order body\n${text}\n[/email:dev]`);
    return data?.id || "sent";
  },
};

/** The URL Prodigi calls on order changes, or null without PRODIGI_WEBHOOK_TOKEN (then only the poller updates it). */
export function prodigiCallbackUrl(): string | null {
  const token = process.env.PRODIGI_WEBHOOK_TOKEN?.trim();
  return token ? `${APP_URL}/api/webhook/prodigi?token=${encodeURIComponent(token)}` : null;
}

/**
 * Prodigi (lib/prodigi.ts). The idempotency key is our order id, so a retry after a send that reached Prodigi but
 * wasn't saved here gets the same Prodigi order back instead of a second print. An admin's "Resend work order" is a
 * deliberate second print, so it gets a fresh key.
 */
const prodigiProvider: PrinterProvider = {
  id: "prodigi",
  async send(wo, opts) {
    const { map, error } = parseSkuMap(process.env.PRODIGI_SKUS);
    if (error) throw new Error(`${error} See DEPLOY.md, Prodigi.`);
    const callbackUrl = prodigiCallbackUrl();
    if (!callbackUrl) console.warn("[printer:prodigi] PRODIGI_WEBHOOK_TOKEN isn't set: no callback URL, status comes from the daily prodigi-sync job only");
    const payload = buildOrderPayload(
      {
        orderId: wo.orderId,
        number: wo.number,
        shipName: wo.rawShipName,
        shipAddress: wo.rawShipAddress,
        reprintOf: wo.reprintOf,
        items: wo.items.map((i) => ({ id: i.id, title: i.title, size: i.sizeCode, frame: i.frameColor, quantity: i.quantity, assetUrl: i.originalUrl })),
      },
      {
        skus: map,
        shippingMethod: shippingMethod(),
        callbackUrl,
        idempotencyKey: opts?.force ? `${wo.orderId}-r${Date.now()}` : wo.orderId,
        packingSlipUrl: (process.env.PRODIGI_PACKING_SLIP || "").trim().toLowerCase() === "on" ? wo.slipUrl : null,
      },
    );
    const r = await createOrder(payload);
    if (r.outcome && r.outcome !== "Created") console.log(`[printer:prodigi] order #${wo.number}: ${r.outcome} (${r.id})`);
    return r.id;
  },
};

/** PRINTER_PROVIDER=api without PRINTER_API=prodigi: no other API lab is built, so it fails loudly. */
const apiProvider: PrinterProvider = {
  id: "api",
  async send() {
    throw new Error("PRINTER_PROVIDER=api needs PRINTER_API=prodigi (the only API lab built). Or use PRINTER_PROVIDER=email.");
  },
};

/** The provider in use, or null for "none" (manual). */
export function activeProvider(): PrinterProvider | null {
  const raw = (process.env.PRINTER_PROVIDER || "").trim().toLowerCase();
  const id = raw || (process.env.PRINTER_EMAIL || process.env.NODE_ENV !== "production" ? "email" : "none");
  if (id === "none") return null;
  if (id === "email") return emailProvider;
  if (id === "prodigi" || (id === "api" && (process.env.PRINTER_API || "").trim().toLowerCase() === "prodigi")) return prodigiProvider;
  return apiProvider;
}

/** True when work orders go to Prodigi (the webhook, poller and admin page use it). */
export const usingProdigi = () => activeProvider()?.id === "prodigi";

export const printerAuto = () => activeProvider() !== null;

// ---------- Sending ----------

export type PrinterState = { status: "none" | "sending" | "sent" | "failed"; at: string | null; error: string | null };

const STUCK_MS = 5 * 60_000;

const sendingSince = (ref: string) => Number(ref.split(":")[1]) || 0;

/** What admin orders shows for the automatic send. A send stuck "sending" for 5 minutes counts as failed. */
export function printerState(o: { printerSentAt: Date | null; printerRef: string | null }, now = Date.now()): PrinterState {
  const at = o.printerSentAt ? o.printerSentAt.toISOString() : null;
  const ref = o.printerRef || "";
  if (ref.startsWith("failed")) return { status: "failed", at, error: ref.replace(/^failed:\s*/, "") || "Unknown error" };
  if (ref.startsWith("sending")) {
    return now - sendingSince(ref) > STUCK_MS ? { status: "failed", at, error: "The send didn't finish." } : { status: "sending", at, error: null };
  }
  return o.printerSentAt ? { status: "sent", at, error: null } : { status: "none", at: null, error: null };
}

export type SendResult = { status: "sent" | "skipped" | "failed"; ref?: string; error?: string; reason?: string };

/**
 * Sends the order's work order to the lab. Automatic calls send once per order; `force` (admin "Resend") sends again.
 * Never throws.
 */
export async function sendWorkOrder(orderId: string, opts: { force?: boolean } = {}): Promise<SendResult> {
  const provider = activeProvider();
  if (!provider) return { status: "skipped", reason: "PRINTER_PROVIDER is none" };
  try {
    // Claim it, so a webhook retry and a test checkout (or two admins) can't send the same order twice.
    let where: Prisma.OrderWhereInput = { id: orderId, printerSentAt: null, OR: [{ printerRef: null }, { printerRef: { startsWith: "failed" } }] };
    if (opts.force) {
      const cur = await prisma.order.findUnique({ where: { id: orderId }, select: { printerRef: true } });
      if (!cur) return { status: "skipped", reason: "Order not found" };
      if (cur.printerRef?.startsWith("sending") && Date.now() - sendingSince(cur.printerRef) < STUCK_MS) return { status: "skipped", reason: "A send is already in progress" };
      where = { id: orderId, printerRef: cur.printerRef };
    }
    const { count } = await prisma.order.updateMany({ where, data: { printerRef: `sending:${Date.now()}` } });
    if (!count) return { status: "skipped", reason: opts.force ? "A send is already in progress" : "Already sent" };

    let wo: WorkOrder | null;
    try {
      wo = await buildWorkOrder(orderId);
    } catch (err) {
      await markFailed(orderId, err);
      throw err;
    }
    if (!wo) {
      await prisma.order.update({ where: { id: orderId }, data: { printerRef: null } });
      return { status: "skipped", reason: "Not a paid order" };
    }
    try {
      const ref = await provider.send(wo, { force: opts.force });
      await prisma.order.update({ where: { id: orderId }, data: { printerSentAt: new Date(), printerRef: `${provider.id}:${ref}`.slice(0, 190), sentToPrinter: true } });
      console.log(`[printer] work order #${wo.number} sent (${provider.id}:${ref})`);
      await resolveAlerts([alertKey.workOrderFailed(orderId), alertKey.orderStuck(orderId), alertKey.printLabCancelled(orderId), alertKey.printLabProblem(orderId)]);
      return { status: "sent", ref };
    } catch (err) {
      const error = await markFailed(orderId, err);
      return { status: "failed", error };
    }
  } catch (err) {
    console.error("[printer] sendWorkOrder failed", orderId, err);
    return { status: "failed", error: (err as Error)?.message || "Send failed" };
  }
}

async function markFailed(orderId: string, err: unknown): Promise<string> {
  const error = ((err as Error)?.message || "Send failed").replace(/\s+/g, " ").slice(0, 300);
  console.error(`[printer] work order for ${orderId} failed: ${error}`);
  await prisma.order.update({ where: { id: orderId }, data: { printerRef: `failed: ${error}` } }).catch(() => {});
  await raiseAlert(workOrderAlert(orderId, error));
  return error;
}
