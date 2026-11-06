// Painting scanning service, server half (lib/scanning.ts is the pure half): settings, bookings, the admin steps,
// payment, delivering scan files onto artworks, and the emails that go with each step. Server only.
//
// Settings live in the admin settings snapshot (lib/adminSettings.ts) under `scanning`. SCANNING_SERVICE=1|0 in the
// environment wins for the on/off switch; without either, the service is on in development and off in production.
// Fields the owner hasn't set yet stay placeholders (lib/scanning.ts SCAN_FIELDS) and are marked "set by Craig" in the admin.
import Stripe from "stripe";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { readAdminSettings, writeAdminSettings, type AdminSettings } from "@/lib/adminSettings";
import { resend } from "@/lib/resend";
import { emailHtml, firstNameOf } from "@/lib/artistEmails";
import { raiseAlert, resolveAlert } from "@/lib/alerts";
import { logAdminAction, type AuditAdmin } from "@/lib/audit";
import { artistUploadTarget, processUpload } from "@/lib/uploadPipeline";
import { deleteUpload } from "@/lib/storage";
import { hashForImageUrl } from "@/lib/imageHash";
import { checkoutUnavailable, testCheckoutAllowed } from "@/lib/testCheckout";
import { splitOriginal } from "@/lib/originalSize";
import { SITE_URL } from "@/lib/urls";
import { statementSuffix } from "@/lib/checkoutSession";
import { PRINT_SIZES, SIZE_LABEL, sizeInches, type PrintSize } from "@/components/art/pricing";
import {
  BAND_KEYS, DEFAULT_BANDS, MAX_SCAN_PIECES, SCAN_DEFAULTS, SCAN_FIELDS, bandFor, bandLabel, dayLabel, estimate, isDay, isItemBand, usd,
  type Handoff, type ItemBand, type ScanBand, type ScanField, type ScanSettings, type ScanStatus,
} from "@/lib/scanning";

const FROM = "Artfinity <notifications@theartfinity.com>";
const APP = () => (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, "");

// ---------- Settings ----------

type RawSettings = Partial<{
  enabled: boolean;
  bands: ScanBand[];
  pickupFeeCents: number | null;
  turnaroundDays: number;
  returnDays: number;
  dropoffAddress: string;
  careText: string;
  confirmed: ScanField[];
}>;

