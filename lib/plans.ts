// lib/plans.ts
// Free and Pro, in one place. Pure module (no DB, no server imports): safe on server and client.
//
// Pro is active while Artist.proUntil is in the future, whether it was paid for or earned
// through referrals. Artist.plan says what the artist signed up for (FREE | PRO); proUntil
// decides what they get. When Stripe Billing arrives, a paid subscription keeps proUntil
// at the end of the current billing period.

export type PlanId = "FREE" | "PRO";

/**
 * THE PRO SPLIT DECISION LIVES HERE. The user asked for 70%, $20 a month.
 *
 * Research ("What Artists Need", Pro analysis): at $20/mo and 70%, Pro pays for itself at about
 * 6 Medium prints a month; past that point Artfinity earns less per Pro artist than per Free one.
 * It suggested either 65% (split: 0.65), or 70% capped at 50 prints a month (monthlyPrintCap: 50).
 * Not decided yet, so this defaults to what the user said: 70%, no cap.
 */
export const PRO = {
  name: "Pro",
  priceCents: 2000,
  /** Artist's share of profit while Pro is active. */
  split: 0.7,
  /**
   * Prints per calendar month (per artist) paid at the Pro split. Prints past it are paid at the
   * Free split. null = no cap.
   */
  monthlyPrintCap: null as number | null,
  /** Dev-only trial length (no billing yet). */
  trialDays: 14,
} as const;

/** Free plan's split today. lib/revenue.ts getArtistSplit(date) is the source of truth (it was 50% before 2026-10-21). */
export const FREE_SPLIT = 0.6;

/** "Share Artfinity, get 2 months of Pro." */
export const REFERRALS = {
  rewardMonths: 2,
  /** Never bank more than this many months of Pro ahead of today. */
  maxBankedMonths: 12,
  /** Planned anti-abuse: the referred artist also needs a real sale or verification within this many days. Not enforced yet. */
  verifyWithinDays: 30,
} as const;

export const pct = (split: number) => `${Math.round(split * 100)}%`;
export const proPrice = () => `$${(PRO.priceCents / 100).toFixed(0)}`;

/** Is Pro active at `at` (defaults to now)? Only proUntil decides. */
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

/** Planned Pro-only design extras. Not listed on /pricing until /studio/design enforces them. */
export const PRO_DESIGN_EXTRAS = ["Salon wall layout", "Any accent color"] as const;

export type Feature = { label: string; free: boolean | string; pro: boolean | string };

/** Free vs Pro, for /pricing and /studio/pro. */
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
