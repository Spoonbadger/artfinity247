// lib/billing.ts (server only)
// Infinity billing through Stripe Billing: Checkout in subscription mode, the Customer Portal, and the webhook
// handlers (app/api/webhook/billing/route.ts). Setup steps: BILLING_SETUP.md.
//
// One rule ties it to the rest of the app: a subscription only ever moves Artist.proUntil. While it's active or
// trialing, proUntil = the end of the paid period + BILLING.graceDays. When it's cancelled, proUntil = the period end
// (they keep what they paid for). isProActive(proUntil) stays the single check for Infinity features and for the
// split locked onto each new order (lib/revenue.ts artistSplitsForOrder), so past orders never change.
//
// Referral months stack, and are never charged twice:
//   • Subscribing with referral (or granted) time left: the subscription starts with trial_end = the current
//     proUntil, so the first charge is the day the free months run out.
//   • Earning months while subscribed: proUntil grows (lib/referrals.ts), then extendForProUntil() pushes the
//     subscription's next charge (trial_end, no proration) to the new proUntil minus the grace days.
//   • A later proUntil than the subscription's own (state.subProUntil) is never cut back by a subscription event.
//
// State without schema changes: one Message row per artist, direction "billing", email "billing:infinity", body =
// BillingState JSON (customer id, subscription id, status, period end, failure). The Stripe Customer also carries
// metadata.artistId, so it can be found again by search if the row is ever lost.
//
// Without STRIPE_SECRET_KEY, on localhost or a staging site (same gate as test checkout, lib/testCheckout.ts, and
// never on a Vercel production deploy) billing is SIMULATED: simulate() runs fake subscription objects through the
// same code the webhooks use.
import Stripe from "stripe";
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripeOrNull } from "@/lib/stripeConnect";
import { testCheckoutAllowed } from "@/lib/testCheckout";
import { BILLING, FREE_SPLIT, PRO, addDays, addMonths, dollars, formatPlanDate, isProActive, pct } from "@/lib/plans";
import { BILLING_TAX_ENABLED, SUBSCRIPTION_TAX_CODE } from "@/lib/tax";
import { EMPTY_BILLING, billingView, hasLiveSubscription, type BillingState } from "@/lib/billingStatus";
import { raiseAlert, resolveAlerts } from "@/lib/alerts";
import { resend } from "@/lib/resend";
import { emailHtml, firstNameOf } from "@/lib/artistEmails";

export type { BillingState, BillingView } from "@/lib/billingStatus";

const DIRECTION = "billing";
const STATE_EMAIL = "billing:infinity";
const FROM = "Artfinity <notifications@theartfinity.com>";
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const SIM_PREFIX = "sim_";
const DAY = 86_400_000;

// ---------- Mode and prices ----------

/** "live": real Stripe. "simulated": no keys, localhost or staging. "off": no keys in production. */
export type BillingMode = "live" | "simulated" | "off";
export function billingMode(): BillingMode {
  if (process.env.STRIPE_SECRET_KEY) return "live";
  return testCheckoutAllowed() && process.env.VERCEL_ENV !== "production" ? "simulated" : "off";
}

export type Interval = "month" | "year";
/** Intervals on offer: monthly always; yearly only when STRIPE_INFINITY_YEARLY_PRICE_ID is set. */
export function billingIntervals(): Interval[] {
  return process.env.STRIPE_INFINITY_YEARLY_PRICE_ID ? ["month", "year"] : ["month"];
}

function lineItem(interval: Interval): Stripe.Checkout.SessionCreateParams.LineItem {
  const priceId = interval === "year" ? process.env.STRIPE_INFINITY_YEARLY_PRICE_ID : process.env.STRIPE_INFINITY_PRICE_ID;
  if (priceId) return { price: priceId, quantity: 1 };
  if (interval === "year") throw new BillingError("Yearly billing isn't set up.", 400);
  // No Price in Stripe yet: an inline monthly price from lib/plans.ts.
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: PRO.priceCents,
      recurring: { interval: "month" },
      tax_behavior: "exclusive",
      product_data: { name: `Artfinity ${PRO.name}`, tax_code: SUBSCRIPTION_TAX_CODE, metadata: { kind: "infinity" } },
    },
  };
}