const cents = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? n : null;
};
const days = (v: unknown, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 120 ? n : fallback;
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");

/** Bands from storage or a form: the three keys in order, each bigger than the last. Bad input falls back to the defaults. */
export function cleanBands(raw: unknown): ScanBand[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ScanBand[] = [];
  for (const key of BAND_KEYS) {
    const r = raw.find((b) => b && typeof b === "object" && (b as ScanBand).key === key) as Partial<ScanBand> | undefined;
    const d = DEFAULT_BANDS.find((b) => b.key === key)!;
    const maxShort = Number(r?.maxShort), maxLong = Number(r?.maxLong);
    out.push({
      key,
      label: text(r?.label, 24) || d.label,
      maxShort: Number.isFinite(maxShort) && maxShort >= 4 && maxShort <= 200 ? Math.round(maxShort) : d.maxShort,
      maxLong: Number.isFinite(maxLong) && maxLong >= 4 && maxLong <= 200 ? Math.round(maxLong) : d.maxLong,
      priceCents: cents(r?.priceCents),
    });
  }
  for (const b of out) if (b.maxShort > b.maxLong) [b.maxShort, b.maxLong] = [b.maxLong, b.maxShort];
  for (let i = 1; i < out.length; i++) {
    if (out[i].maxShort < out[i - 1].maxShort || out[i].maxLong < out[i - 1].maxLong) return null;
  }
  return out;
}

async function rawSettings(): Promise<RawSettings> {
  const s = (await readAdminSettings()) as Record<string, unknown>;
  return s.scanning && typeof s.scanning === "object" ? (s.scanning as RawSettings) : {};
}

export async function readScanSettings(): Promise<ScanSettings> {
  const raw = await rawSettings().catch(() => ({}) as RawSettings);
  const env = process.env.SCANNING_SERVICE?.trim();
  const envOn = env === "1" || env === "true" ? true : env === "0" || env === "false" ? false : null;
  const confirmed = new Set((Array.isArray(raw.confirmed) ? raw.confirmed : []).filter((f) => (SCAN_FIELDS as readonly string[]).includes(f)));
  return {
    enabled: envOn ?? (typeof raw.enabled === "boolean" ? raw.enabled : process.env.NODE_ENV !== "production"),
    enabledSource: envOn !== null ? "env" : typeof raw.enabled === "boolean" ? "saved" : "default",
    bands: cleanBands(raw.bands) ?? DEFAULT_BANDS,
    pickupFeeCents: confirmed.has("pickupFee") ? cents(raw.pickupFeeCents) : SCAN_DEFAULTS.pickupFeeCents,
    turnaroundDays: days(raw.turnaroundDays, SCAN_DEFAULTS.turnaroundDays),
    returnDays: days(raw.returnDays, SCAN_DEFAULTS.returnDays),
    dropoffAddress: text(raw.dropoffAddress, 600) || SCAN_DEFAULTS.dropoffAddress,
    careText: text(raw.careText, 800) || SCAN_DEFAULTS.careText,
    placeholders: SCAN_FIELDS.filter((f) => !confirmed.has(f)),
  };
}

export type ScanSettingsInput = Partial<Omit<RawSettings, "confirmed">> & { confirm?: ScanField[] };

/** Saves a patch. Fields in `confirm` stop being placeholders. */
export async function writeScanSettings(input: ScanSettingsInput, by: AuditAdmin & { email?: string | null }) {
  const before = await rawSettings();
  const next: RawSettings = { ...before };
  if (typeof input.enabled === "boolean") next.enabled = input.enabled;
  if (input.bands !== undefined) {
    const bands = cleanBands(input.bands);
    if (!bands) throw new Error("Each size band has to be at least as big as the one before it.");
    next.bands = bands;
  }
  if (input.pickupFeeCents !== undefined) next.pickupFeeCents = cents(input.pickupFeeCents);
  if (input.turnaroundDays !== undefined) next.turnaroundDays = days(input.turnaroundDays, SCAN_DEFAULTS.turnaroundDays);
  if (input.returnDays !== undefined) next.returnDays = days(input.returnDays, SCAN_DEFAULTS.returnDays);
  if (input.dropoffAddress !== undefined) next.dropoffAddress = text(input.dropoffAddress, 600);
  if (input.careText !== undefined) next.careText = text(input.careText, 800);
  const confirm = (input.confirm ?? []).filter((f) => (SCAN_FIELDS as readonly string[]).includes(f));
  next.confirmed = Array.from(new Set([...(before.confirmed ?? []), ...confirm]));
  await writeAdminSettings({ scanning: next } as Record<string, unknown> as AdminSettings, { id: by.id, email: by.email ?? undefined });
  return next;
}

// ---------- Artist-facing data ----------

export const ACTIVE: ScanStatus[] = ["requested", "confirmed", "paid", "scanning"];

const bookingSelect = {
  id: true, artistId: true, status: true, handoff: true, pickupAddress: true, preferredDates: true, notes: true, estimateCents: true, priceCents: true,
  scheduledFor: true, dropoffInfo: true, adminNote: true, stripeSessionId: true, confirmedAt: true, paidAt: true, receivedAt: true, scanningAt: true,
  deliveredAt: true, returnedAt: true, cancelledAt: true, cancelReason: true, createdAt: true,
  items: { orderBy: { id: "asc" as const }, select: { id: true, artworkId: true, title: true, band: true, widthIn: true, heightIn: true, scanUrl: true, previousImageUrl: true, previousPrintable: true, printableSizes: true, deliveredAt: true } },
} as const;

export type BookingRow = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

export function loadBooking(id: string) {
  return prisma.scanBooking.findUnique({ where: { id }, select: bookingSelect });
}

export function bookingsFor(artistId: string) {
  return prisma.scanBooking.findMany({ where: { artistId }, orderBy: { createdAt: "desc" }, take: 30, select: bookingSelect });
}

/** Artwork slugs, titles and thumbnails for a set of bookings. */
export async function artworksFor(bookings: { items: { artworkId: string | null }[] }[]) {
  const ids = Array.from(new Set(bookings.flatMap((b) => b.items.map((i) => i.artworkId).filter((x): x is string => !!x))));
  if (!ids.length) return new Map<string, { id: string; slug: string | null; title: string; imageUrl: string; printableSizes: string[]; artistId: string }>();
  const rows = await prisma.artwork.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, title: true, imageUrl: true, printableSizes: true, artistId: true } });
  return new Map(rows.map((r) => [r.id, r]));
}

/** The biggest print size in a list, e.g. "18 × 24 in" (null when none). */
export function largestOf(sizes: string[]): { name: string; inches: string } | null {
  const best = [...PRINT_SIZES].reverse().find((s) => sizes.includes(s));
  return best ? { name: SIZE_LABEL[best], inches: sizeInches(best) } : null;
}

