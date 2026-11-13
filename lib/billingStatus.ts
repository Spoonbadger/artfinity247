// lib/billingStatus.ts
// The Infinity subscription as the artist and admins see it. Pure (no DB, no Stripe): safe on server and client.
// lib/billing.ts keeps the state and talks to Stripe; Artist.proUntil (lib/plans.ts isProActive) still decides
// whether Infinity is on.
import { FREE_SPLIT, PRO, isProActive } from "@/lib/plans";

/** Stored on the Artist row (lib/billing.ts: subscription columns + Artist.billing). Dates are ISO strings. */
export type BillingState = {
  customerId: string | null;
  subscriptionId: string | null;
  /** Stripe subscription status: active | trialing | past_due | unpaid | incomplete | incomplete_expired | canceled | paused. */
  status: string | null;
  interval: "month" | "year" | null;
  /** End of the current paid period (or of the free trial while referral months run first). */
  periodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  endedAt: string | null;
  /** Set by invoice.payment_failed, cleared when an invoice is paid. */
  paymentFailedAt: string | null;
  failedInvoiceId: string | null;
  /** The proUntil the subscription last set. A later proUntil came from referrals or an admin grant. */
  subProUntil: string | null;
  /** Dev/test subscription (no Stripe keys). Ignored once real keys are set. */
  simulated: boolean;
  /** Stripe event.created of the last subscription event applied, so an older one arriving late is skipped. */
  eventAt: number | null;
  updatedAt: string | null;
};

export const EMPTY_BILLING: BillingState = {
  customerId: null,
  subscriptionId: null,
  status: null,
  interval: null,
  periodEnd: null,
  trialEnd: null,
  cancelAtPeriodEnd: false,
  endedAt: null,
  paymentFailedAt: null,
  failedInvoiceId: null,
  subProUntil: null,
  simulated: false,
  eventAt: null,
  updatedAt: null,
};

const LIVE = new Set(["active", "trialing", "past_due", "unpaid"]);
/** A subscription that will (try to) charge again: anything not ended or never started. */
export const hasLiveSubscription = (s: Pick<BillingState, "subscriptionId" | "status"> | null | undefined) =>
  !!s?.subscriptionId && LIVE.has(String(s.status));
export const isPaymentFailing = (s: Pick<BillingState, "subscriptionId" | "status" | "paymentFailedAt"> | null | undefined) =>
  hasLiveSubscription(s) && (s!.status === "past_due" || s!.status === "unpaid" || !!s!.paymentFailedAt);

export type BillingView =
  | { kind: "free" }
  /** Infinity from referrals or an admin grant, no subscription. */
  | { kind: "earned"; until: Date }
  /** Paid, renews on renewsOn. */
  | { kind: "renews"; until: Date; renewsOn: Date; interval: "month" | "year" }
  /** Subscribed while referral months were left: billing starts when they run out. */
  | { kind: "trial"; until: Date; billingStarts: Date }
  /** Cancelled: Infinity stays until `until` (the paid period end, or later if referral months remain). */
  | { kind: "cancels"; until: Date; cancelsOn: Date }
  /** Last payment failed: Stripe is retrying. Infinity stays during the grace days. */
  | { kind: "payment_failed"; until: Date | null; failedAt: Date };

const d = (iso: string | null | undefined) => (iso ? new Date(iso) : null);

export function billingView(state: BillingState | null | undefined, proUntil: Date | string | null | undefined, now = new Date()): BillingView {
  const s = state ?? EMPTY_BILLING;
  const active = isProActive({ proUntil }, now);
  const until = active ? new Date(proUntil as Date | string) : null;
  if (hasLiveSubscription(s)) {
    if (isPaymentFailing(s)) return { kind: "payment_failed", until, failedAt: d(s.paymentFailedAt) ?? now };
    const periodEnd = d(s.periodEnd) ?? until ?? now;
    if (s.cancelAtPeriodEnd) return { kind: "cancels", until: until ?? periodEnd, cancelsOn: periodEnd };
    if (s.status === "trialing") return { kind: "trial", until: until ?? periodEnd, billingStarts: d(s.trialEnd) ?? periodEnd };
    return { kind: "renews", until: until ?? periodEnd, renewsOn: periodEnd, interval: s.interval ?? "month" };
  }
  return until ? { kind: "earned", until } : { kind: "free" };
}

/**
 * "Does Infinity pay for itself?" from real sales: the extra share Infinity would have paid on these lines
 * (PRO.split − FREE_SPLIT of each line's profit, respecting PRO.monthlyPrintCap) against the monthly price.
 * Lines come from lib/revenue.ts calcItemProfitCents (profit after print, fees and hosting).
 */
export function paysForItself(lines: { profitCents: number; quantity: number }[]) {
  let prints = 0;
  let profitCents = 0;
  let extraCents = 0;
  const cap = PRO.monthlyPrintCap;
  for (const l of lines) {
    const qty = Math.max(0, l.quantity || 0);
    const atPro = cap == null ? qty : Math.max(0, Math.min(qty, cap - prints));
    const perPrint = qty ? l.profitCents / qty : 0;
    extraCents += Math.round(perPrint * atPro * PRO.split) - Math.round(perPrint * atPro * FREE_SPLIT);
    prints += qty;
    profitCents += l.profitCents;
  }
  const netCents = extraCents - PRO.priceCents;
  return { prints, profitCents, extraCents, priceCents: PRO.priceCents, netCents, pays: netCents >= 0 };
}