export class BillingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const isSim = (id: string | null | undefined) => !!id && id.includes(SIM_PREFIX);
const unix = (d: Date) => Math.floor(d.getTime() / 1000);
const fromUnix = (n: number | null | undefined) => (n ? new Date(n * 1000) : null);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const idOf = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id ?? null);

function stripe(): Stripe {
  const s = stripeOrNull();
  if (!s) throw new BillingError("Billing isn't set up yet.", 503);
  return s;
}

// ---------- State (one Message row per artist) ----------

function parseState(body: string | null | undefined): BillingState {
  try {
    return { ...EMPTY_BILLING, ...JSON.parse(body || "{}") };
  } catch {
    return { ...EMPTY_BILLING };
  }
}

type Db = typeof prisma | Prisma.TransactionClient;

/** The artist's billing state. A simulated state reads as empty once real keys are set (and the other way round). */
export async function getBillingState(artistId: string, db: Db = prisma): Promise<BillingState> {
  const row = await db.message.findFirst({ where: { artistId, direction: DIRECTION, email: STATE_EMAIL }, select: { body: true } });
  const s = parseState(row?.body);
  const mode = billingMode();
  if (s.subscriptionId && s.simulated !== (mode === "simulated")) return { ...EMPTY_BILLING, customerId: s.simulated ? null : s.customerId };
  return s;
}

async function saveBillingState(artistId: string, patch: Partial<BillingState>, db: Db = prisma): Promise<BillingState> {
  const row = await db.message.findFirst({ where: { artistId, direction: DIRECTION, email: STATE_EMAIL }, select: { id: true, body: true } });
  const next: BillingState = { ...parseState(row?.body), ...patch, updatedAt: new Date().toISOString() };
  const body = JSON.stringify(next);
  if (row) await db.message.update({ where: { id: row.id }, data: { body } });
  else await db.message.create({ data: { artistId, email: STATE_EMAIL, direction: DIRECTION, subject: "Infinity billing", body } });
  return next;
}

/** The artist whose billing row has this Stripe customer id, or null. */
async function artistForCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const row = await prisma.message.findFirst({
    where: { direction: DIRECTION, email: STATE_EMAIL, body: { contains: `"customerId":${JSON.stringify(customerId)}` } },
    select: { artistId: true },
  });
  return row?.artistId ?? null;
}

/** Every artist's billing state (admin: MRR and lists). */
export async function allBillingStates(): Promise<{ artistId: string; state: BillingState }[]> {
  const rows = await prisma.message.findMany({ where: { direction: DIRECTION, email: STATE_EMAIL }, select: { artistId: true, body: true } });
  const sim = billingMode() === "simulated";
  return rows.map((r) => ({ artistId: r.artistId, state: parseState(r.body) })).filter((r) => r.state.subscriptionId && r.state.simulated === sim);
}

// ---------- Applying a subscription (webhooks, checkout return, simulation) ----------

/** What we read from a Stripe Subscription. Real ones fit; simulated ones are built to match. */
export type SubLike = {
  id: string;
  status: string;
  customer: string | { id: string } | null;
  metadata?: Record<string, string> | null;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
  ended_at?: number | null;
  trial_end?: number | null;
  items?: { data: { current_period_end?: number | null; price?: { recurring?: { interval?: string } | null } | null }[] };
};

function subPeriodEnd(sub: SubLike): Date | null {
  const ends = (sub.items?.data ?? []).map((i) => i.current_period_end ?? 0).filter(Boolean);
  const end = ends.length ? Math.max(...ends) : sub.trial_end ?? 0;
  return fromUnix(end);
}

const subInterval = (sub: SubLike): Interval => (sub.items?.data?.[0]?.price?.recurring?.interval === "year" ? "year" : "month");