/** A checked upload too small for the biggest print size (empty = never checked, so not counted). */
export function limitedSizes(printableSizes: string[]): boolean {
  const biggest: PrintSize = PRINT_SIZES[PRINT_SIZES.length - 1];
  return printableSizes.length > 0 && !printableSizes.includes(biggest);
}

// ---------- Emails ----------

async function mailArtist(artistId: string, subject: string, body: (first: string) => string, key?: string) {
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { email: true, first_name: true, name: true } });
  if (!a?.email) return;
  const textBody = body(a.first_name || firstNameOf(a.name));
  await resend.emails
    .send({ from: FROM, to: a.email, subject, text: textBody, html: emailHtml(textBody) }, key ? { idempotencyKey: key } : undefined)
    .catch((err) => console.error("[scanning] email failed", subject, err));
}

const studioLink = (id: string) => `${APP()}/studio/scanning?booking=${id}`;
const when = (d: Date | null) => (d ? dayLabel(d, { weekday: "long", month: "long", day: "numeric" }) : "the date we agree");
const handoffLine = (b: { handoff: string; pickupAddress: string | null; dropoffInfo: string | null; scheduledFor: Date | null }) =>
  b.handoff === "pickup" ? `We'll pick them up on ${when(b.scheduledFor)} from:\n${b.pickupAddress || "the address you gave us"}` : `Drop them off on ${when(b.scheduledFor)}:\n${b.dropoffInfo || "we'll send the address"}`;

// ---------- Create (artist) ----------

export class ScanError extends Error {
  constructor(message: string, public code: string, public status = 400) { super(message); }
}

export type NewBookingInput = {
  artworks?: { artworkId?: unknown; band?: unknown }[];
  newPieces?: { band?: unknown; count?: unknown }[];
  handoff?: unknown;
  pickupAddress?: unknown;
  preferredDates?: unknown;
  notes?: unknown;
};

const MAX_PIECES = MAX_SCAN_PIECES;
// The five boroughs' ZIPs start 100-104 and 110-116.
const NYC_ZIP = /\b1(?:0[0-4]|1[0-6])\d{2}\b/;

export async function createBooking(artistId: string, input: NewBookingInput) {
  const s = await readScanSettings();
  if (!s.enabled) throw new ScanError("Scanning isn't open yet. Join the waitlist and we'll email you when it is.", "scanning_off", 403);

  const picked = (Array.isArray(input.artworks) ? input.artworks : []).slice(0, MAX_PIECES);
  const ids = Array.from(new Set(picked.map((p) => String(p?.artworkId ?? "")).filter(Boolean)));
  const arts = ids.length
    ? await prisma.artwork.findMany({ where: { id: { in: ids }, artistId, status: { not: "REJECTED" } }, select: { id: true, title: true, description: true } })
    : [];
  if (arts.length !== ids.length) throw new ScanError("One of those pieces isn't yours any more. Refresh and pick again.", "not_your_art", 403);
  const busy = ids.length
    ? await prisma.scanBookingItem.findFirst({ where: { artworkId: { in: ids }, booking: { status: { in: ACTIVE } } }, select: { artworkId: true } })
    : null;
  if (busy) {
    const t = arts.find((a) => a.id === busy.artworkId)?.title ?? "One of those pieces";
    throw new ScanError(`${t} is already in a scan booking.`, "scan_already_booked", 409);
  }
  const byId = new Map(arts.map((a) => [a.id, a]));
  const items: { artworkId: string | null; title: string | null; band: ItemBand; widthIn: number | null; heightIn: number | null }[] = [];
  for (const id of ids) {
    const a = byId.get(id)!;
    const p = picked.find((x) => String(x?.artworkId) === id);
    const { original } = splitOriginal(a.description);
    const band = isItemBand(p?.band) ? p!.band : original ? bandFor(original.w, original.h, s.bands) : null;
    if (!band) throw new ScanError(`Pick a size for ${a.title}.`, "scan_size_missing");
    items.push({ artworkId: id, title: a.title, band, widthIn: original?.w ?? null, heightIn: original?.h ?? null });
  }
  for (const g of (Array.isArray(input.newPieces) ? input.newPieces : []).slice(0, 4)) {
    const count = Math.round(Number(g?.count));
    if (!count) continue;
    if (!isItemBand(g?.band) || count < 0 || count > MAX_PIECES) throw new ScanError("Check the pieces you haven't uploaded yet: a size and a count.", "scan_new_pieces");
    for (let i = 0; i < count; i++) items.push({ artworkId: null, title: null, band: g!.band as ItemBand, widthIn: null, heightIn: null });
  }
  if (!items.length) throw new ScanError("Pick at least one painting to scan.", "scan_no_pieces");
  if (items.length > MAX_PIECES) throw new ScanError(`Up to ${MAX_PIECES} paintings per booking. Book the rest separately.`, "scan_too_many");

  const handoff: Handoff = input.handoff === "pickup" ? "pickup" : "dropoff";
  const pickupAddress = handoff === "pickup" ? text(input.pickupAddress, 300) : "";
  if (handoff === "pickup" && !pickupAddress) throw new ScanError("Add the pickup address, with the ZIP code.", "scan_pickup_address");
  if (handoff === "pickup" && !NYC_ZIP.test(pickupAddress)) throw new ScanError("Pickup is for the five NYC boroughs. Add a NYC ZIP code, or choose drop-off.", "scan_pickup_nyc");

  const today = new Date().toISOString().slice(0, 10);
  const dates = Array.from(new Set((Array.isArray(input.preferredDates) ? input.preferredDates : []).filter(isDay))).filter((d) => d >= today).sort().slice(0, 3);
  if (!dates.length) throw new ScanError("Pick at least one day that works for you.", "scan_dates");

  const est = estimate(items, handoff, s);
  const booking = await prisma.scanBooking.create({
    data: {
      artistId, handoff, pickupAddress: pickupAddress || null, preferredDates: dates, notes: text(input.notes, 1000) || null,
      estimateCents: est.complete ? est.knownCents : null,
      items: { create: items },
    },
    select: { id: true },
  });

  const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { name: true, artist_name: true } });
  const who = artist?.artist_name || artist?.name || "An artist";
  await raiseAlert({ kind: "scan_booking", key: `scan_booking:${booking.id}`, title: `${who} booked a scan: ${items.length} ${items.length === 1 ? "painting" : "paintings"}, ${handoff === "pickup" ? "NYC pickup" : "drop-off"}`, link: `/admin/scanning/${booking.id}` });
  await mailArtist(
    artistId,
    "We got your scan request",
    (first) =>
      `Hi ${first},\n\nThanks for booking a scan of ${items.length} ${items.length === 1 ? "painting" : "paintings"}. We'll look at your dates and confirm a day and the final price, usually within a business day.\n\n` +
      `When we confirm, you'll get an email and a "pay" button in your Studio. Nothing is charged until then.\n\nYour booking: ${studioLink(booking.id)}\n\nArtfinity`,
    `scan-requested-${booking.id}`,
  );
  return booking;
}

