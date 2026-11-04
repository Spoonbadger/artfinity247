// Pure helpers for the Money page (safe on server and client).
import type { LedgerLine, LedgerStatus, PayoutStatus } from "@/lib/balance";

/** $1,234.56 */
export const usd = (cents: number) =>
  (cents < 0 ? "−$" : "$") + (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** $1,235 (whole dollars, for axes and tight tiles) */
export const usd0 = (cents: number) => "$" + Math.round(cents / 100).toLocaleString("en-US");

/** "Nov 5" (UTC: payout dates and months follow UTC like the admin pages). */
export const dayUTC = (iso: string, year = false) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });

/** "Oct 2026" / "October 2026" */
export const monthName = (ym: string, style: "short" | "long" = "short") => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { timeZone: "UTC", month: style, year: "numeric" });
};

export const SIZE_LABEL: Record<string, string> = { S: "Small", M: "Medium", L: "Large", XL: "XL" };
export const SIZE_INCH: Record<string, string> = { S: "5×7", M: "8×12", L: "11×17", XL: "18×24" };

/** Status colors: one green ramp, light to deep, pending also hatched. */
export const STATUS_COLOR: Record<LedgerStatus, string> = { pending: "#a9d8c1", available: "#3d9f76", paid: "#0f7a55" };
export const STATUS_LABEL: Record<LedgerStatus, string> = { pending: "Incoming", available: "Available", paid: "Paid" };
export const PAYOUT_LABEL: Record<PayoutStatus, string> = { paid: "Paid", scheduled: "Scheduled", in_progress: "In progress" };

export type Period = "30d" | "90d" | "12m" | "all";
export const PERIODS: { id: Period; label: string }[] = [
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "12m", label: "12 months" },
  { id: "all", label: "All" },
];
const DAY = 86_400_000;

export function periodStart(p: Period, now: Date): Date | null {
  if (p === "30d") return new Date(now.getTime() - 30 * DAY);
  if (p === "90d") return new Date(now.getTime() - 90 * DAY);
  if (p === "12m") return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
  return null;
}

export function inPeriod(lines: LedgerLine[], p: Period, now: Date) {
  const s = periodStart(p, now);
  return s ? lines.filter((l) => new Date(l.date) >= s) : lines;
}

/** Monday 00:00 UTC of the week holding d. */
export function weekStart(d: Date) {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * DAY);
}

/** A round axis top and 3-5 ticks for a max value in cents. */
export function niceTicks(maxCents: number): number[] {
  const max = Math.max(maxCents, 100);
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow);
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + 0.5; v += step) out.push(Math.round(v));
  return out;
}