/** What proUntil should become for this subscription, or undefined to leave it alone. Pure. */
export function proUntilFor(sub: SubLike, now = new Date()): Date | undefined {
  const periodEnd = subPeriodEnd(sub);
  if (sub.status === "active" || sub.status === "trialing") {
    if (!periodEnd) return undefined;
    const cancelAt = fromUnix(sub.cancel_at);
    if (sub.cancel_at_period_end) return periodEnd; // keeps what they paid for, no grace
    if (cancelAt) return cancelAt < periodEnd ? cancelAt : periodEnd;
    return addDays(periodEnd, BILLING.graceDays);
  }
  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    const ended = fromUnix(sub.ended_at) ?? now;
    return periodEnd && periodEnd < ended ? periodEnd : ended;
  }
  // past_due / unpaid / incomplete / paused: no new paid time. The grace days already on proUntil run out.
  return undefined;
}

/**
 * The stacking rule. `current` = Artist.proUntil, `owned` = the proUntil this subscription set last time.
 * If current is the subscription's own, it follows the subscription (it can shrink, e.g. on cancel: grace goes).
 * If something else made it later (referral months, an admin grant), the later date wins.
 */
export function stackProUntil(current: Date | null, owned: Date | null, target: Date): Date {
  if (!current) return target;
  if (owned && current.getTime() <= owned.getTime() + 60_000) return target;
  return current > target ? current : target;
}

/**
 * Brings the artist's billing state and proUntil in line with a subscription. Locks the artist row, so webhooks
 * arriving together can't interleave. Returns the new proUntil.
 */
export async function applySubscription(sub: SubLike, opts: { artistId?: string | null; eventCreated?: number; now?: Date } = {}): Promise<{ artistId: string; proUntil: Date | null } | null> {
  const now = opts.now ?? new Date();
  const customerId = idOf(sub.customer);
  const artistId = opts.artistId || sub.metadata?.artistId || (await artistForCustomer(customerId));
  if (!artistId) {
    console.warn("BILLING_UNKNOWN_SUBSCRIPTION", sub.id, customerId);
    return null;
  }
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Artist" WHERE id = ${artistId} FOR UPDATE`;
    if (!locked.length) return null;
    const artist = await tx.artist.findUnique({ where: { id: artistId }, select: { proUntil: true } });
    const state = await getBillingState(artistId, tx);
    // A late, older event for the same subscription must not undo a newer one.
    if (opts.eventCreated && state.subscriptionId === sub.id && state.eventAt && opts.eventCreated < state.eventAt) {
      return { artistId, proUntil: artist?.proUntil ?? null };
    }
    const target = proUntilFor(sub, now);
    const current = artist?.proUntil ?? null;
    const proUntil = target === undefined ? current : stackProUntil(current, state.subscriptionId === sub.id && state.subProUntil ? new Date(state.subProUntil) : null, target);
    const ended = sub.status === "canceled" || sub.status === "incomplete_expired";
    const paid = sub.status === "active" || sub.status === "trialing";
    await tx.artist.update({
      where: { id: artistId },
      data: { proUntil, ...(paid ? { plan: "PRO" as const } : ended ? { plan: "FREE" as const } : {}) },
    });
    const periodEnd = subPeriodEnd(sub);
    await saveBillingState(artistId, {
      customerId: customerId ?? state.customerId,
      subscriptionId: sub.id,
      status: sub.status,
      interval: subInterval(sub),
      periodEnd: iso(periodEnd),
      trialEnd: sub.status === "trialing" ? iso(fromUnix(sub.trial_end) ?? periodEnd) : null,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end || !!sub.cancel_at,
      endedAt: ended ? iso(fromUnix(sub.ended_at) ?? now) : null,
      subProUntil: target === undefined ? state.subProUntil : iso(target),
      simulated: isSim(sub.id),
      eventAt: opts.eventCreated ?? state.eventAt,
      // Paid up again (or it ended): the failure is over.
      ...(paid || ended ? { paymentFailedAt: null, failedInvoiceId: null } : {}),
    }, tx);
    if (paid || ended) await resolveAlerts({ prefix: failedAlertPrefix(artistId) });
    console.info("BILLING_APPLIED", JSON.stringify({ artistId, sub: sub.id, status: sub.status, proUntil: iso(proUntil) }));
    return { artistId, proUntil };
  });
}

// ---------- Payment failure ----------

const failedAlertPrefix = (artistId: string) => `billing_failed:${artistId}:`;