/** The artist cancels before paying. */
export async function artistCancel(artistId: string, id: string) {
  const { count } = await prisma.scanBooking.updateMany({ where: { id, artistId, status: { in: ["requested", "confirmed"] } }, data: { status: "cancelled", cancelledAt: new Date(), cancelReason: "Cancelled by the artist" } });
  if (!count) throw new ScanError("This booking can't be cancelled here any more. Message us and we'll sort it out.", "scan_not_cancellable", 409);
  await resolveAlert(`scan_booking:${id}`);
  await raiseAlert({ kind: "scan_booking", key: `scan_booking_cancelled:${id}`, title: "An artist cancelled a scan booking", link: `/admin/scanning/${id}`, severity: "low", instant: false });
}

// ---------- Payment ----------

function baseUrl(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  try { return new URL(req.url).origin; } catch { return SITE_URL; }
}

/**
 * Checkout for a confirmed booking: Stripe Checkout when STRIPE_SECRET_KEY is set (the orders webhook and the return
 * page mark it paid), otherwise, where test checkout is allowed (lib/testCheckout.ts), it's marked paid right away.
 */
export async function scanCheckout(req: Request, artistId: string, id: string): Promise<Response> {
  const b = await prisma.scanBooking.findFirst({ where: { id, artistId }, select: { id: true, status: true, priceCents: true, items: { select: { id: true } } } });
  if (!b) return Response.json({ error: "We couldn't find that booking.", code: "scan_not_found" }, { status: 404 });
  if (b.status !== "confirmed" || b.priceCents == null) return Response.json({ error: b.status === "requested" ? "We haven't confirmed the price yet. You'll get an email when we do." : "This booking is already paid.", code: "scan_not_payable" }, { status: 409 });
  const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { email: true } });

  if (!process.env.STRIPE_SECRET_KEY) {
    if (!testCheckoutAllowed()) return checkoutUnavailable("scan");
    await markScanPaid(b.id, `dev_scan_${randomBytes(10).toString("hex")}`);
    return Response.json({ url: `/studio/scanning?paid=${b.id}`, dev: true });
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
    const base = baseUrl(req);
    const n = b.items.length;
    const ref = `SC-${b.id.slice(-6).toUpperCase()}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "pay",
      locale: "en",
      customer_email: artist?.email,
      expires_at: Math.floor(Date.now() / 1000) + 2 * 3600,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: b.priceCents, product_data: { name: `Painting scans — ${n} ${n === 1 ? "painting" : "paintings"}`, description: "Scanned in NYC. The files go straight onto your artworks." } } }],
      metadata: { kind: "scan", scanBookingId: b.id },
      payment_intent_data: { description: `Artfinity painting scans ${ref}`, statement_descriptor_suffix: statementSuffix(ref.replace(/^SC-/, "")), metadata: { scanBookingId: b.id } },
      custom_text: { submit: { message: `Booking ${ref}. Paying locks in your scan date.` } },
      success_url: `${base}/studio/scanning?booking=${b.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/studio/scanning?booking=${b.id}&canceled=1`,
    });
    await prisma.scanBooking.update({ where: { id: b.id }, data: { stripeSessionId: session.id } });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[scanning] Stripe session failed", err);
    return Response.json({ error: "Checkout didn't open. Try again.", code: "server_error" }, { status: 500 });
  }
}

/** Confirmed -> paid, once. Safe to call from the webhook and the return page both. */
export async function markScanPaid(id: string, sessionId: string): Promise<boolean> {
  const { count } = await prisma.scanBooking.updateMany({ where: { id, status: "confirmed" }, data: { status: "paid", paidAt: new Date(), stripeSessionId: sessionId } });
  if (!count) return false;
  const b = await loadBooking(id);
  if (b) {
    await mailArtist(
      b.artistId,
      `Paid: your scan is booked for ${when(b.scheduledFor)}`,
      (first) => `Hi ${first},\n\nThanks, you've paid ${usd(b.priceCents ?? 0)} for painting scans (${b.items.length} ${b.items.length === 1 ? "painting" : "paintings"}, no sales tax). Here's what happens next.\n\n${handoffLine(b)}\n\nOnce your paintings are with us, the files go straight onto your artworks and we'll email you when they're in.\n\nYour booking: ${studioLink(b.id)}\n\nQuestions? Write to support@theartfinity.com.\n\nArtfinity`,
      `scan-paid-${b.id}`,
    );
  }
  return true;
}

/** The Stripe return page: marks the booking paid if the session really is paid (in case the webhook is slow). */
export async function verifyScanSession(artistId: string, sessionId: string) {
  if (!process.env.STRIPE_SECRET_KEY || !sessionId.startsWith("cs_")) return;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    const id = s.metadata?.kind === "scan" ? s.metadata.scanBookingId : null;
    if (!id || s.payment_status !== "paid") return;
    const b = await prisma.scanBooking.findFirst({ where: { id, artistId }, select: { id: true } });
    if (b) await markScanPaid(b.id, s.id);
  } catch (err) {
    console.error("[scanning] session check failed", err);
  }
}

// ---------- Admin steps ----------

export type AdminStep = "confirm" | "received" | "scanning" | "delivered" | "returned" | "cancel" | "note";
export const ADMIN_STEPS: AdminStep[] = ["confirm", "received", "scanning", "delivered", "returned", "cancel", "note"];

type StepInput = { date?: unknown; price?: unknown; dropoffInfo?: unknown; reason?: unknown; note?: unknown };

export async function adminStep(id: string, step: AdminStep, input: StepInput, admin: AuditAdmin) {
  const b = await loadBooking(id);
  if (!b) throw new ScanError("Booking not found.", "scan_not_found", 404);
  const now = new Date();
  const artist = await prisma.artist.findUnique({ where: { id: b.artistId }, select: { name: true, artist_name: true } });
  const who = artist?.artist_name || artist?.name || "artist";
  const audit = (summary: string, details?: Record<string, unknown>) => logAdminAction(admin, `scan.${step}`, { type: "scan", id }, summary, details);
  const need = (ok: boolean, msg: string) => { if (!ok) throw new ScanError(msg, "scan_bad_step", 409); };

  switch (step) {
    case "confirm": {
      need(b.status === "requested" || b.status === "confirmed", "Only a new or unpaid booking can be confirmed.");
      const date = String(input.date ?? "");
      if (!isDay(date)) throw new ScanError("Pick the drop-off or pickup date.", "scan_date");
      const dollars = parseFloat(String(input.price ?? "").replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(dollars) || dollars < 0 || dollars > 10000) throw new ScanError("Enter the final price in dollars.", "scan_price");
      const priceCents = Math.round(dollars * 100);
      const s = await readScanSettings();
      const dropoffInfo = text(input.dropoffInfo, 600) || (b.handoff === "dropoff" ? s.dropoffAddress : "") || null;
      if (b.handoff === "dropoff" && !dropoffInfo) throw new ScanError("Add the drop-off address and instructions (or set a default in Settings → Scanning).", "scan_dropoff");
      const free = priceCents === 0;
      await prisma.scanBooking.update({
        where: { id },
        data: { status: free ? "paid" : "confirmed", scheduledFor: new Date(`${date}T12:00:00Z`), priceCents, dropoffInfo, confirmedAt: b.confirmedAt ?? now, ...(free ? { paidAt: now } : {}) },
      });
      await resolveAlert(`scan_booking:${id}`);
      const fresh = (await loadBooking(id))!;
      await mailArtist(
        b.artistId,
        free ? `Your scan is confirmed for ${when(fresh.scheduledFor)}` : `Your scan is confirmed — pay ${usd(priceCents)}`,
        (first) =>
          free
            ? `Hi ${first},\n\nYour scan is confirmed, and there's nothing to pay.\n\n${handoffLine(fresh)}\n\nYour booking: ${studioLink(id)}\n\nArtfinity`
            : `Hi ${first},\n\nYour scan of ${b.items.length} ${b.items.length === 1 ? "painting" : "paintings"} is confirmed for ${when(fresh.scheduledFor)}. The final price is ${usd(priceCents)}.\n\nPay here to lock in the date: ${studioLink(id)}\n\n${handoffLine(fresh)}\n\nArtfinity`,
        `scan-confirmed-${id}-${priceCents}-${date}`,
      );
      await audit(`Confirmed ${who}'s scan for ${date} at ${usd(priceCents)}`, { from: b.status, priceCents, date, dropoffInfo });
      return;
    }
    case "received": {
      need(["confirmed", "paid", "scanning"].includes(b.status) && !b.receivedAt, b.receivedAt ? "Already marked received." : "Confirm the booking first.");
      await prisma.scanBooking.update({ where: { id }, data: { receivedAt: now } });
      const s = await readScanSettings();
      await mailArtist(
        b.artistId,
        "We have your paintings",
        (first) =>
          `Hi ${first},\n\nYour ${b.items.length === 1 ? "painting is" : `${b.items.length} paintings are`} safely with us${b.status === "confirmed" ? ". There's still a payment waiting in your Studio before we scan" : ""}. Files should be on your artworks within ${s.turnaroundDays} days, and we'll give the paintings back within ${s.returnDays} days.\n\nYour booking: ${studioLink(id)}\n\nArtfinity`,
        `scan-received-${id}`,
      );
      await audit(`Received ${who}'s paintings`);
      return;
    }
    case "scanning": {
      need(b.status === "paid", b.status === "confirmed" ? "Waiting for the artist to pay." : "Only a paid booking can start scanning.");
      await prisma.scanBooking.update({ where: { id }, data: { status: "scanning", scanningAt: now, receivedAt: b.receivedAt ?? now } });
      await audit(`Started scanning ${who}'s paintings`);
      return;
    }
    case "delivered": {
      need(b.status === "scanning" || b.status === "paid", "Start scanning first.");
      const missing = b.items.filter((i) => i.artworkId && !i.scanUrl);
      if (missing.length) throw new ScanError(`Upload the scan for ${missing.length === 1 ? "the last piece" : `${missing.length} pieces`} first.`, "scan_files_missing");
      if (!b.items.some((i) => i.scanUrl)) throw new ScanError("Upload at least one scan before marking it delivered.", "scan_files_missing");
      await prisma.scanBooking.update({ where: { id }, data: { status: "delivered", deliveredAt: now } });
      const arts = await artworksFor([b]);
      const best = largestOf(b.items.flatMap((i) => i.printableSizes));
      const titles = b.items.filter((i) => i.scanUrl && i.artworkId).map((i) => arts.get(i.artworkId!)?.title).filter(Boolean) as string[];
      const loose = b.items.filter((i) => !i.artworkId).length;
      await mailArtist(
        b.artistId,
        best ? `Your scans are in — you can now sell up to ${best.inches}` : "Your scans are in",
        (first) =>
          `Hi ${first},\n\nYour new scans are on your artworks${titles.length ? `: ${titles.join(", ")}` : ""}.${best ? ` Buyers can now order prints up to ${best.name} (${best.inches}).` : ""}\n\n` +
          `${loose ? `We also scanned ${loose} ${loose === 1 ? "piece" : "pieces"} that ${loose === 1 ? "isn't" : "aren't"} on Artfinity yet. Upload ${loose === 1 ? "it" : "them"} and reply to this email, and we'll attach the scans.\n\n` : ""}` +
          `See your art: ${APP()}/studio/art\n\nArtfinity`,
        `scan-delivered-${id}`,
      );
      await audit(`Delivered ${who}'s scans`, { items: b.items.filter((i) => i.scanUrl).length });
      return;
    }
    case "returned": {
      need(b.status === "delivered", "Mark the scans delivered first.");
      await prisma.scanBooking.update({ where: { id }, data: { status: "returned", returnedAt: now } });
      // The old images are no longer needed for an undo: remove them unless an order still prints from them.
      for (const it of b.items) {
        if (!it.previousImageUrl) continue;
        const [ordered, inUse] = await Promise.all([prisma.orderItem.count({ where: { imageUrl: it.previousImageUrl } }), prisma.artwork.count({ where: { imageUrl: it.previousImageUrl } })]);
        if (!ordered && !inUse) await deleteUpload(it.previousImageUrl).catch(() => {});
        await prisma.scanBookingItem.update({ where: { id: it.id }, data: { previousImageUrl: null } });
      }
      await mailArtist(b.artistId, "Your paintings are back with you", (first) => `Hi ${first},\n\nThis closes your scan booking: your paintings are back with you. Thanks for trusting us with them.\n\nYour new print sizes are live on your page. Time to hang a code next to the big ones: ${APP()}/studio/qr\n\nArtfinity`, `scan-returned-${id}`);
      await audit(`Returned ${who}'s paintings`);
      return;
    }
    case "cancel": {
      need(b.status !== "returned" && b.status !== "cancelled", "This booking is already closed.");
      const reason = text(input.reason, 300) || "Cancelled by Artfinity";
      await prisma.scanBooking.update({ where: { id }, data: { status: "cancelled", cancelledAt: now, cancelReason: reason } });
      await resolveAlert(`scan_booking:${id}`);
      await mailArtist(
        b.artistId,
        "Your scan booking was cancelled",
        (first) => `Hi ${first},\n\nWe've cancelled your scan booking. ${reason}\n\n${b.paidAt ? "You paid for this booking, so we'll refund it in full to the card you used.\n\n" : ""}Book again anytime: ${APP()}/studio/scanning\n\nArtfinity`,
        `scan-cancelled-${id}`,
      );
      await audit(`Cancelled ${who}'s scan booking`, { from: b.status, reason, refundNeeded: !!b.paidAt });
      return;
    }
    case "note": {
      const note = text(input.note, 1000);
      await prisma.scanBooking.update({ where: { id }, data: { adminNote: note || null } });
      await audit(`Updated the note on ${who}'s scan booking`);
      return;
    }
  }
}

