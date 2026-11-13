// lib/plans.ts
// Free and Infinity, in one place. Pure module (no DB, no server imports): safe on server and client.
//
// Infinity is active while Artist.proUntil is in the future, whether it was paid for (Stripe Billing,
// lib/billing.ts), earned through referrals, or granted by an admin. Artist.plan says what the artist signed up for
// (FREE | PRO); proUntil decides what they get. isProActive() below is the ONE check that every Infinity-only feature
// and the order-time split (lib/revenue.ts) use. A paid subscription keeps proUntil at the end of the current billing
// period plus BILLING.graceDays.

export type PlanId = "FREE" | "PRO";

/** Free plan's split today. lib/revenue.ts getArtistSplit(date) is the source of truth (it was 50% before 2026-10-21). */
export const FREE_SPLIT = 0.6;

// Optional overrides at build time (NEXT_PUBLIC_ so the browser sees the same numbers as the server). Out-of-range
// values are ignored. A Stripe Price set in STRIPE_INFINITY_PRICE_ID must charge the same amount (BILLING_SETUP.md).
function envNumber(raw: string | undefined, min: number, max: number): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
const ENV_PRICE_CENTS = envNumber(process.env.NEXT_PUBLIC_INFINITY_PRICE_CENTS, 100, 100_000);
const ENV_YEARLY_CENTS = envNumber(process.env.NEXT_PUBLIC_INFINITY_YEARLY_CENTS, 100, 1_000_000);
const ENV_SPLIT = envNumber(process.env.NEXT_PUBLIC_INFINITY_SPLIT, FREE_SPLIT, 0.9);

/**
 * THE PRO SPLIT DECISION LIVES HERE. The user asked for 70%, $20 a month.
 *
 * Research ("What Artists Need", Infinity analysis): at $20/mo and 70%, Infinity pays for itself at about
 * 6 Medium prints a month; past that point Artfinity earns less per Infinity artist than per Free one.
 * It suggested either 65% (split: 0.65), or 70% capped at 50 prints a month (monthlyPrintCap: 50).
 * Not decided yet, so this defaults to what the user said: 70%, no cap. Change it here (or with the env vars
 * above); nothing else in the app hard-codes the price or the split.
 */
export const PRO = {
  name: "Infinity",
  /** Monthly price: the button, the copy, the calculators, MRR, and inline Stripe price_data. */
  priceCents: ENV_PRICE_CENTS ?? 2000,
  /** Price for a year, billed yearly. STRIPE_INFINITY_YEARLY_PRICE_ID, when set, must charge the same. */
  yearlyCents: ENV_YEARLY_CENTS ?? 20000,
  /** Artist's share of profit while Infinity is active. */
  split: ENV_SPLIT ?? 0.7,
  /**
   * Prints per calendar month (per artist) paid at the Infinity split. Prints past it are paid at the
   * Free split. null = no cap.
   */
  monthlyPrintCap: null as number | null,
  /** Length of the old dev-only trial (/api/studio/pro/trial). */
  trialDays: 14,
} as const;

/** Stripe Billing rules for Infinity (lib/billing.ts). */
export const BILLING = {
  /** A paid subscription keeps proUntil this many days past the paid period, so a late renewal doesn't drop the split. */
  graceDays: 3,
  /** Stripe Checkout needs a trial to end at least 48 hours out. Less referral time than this left: billing starts now. */
  minTrialHours: 49,
} as const;

/** "Share Artfinity, get 2 months of Infinity." */
export const REFERRALS = {
  rewardMonths: 2,
  /** Never bank more than this many months of Infinity ahead of today. */
  maxBankedMonths: 12,
  /** A qualifying referral waits this many days before its months unlock (time to catch fakes). */
  holdDays: 14,
  /** At most this many rewards unlock per calendar month (UTC) for one referrer. */
  maxPerMonth: 5,
} as const;

export const pct = (split: number) => `${Math.round(split * 100)}%`;
/** "$20", or "$19.50" when the amount isn't whole dollars. */
export const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
export const proPrice = () => dollars(PRO.priceCents);
/** "$200": Infinity billed yearly. */
export const proYearlyPrice = () => dollars(PRO.yearlyCents);
/** What yearly saves against 12 monthly payments ($40 at $20/mo and $200/yr). */
export const yearlySavingsCents = () => Math.max(0, PRO.priceCents * 12 - PRO.yearlyCents);

/** Is Infinity active at `at` (defaults to now)? Only proUntil decides. */
export function isProActive(a: { proUntil?: Date | string | null } | null | undefined, at: Date = new Date()): boolean {
  if (!a?.proUntil) return false;
  const until = a.proUntil instanceof Date ? a.proUntil : new Date(a.proUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > at.getTime();
}

/** Add whole calendar months (keeps the time of day). */
export function addMonths(d: Date, months: number) {
  const out = new Date(d);
  const day = out.getDate();
  out.setMonth(out.getMonth() + months);
  if (out.getDate() < day) out.setDate(0); // Jan 31 + 1 month = Feb 28/29, not Mar 3
  return out;
}

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

export const formatPlanDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Planned Infinity-only design extras. Not listed on /pricing until /studio/design enforces them. */
export const PRO_DESIGN_EXTRAS = ["Salon wall layout", "Any accent color"] as const;

export type Feature = { label: string; free: boolean | string; pro: boolean | string };

/** Free vs Infinity, for /pricing and /studio/infinity. */
export function planFeatures(): Feature[] {
  return [
    { label: "Your artist page", free: true, pro: true },
    { label: "QR Studio", free: true, pro: true },
    { label: "Unlimited art", free: true, pro: true },
    { label: "Share kit images", free: true, pro: true },
    { label: "Collections and editions", free: true, pro: true },
    { label: "Link page", free: true, pro: true },
    { label: "Share of profit", free: pct(FREE_SPLIT), pro: PRO.monthlyPrintCap ? `${pct(PRO.split)} on ${PRO.monthlyPrintCap} prints/mo` : pct(PRO.split) },
    { label: "Auto videos", free: false, pro: true },
    { label: "Automations", free: false, pro: true },
    { label: "Priority support", free: false, pro: true },
  ];
}