/**
 * invoice.payment_failed: mark the failure, and once per invoice email the artist and raise a low admin alert.
 * Infinity stays on until proUntil (the paid period + grace days) while Stripe retries.
 */
export async function recordPaymentFailure(artistId: string, invoiceId: string, now = new Date()): Promise<{ first: boolean }> {
  const state = await getBillingState(artistId);
  const first = state.failedInvoiceId !== invoiceId;
  await saveBillingState(artistId, { paymentFailedAt: first ? now.toISOString() : state.paymentFailedAt ?? now.toISOString(), failedInvoiceId: invoiceId, status: state.status === "active" ? "past_due" : state.status });
  if (!first) return { first };
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { email: true, first_name: true, artist_name: true, name: true, proUntil: true } });
  if (!a) return { first };
  const name = a.artist_name || a.name;
  const keeps = isProActive(a, now) ? ` You keep ${PRO.name} (and ${pct(PRO.split)} of profit) until ${formatPlanDate(a.proUntil!)} while we try again.` : "";
  const text = `Hi ${a.first_name || firstNameOf(name)},\n\nYour ${dollars(PRO.priceCents)} ${PRO.name} payment didn't go through.${keeps}\n\nUpdate your card here:\n${APP_URL()}/studio/infinity\n\nIf the payment still can't be taken, your plan goes back to Free and new sales pay ${pct(FREE_SPLIT)}. Your art, page, codes and links all stay.\n\nArtfinity`;
  try {
    const { error } = await resend.emails.send({ from: FROM, to: a.email, subject: `Your ${PRO.name} payment didn't go through`, text, html: emailHtml(text) });
    if (error) throw error;
  } catch (err) {
    console.error("BILLING_FAILED_EMAIL", artistId, err);
  }
  await raiseAlert({ kind: "billing_failed", key: `${failedAlertPrefix(artistId)}${invoiceId}`, title: `${PRO.name} payment failed: ${name} (${a.email})`, link: `/admin/artists/${artistId}`, severity: "low" });
  return { first };
}

// ---------- Webhook events ----------

export type BillingDeps = {
  /** Fetch the latest subscription (live webhooks use Stripe; tests leave it out and the event's copy is used). */
  retrieveSubscription?: (id: string) => Promise<SubLike>;
};

export const BILLING_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

const isInfinitySession = (s: Stripe.Checkout.Session) => s.mode === "subscription" && (s.metadata?.kind === "infinity" || !!s.client_reference_id);

function invoiceSubscription(inv: Stripe.Invoice): { id: string | null; artistId: string | null } {
  const det = inv.parent?.subscription_details;
  const legacy = (inv as unknown as { subscription?: string | { id: string } | null }).subscription;
  return { id: idOf(det?.subscription ?? legacy ?? null), artistId: det?.metadata?.artistId || null };
}