// ---------- Delivering scan files ----------

/** Max size of one scan file (bigger than artist uploads: scans are large). */
export const SCAN_MAX_BYTES = 120 * 1024 * 1024;

/**
 * Puts a scan file onto the item's artwork through the normal upload pipeline (private original + 1600px preview,
 * printable sizes measured), replacing its image. The previous image is kept until the booking is returned, so it can
 * be undone. `artworkId` links a "not uploaded yet" item to one of the artist's artworks first.
 */
export async function deliverScan(itemId: string, buf: Buffer, fileName: string, admin: AuditAdmin, artworkId?: string | null) {
  const item = await prisma.scanBookingItem.findUnique({ where: { id: itemId }, select: { id: true, artworkId: true, scanUrl: true, previousImageUrl: true, previousPrintable: true, booking: { select: { id: true, status: true, artistId: true } } } });
  if (!item) throw new ScanError("That painting isn't in a booking.", "scan_not_found", 404);
  if (!["paid", "scanning", "delivered"].includes(item.booking.status)) throw new ScanError(item.booking.status === "confirmed" ? "Waiting for the artist to pay before delivering files." : "This booking isn't open for files.", "scan_bad_step", 409);
  const targetId = item.artworkId || artworkId || null;
  if (!targetId) throw new ScanError("Pick which of the artist's artworks this scan is for.", "scan_pick_artwork");
  const [art, artist] = await Promise.all([
    prisma.artwork.findUnique({ where: { id: targetId }, select: { id: true, artistId: true, title: true, imageUrl: true, printableSizes: true } }),
    prisma.artist.findUnique({ where: { id: item.booking.artistId }, select: { id: true, slug: true } }),
  ]);
  if (!art || !artist || art.artistId !== artist.id) throw new ScanError("That artwork isn't this artist's.", "not_your_art", 403);
  if (!item.artworkId) {
    const taken = await prisma.scanBookingItem.findFirst({ where: { bookingId: item.booking.id, artworkId: art.id, NOT: { id: item.id } }, select: { id: true } });
    if (taken) throw new ScanError(`${art.title} already has a scan in this booking.`, "scan_already_booked", 409);
  }

  const up = await processUpload(buf, fileName, artistUploadTarget({ id: artist.id, slug: artist.slug }));
  if (!up.printable.length) {
    await deleteUpload(up.url).catch(() => {});
    throw new ScanError(`That file is only ${up.width} × ${up.height} px, too small to print. Export the full-resolution scan.`, "image_too_small");
  }
  const imageHash = await hashForImageUrl(up.url).catch(() => null);
  // Replacing an earlier scan of this item: the original is still previousImageUrl; the earlier scan goes.
  const replacingScan = !!item.scanUrl && art.imageUrl === item.scanUrl;
  const previousImageUrl = item.previousImageUrl ?? (replacingScan ? null : art.imageUrl);
  const previousPrintable = item.previousImageUrl ? item.previousPrintable : art.printableSizes;

  await prisma.$transaction([
    prisma.artwork.update({ where: { id: art.id }, data: { imageUrl: up.url, printableSizes: up.printable, ...(imageHash ? { imageHash } : {}) } }),
    prisma.scanBookingItem.update({
      where: { id: item.id },
      data: { artworkId: art.id, title: item.artworkId ? undefined : art.title, scanUrl: up.url, previousImageUrl, previousPrintable, printableSizes: up.printable, deliveredAt: new Date() },
    }),
  ]);
  if (replacingScan && item.scanUrl) {
    const ordered = await prisma.orderItem.count({ where: { imageUrl: item.scanUrl } });
    if (!ordered) await deleteUpload(item.scanUrl).catch(() => {});
  }
  await logAdminAction(admin, "scan.file", { type: "scan", id: item.booking.id }, `Put a scan on “${art.title}”: ${up.width} × ${up.height} px, prints ${up.printable.join(", ")}`, {
    itemId: item.id, artworkId: art.id, before: art.printableSizes, after: up.printable, previousImageUrl, scanUrl: up.url,
  });
  return { url: up.url, width: up.width, height: up.height, printable: up.printable, before: art.printableSizes };
}