/** Handles one Stripe event (signature already checked by the route). Safe to receive twice. */
export async function handleBillingEvent(event: Stripe.Event, deps: BillingDeps = {}): Promise<{ handled: boolean; artistId?: string | null; note?: string }> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (!isInfinitySession(s)) return { handled: false, note: "not an Infinity checkout" };
      const artistId = s.client_reference_id || s.metadata?.artistId || null;
      if (!artistId || !(await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true } }))) return { handled: false, note: "unknown artist" };
      const customerId = idOf(s.customer as string | { id: string } | null);
      const subId = idOf(s.subscription as string | { id: string } | null);
      await saveBillingState(artistId, { customerId, ...(subId ? { subscriptionId: subId } : {}) });
      const sub = typeof s.subscription === "object" && s.subscription ? (s.subscription as SubLike) : subId && deps.retrieveSubscription ? await deps.retrieveSubscription(subId) : null;
      if (sub) await applySubscription(sub, { artistId });
      return { handled: true, artistId };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const snap = event.data.object as Stripe.Subscription;
      const known = snap.metadata?.kind === "infinity" || !!snap.metadata?.artistId || !!(await artistForCustomer(idOf(snap.customer)));
      if (!known) return { handled: false, note: "not an Infinity subscription" };
      const sub = event.type !== "customer.subscription.deleted" && deps.retrieveSubscription ? await deps.retrieveSubscription(snap.id) : snap;
      // Re-fetched subscriptions are current, so ordering doesn't matter for them; event copies use event.created.
      const res = await applySubscription(sub, { eventCreated: sub === snap ? event.created : undefined });
      return { handled: !!res, artistId: res?.artistId };
    }
    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      const ref = invoiceSubscription(inv);
      if (!ref.id) return { handled: false, note: "not a subscription invoice" };
      const artistId = ref.artistId || (await artistForCustomer(idOf(inv.customer)));
      if (!artistId) return { handled: false, note: "unknown customer" };
      if (deps.retrieveSubscription) await applySubscription(await deps.retrieveSubscription(ref.id), { artistId });
      const state = await getBillingState(artistId);
      if (state.paymentFailedAt || state.failedInvoiceId) await saveBillingState(artistId, { paymentFailedAt: null, failedInvoiceId: null, ...(state.status === "past_due" || state.status === "unpaid" ? { status: "active" } : {}) });
      await resolveAlerts({ prefix: failedAlertPrefix(artistId) });
      return { handled: true, artistId };
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const ref = invoiceSubscription(inv);
      if (!ref.id) return { handled: false, note: "not a subscription invoice" };
      const artistId = ref.artistId || (await artistForCustomer(idOf(inv.customer)));
      if (!artistId) return { handled: false, note: "unknown customer" };
      if (deps.retrieveSubscription) await applySubscription(await deps.retrieveSubscription(ref.id), { artistId });
      await recordPaymentFailure(artistId, inv.id ?? `inv_${event.id}`);
      return { handled: true, artistId };
    }
    default:
      return { handled: false, note: `ignored ${event.type}` };
  }
}

/** Live retriever for the webhook route. */
export const liveDeps = (): BillingDeps => ({
  retrieveSubscription: async (id) => (await stripe().subscriptions.retrieve(id)) as unknown as SubLike,
});

// ---------- Customer, Checkout, Portal (live) ----------

/** The artist's Stripe Customer: the stored id, else one found by metadata.artistId, else a new one. */
export async function ensureCustomer(artistId: string): Promise<string> {
  const s = stripe();
  const state = await getBillingState(artistId);
  if (state.customerId && !isSim(state.customerId)) {
    try {
      const c = await s.customers.retrieve(state.customerId);
      if (!("deleted" in c && c.deleted)) return c.id;
    } catch (err) {
      console.warn("BILLING_CUSTOMER_MISSING", state.customerId, (err as Error).message);
    }
  }
  const found = await s.customers.search({ query: `metadata['artistId']:'${artistId.replace(/'/g, "")}'`, limit: 1 }).catch(() => null);
  let id = found?.data?.[0]?.id;
  if (!id) {
    const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { email: true, artist_name: true, name: true, slug: true } });
    if (!a) throw new BillingError("Artist not found.", 404);
    const c = await s.customers.create(
      { email: a.email, name: a.artist_name || a.name, metadata: { artistId, handle: a.slug } },
      { idempotencyKey: `infinity-customer-${artistId}` },
    );
    id = c.id;
  }
  await saveBillingState(artistId, { customerId: id });
  return id;
}

/**
 * A Stripe Checkout URL for Infinity. With referral or granted months left (49+ hours), the subscription starts
 * as a trial that ends when they do, so the first charge comes after the free months.
 */
export async function createCheckout(artistId: string, interval: Interval, baseUrl: string): Promise<string> {
  if (billingMode() !== "live") throw new BillingError("Billing isn't set up yet.", 503);
  if (!billingIntervals().includes(interval)) throw new BillingError("That billing period isn't offered.", 400);
  const state = await getBillingState(artistId);
  if (hasLiveSubscription(state)) throw new BillingError("You already have an Infinity subscription. Use Manage billing.", 409);
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { proUntil: true } });
  const now = new Date();
  const customer = await ensureCustomer(artistId);
  const trialEnd = a?.proUntil && a.proUntil.getTime() > now.getTime() + BILLING.minTrialHours * 3_600_000 ? a.proUntil : null;
  const metadata = { artistId, kind: "infinity", interval };
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: artistId,
    line_items: [lineItem(interval)],
    metadata,
    subscription_data: { metadata, ...(trialEnd ? { trial_end: unix(trialEnd) } : {}) },
    automatic_tax: { enabled: BILLING_TAX_ENABLED },
    // Stripe Tax needs an address; save what they type on the customer.
    ...(BILLING_TAX_ENABLED ? { billing_address_collection: "required" as const, customer_update: { address: "auto" as const, name: "auto" as const } } : {}),
    allow_promotion_codes: true,
    locale: "en",
    success_url: `${baseUrl}/studio/infinity?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/studio/infinity?billing=canceled`,
  });
  if (!session.url) throw new BillingError("Stripe didn't return a checkout page.", 502);
  console.info("BILLING_CHECKOUT", JSON.stringify({ artistId, interval, trialEnd: iso(trialEnd), session: session.id }));
  return session.url;
}

/** Back from Checkout: apply the subscription now instead of waiting for the webhook. Never throws. */
export async function confirmCheckout(artistId: string, sessionId: string): Promise<boolean> {
  if (billingMode() !== "live" || !/^cs_[\w]+$/.test(sessionId)) return false;
  try {
    const s = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    if (s.client_reference_id !== artistId || s.mode !== "subscription" || !s.subscription) return false;
    await saveBillingState(artistId, { customerId: idOf(s.customer as string | { id: string } | null) });
    await applySubscription(s.subscription as unknown as SubLike, { artistId });
    return true;
  } catch (err) {
    console.error("BILLING_CONFIRM_FAIL", sessionId, err);
    return false;
  }
}

/** A Stripe Customer Portal URL (cancel, update card, invoices). */
export async function createPortal(artistId: string, baseUrl: string): Promise<string> {
  if (billingMode() !== "live") throw new BillingError("Billing isn't set up yet.", 503);
  const state = await getBillingState(artistId);
  if (!state.customerId || isSim(state.customerId)) throw new BillingError("No billing account yet. Subscribe first.", 404);
  const portal = await stripe().billingPortal.sessions.create({
    customer: state.customerId,
    return_url: `${baseUrl}/studio/infinity`,
    ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID } : {}),
  });
  return portal.url;
}

// ---------- Stacking: months added while subscribed ----------

/**
 * proUntil just grew (referral reward or admin grant). If a subscription would charge before it runs out, push
 * its next charge to proUntil minus the grace days (trial_end, no proration). Never throws.
 */
export async function extendForProUntil(artistId: string): Promise<{ pushedTo: Date | null }> {
  try {
    const [state, a] = await Promise.all([getBillingState(artistId), prisma.artist.findUnique({ where: { id: artistId }, select: { proUntil: true } })]);
    if (!a?.proUntil || !hasLiveSubscription(state) || state.cancelAtPeriodEnd || (state.status !== "active" && state.status !== "trialing")) return { pushedTo: null };
    const billFrom = addDays(a.proUntil, -BILLING.graceDays);
    const periodEnd = state.periodEnd ? new Date(state.periodEnd) : null;
    if (!periodEnd || billFrom.getTime() <= periodEnd.getTime() + 3_600_000) return { pushedTo: null };
    if (state.simulated) {
      await applySubscription(simSub(artistId, state, { status: "trialing", periodEnd: billFrom, trialEnd: billFrom }), { artistId });
    } else {
      const sub = await stripe().subscriptions.update(state.subscriptionId!, { trial_end: unix(billFrom), proration_behavior: "none" });
      await applySubscription(sub as unknown as SubLike, { artistId });
    }
    console.info("BILLING_PUSHED_FOR_FREE_MONTHS", JSON.stringify({ artistId, billFrom: billFrom.toISOString() }));
    return { pushedTo: billFrom };
  } catch (err) {
    console.error("BILLING_EXTEND_FAIL", artistId, err);
    return { pushedTo: null };
  }
}

// ---------- Admin ----------