/** Puts the artwork's previous image back (only while the booking isn't returned yet). */
export async function undoScan(itemId: string, admin: AuditAdmin) {
  const item = await prisma.scanBookingItem.findUnique({ where: { id: itemId }, select: { id: true, artworkId: true, scanUrl: true, previousImageUrl: true, previousPrintable: true, booking: { select: { id: true, status: true } } } });
  if (!item?.scanUrl || !item.artworkId) throw new ScanError("There's no scan on this painting to undo.", "scan_nothing_to_undo", 409);
  if (!item.previousImageUrl) throw new ScanError("The previous image is gone (the booking was returned), so this can't be undone. Upload a different file instead.", "scan_nothing_to_undo", 409);
  const art = await prisma.artwork.findUnique({ where: { id: item.artworkId }, select: { id: true, title: true, imageUrl: true } });
  if (art && art.imageUrl === item.scanUrl) {
    const imageHash = await hashForImageUrl(item.previousImageUrl).catch(() => null);
    await prisma.artwork.update({ where: { id: art.id }, data: { imageUrl: item.previousImageUrl, printableSizes: item.previousPrintable, ...(imageHash ? { imageHash } : {}) } });
  }
  await prisma.scanBookingItem.update({ where: { id: item.id }, data: { scanUrl: null, previousImageUrl: null, previousPrintable: [], printableSizes: [], deliveredAt: null } });
  const ordered = await prisma.orderItem.count({ where: { imageUrl: item.scanUrl } });
  if (!ordered) await deleteUpload(item.scanUrl).catch(() => {});
  await logAdminAction(admin, "scan.undo", { type: "scan", id: item.booking.id }, `Took the scan off “${art?.title ?? "an artwork"}” and put the previous image back`, { itemId: item.id, artworkId: item.artworkId });
}

// ---------- Waitlist ----------

export async function joinWaitlist(email: string, source: "public" | "studio", artistId?: string | null) {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 200) throw new ScanError("Enter an email address like you@example.com.", "bad_email");
  await prisma.scanWaitlist.upsert({ where: { email: e }, create: { email: e, source, artistId: artistId ?? null }, update: artistId ? { artistId } : {} });
}

export const bandName = (band: string, bands: ScanBand[]) => bandLabel((isItemBand(band) ? band : "oversized") as ItemBand, bands);