/** Admin: cancel at period end, cancel now (Infinity ends now, no refund), undo a cancel, or re-read from Stripe. */
export async function adminBillingAction(artistId: string, action: "cancel_at_period_end" | "cancel_now" | "resume" | "sync"): Promise<string> {
  const state = await getBillingState(artistId);
  if (!state.subscriptionId) throw new BillingError("No subscription.", 404);
  if (state.simulated) {
    const map = { cancel_at_period_end: "cancel", cancel_now: "end", resume: "resume", sync: null } as const;
    const sim = map[action];
    if (sim) await simulate(artistId, sim);
    return action === "sync" ? "Simulated subscription: nothing to sync" : "Done (simulated)";
  }
  const s = stripe();
  let sub: Stripe.Subscription;
  if (action === "cancel_now") sub = await s.subscriptions.cancel(state.subscriptionId, { prorate: false });
  else if (action === "cancel_at_period_end") sub = await s.subscriptions.update(state.subscriptionId, { cancel_at_period_end: true });
  else if (action === "resume") sub = await s.subscriptions.update(state.subscriptionId, { cancel_at_period_end: false });
  else sub = await s.subscriptions.retrieve(state.subscriptionId);
  await applySubscription(sub as unknown as SubLike, { artistId });
  return { cancel_now: "Subscription cancelled now", cancel_at_period_end: "Cancels at the end of the period", resume: "Cancellation undone", sync: "Synced from Stripe" }[action];
}

/** Admin dashboard: paying subscribers and MRR (PRO.priceCents a month, PRO.yearlyMonthlyCents for yearly). */
export async function billingOverview() {
  const states = await allBillingStates();
  let monthly = 0, yearly = 0, trialing = 0, failing = 0, cancelling = 0;
  for (const { state: s } of states) {
    if (s.status === "trialing") { trialing++; continue; }
    if (s.status !== "active" && s.status !== "past_due") continue;
    if (s.status === "past_due" || s.paymentFailedAt) failing++;
    if (s.cancelAtPeriodEnd) cancelling++;
    if (s.interval === "year") yearly++;
    else monthly++;
  }
  const infinityNow = await prisma.artist.count({ where: { proUntil: { gt: new Date() } } });
  return {
    paying: monthly + yearly,
    monthly,
    yearly,
    trialing,
    failing,
    cancelling,
    mrrCents: monthly * PRO.priceCents + yearly * PRO.yearlyMonthlyCents,
    infinityNow,
    simulated: billingMode() === "simulated",
  };
}

// ---------- Simulation (no Stripe keys; never in production) ----------

export type SimAction = "subscribe" | "cancel" | "resume" | "payment_failed" | "payment_fixed" | "end";

function simSub(artistId: string, state: BillingState, o: { status: string; periodEnd: Date; trialEnd?: Date | null; cancel?: boolean; endedAt?: Date | null; interval?: Interval }): SubLike {
  return {
    id: state.simulated && state.subscriptionId ? state.subscriptionId : `sub_${SIM_PREFIX}${randomBytes(8).toString("hex")}`,
    status: o.status,
    customer: state.simulated && state.customerId ? state.customerId : `cus_${SIM_PREFIX}${randomBytes(8).toString("hex")}`,
    metadata: { artistId, kind: "infinity" },
    cancel_at_period_end: !!o.cancel,
    cancel_at: null,
    ended_at: o.endedAt ? unix(o.endedAt) : null,
    trial_end: o.trialEnd ? unix(o.trialEnd) : null,
    items: { data: [{ current_period_end: unix(o.periodEnd), price: { recurring: { interval: o.interval ?? state.interval ?? "month" } } }] },
  };
}

/**
 * Test-mode subscription. subscribe: a month paid now (or a trial until referral months run out);
 * cancel / resume: cancel at period end and undo; payment_failed: the renewal fails (Stripe would move to
 * past_due); payment_fixed: the retry succeeds; end: the subscription ends now.
 */
export async function simulate(artistId: string, action: SimAction, now = new Date()): Promise<{ proUntil: Date | null; message: string }> {
  if (billingMode() !== "simulated") throw new BillingError("Test billing is only on without Stripe keys, outside production.", 403);
  const raw = await prisma.message.findFirst({ where: { artistId, direction: DIRECTION, email: STATE_EMAIL }, select: { body: true } });
  const state = parseState(raw?.body);
  const live = state.simulated && hasLiveSubscription(state);
  const periodEnd = state.periodEnd ? new Date(state.periodEnd) : now;
  const need = (ok: boolean, msg: string) => { if (!ok) throw new BillingError(msg, 409); };
  let res: { proUntil: Date | null } | null = null;
  let message = "";
  switch (action) {
    case "subscribe": {
      need(!live, "Already subscribed (test).");
      const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { proUntil: true } });
      const fresh = { ...state, subscriptionId: null, customerId: state.simulated ? state.customerId : null, interval: null };
      const free = a?.proUntil && a.proUntil.getTime() > now.getTime() + BILLING.minTrialHours * 3_600_000 ? a.proUntil : null;
      const sub = free ? simSub(artistId, fresh, { status: "trialing", periodEnd: free, trialEnd: free }) : simSub(artistId, fresh, { status: "active", periodEnd: addMonths(now, 1) });
      // Same as checkout.session.completed: the customer first, then the subscription.
      await saveBillingState(artistId, { customerId: idOf(sub.customer), subscriptionId: null, status: null, subProUntil: null, paymentFailedAt: null, failedInvoiceId: null, simulated: true, eventAt: null });
      res = await applySubscription(sub, { artistId, now });
      message = free ? `Subscribed (test). Referral months first: billing starts ${formatPlanDate(free)}.` : "Subscribed (test).";
      break;
    }
    case "cancel":
      need(live && !state.cancelAtPeriodEnd, "Nothing to cancel.");
      res = await applySubscription(simSub(artistId, state, { status: state.status === "trialing" ? "trialing" : "active", periodEnd, trialEnd: state.trialEnd ? new Date(state.trialEnd) : null, cancel: true }), { artistId, now });
      message = `Cancelled (test). Infinity stays until ${formatPlanDate(res?.proUntil ?? periodEnd)}.`;
      break;
    case "resume":
      need(live && state.cancelAtPeriodEnd, "Not cancelled.");
      res = await applySubscription(simSub(artistId, state, { status: state.status === "trialing" ? "trialing" : "active", periodEnd, trialEnd: state.trialEnd ? new Date(state.trialEnd) : null }), { artistId, now });
      message = "Cancellation undone (test).";
      break;
    case "payment_failed": {
      need(live && state.status !== "past_due", "Subscribe (test) first.");
      // The renewal is attempted now and fails: the new period starts unpaid, proUntil keeps its grace days.
      const next = addMonths(periodEnd > now ? now : periodEnd, state.interval === "year" ? 12 : 1);
      res = await applySubscription(simSub(artistId, state, { status: "past_due", periodEnd: next }), { artistId, now });
      await recordPaymentFailure(artistId, `in_${SIM_PREFIX}${randomBytes(6).toString("hex")}`, now);
      message = "Payment failed (test). Banner, email and admin alert sent.";
      break;
    }
    case "payment_fixed":
      need(live && (state.status === "past_due" || !!state.paymentFailedAt), "No failed payment.");
      res = await applySubscription(simSub(artistId, state, { status: "active", periodEnd }), { artistId, now });
      message = "Payment went through (test).";
      break;
    case "end":
      need(live, "Nothing to end.");
      res = await applySubscription(simSub(artistId, state, { status: "canceled", periodEnd, endedAt: now }), { artistId, now });
      message = "Subscription ended now (test).";
      break;
  }
  return { proUntil: res?.proUntil ?? null, message };
}

// ---------- For pages ----------

/** Billing state + what to show, for Studio and admin pages. */
export async function getBillingSummary(artistId: string, proUntil: Date | null, now = new Date()) {
  const state = await getBillingState(artistId);
  return { state, view: billingView(state, proUntil, now), mode: billingMode(), intervals: billingIntervals() };
}

export const stripeDashboardUrl = (kind: "customers" | "subscriptions", id: string) =>
  `https://dashboard.stripe.com/${process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ? "test/" : ""}${kind}/${encodeURIComponent(id)}`;

export const daysBetween = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / DAY);
