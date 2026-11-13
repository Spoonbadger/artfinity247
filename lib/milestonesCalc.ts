// Independence milestones (/admin/milestones): the owner's inputs and the pure math. Client-safe (no server imports),
// so the break-even calculator can update as the owner types. Data loading is in lib/milestones.ts.
// Money is in cents. The owner types dollars; the form converts.

/** What the owner enters on /admin/milestones. Every field is optional and starts empty. */
export type MilestoneInputs = {
  /** Prints a month the lab wants for its bulk tier. */
  bulkThreshold?: number;
  /** The lab's bulk discount, percent (0 to 100). */
  bulkDiscountPct?: number;
  /** Printing in-house: fixed monthly cost (printer lease or loan, space, software), cents. */
  ownFixedMonthlyCents?: number;
  /** Printing in-house: paper + ink per print, cents. */
  ownMaterialsCents?: number;
  /** Printing in-house: packaging + postage per print, cents. */
  ownPackPostCents?: number;
  /** Printing in-house: minutes of work per print. */
  ownLaborMinutes?: number;
  /** Printing in-house: hourly rate for that work, cents. */
  ownHourlyCents?: number;
  /** Monthly running costs: hosting, email, domain, tools, cents. */
  runningCostsCents?: number;
};

export const MONEY_FIELDS = ["ownFixedMonthlyCents", "ownMaterialsCents", "ownPackPostCents", "ownHourlyCents", "runningCostsCents"] as const;
export const NUMBER_FIELDS = ["bulkThreshold", "bulkDiscountPct", "ownLaborMinutes"] as const;
export type MilestoneField = (typeof MONEY_FIELDS)[number] | (typeof NUMBER_FIELDS)[number];
export const ALL_FIELDS: MilestoneField[] = [...MONEY_FIELDS, ...NUMBER_FIELDS];

/** Upper bounds, to catch typos (an extra zero), not to judge the numbers. */
export const FIELD_MAX: Record<MilestoneField, number> = {
  bulkThreshold: 1_000_000,
  bulkDiscountPct: 100,
  ownLaborMinutes: 600,
  ownFixedMonthlyCents: 100_000_000, // $1M a month
  ownMaterialsCents: 1_000_000,
  ownPackPostCents: 1_000_000,
  ownHourlyCents: 100_000,
  runningCostsCents: 100_000_000,
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** Keeps only known, valid fields (a stored snapshot or a request body). */
export function cleanInputs(raw: unknown): MilestoneInputs {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: MilestoneInputs = {};
  for (const k of ALL_FIELDS) {
    const v = src[k];
    if (isNum(v) && v <= FIELD_MAX[k]) out[k] = v;
  }
  return out;
}

/** "12.50" → 1250 cents; "" → undefined; junk → NaN. */
export function dollarsToCents(s: string): number | undefined {
  const t = s.replace(/[$,\s]/g, "");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
export function parseNumber(s: string): number | undefined {
  const t = s.replace(/[,%\s]/g, "");
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
export const centsToDollarsText = (c: number | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(/\.00$/, ""));

// ---------- Print our own prints ----------

export type BreakEvenInput = {
  /** Lab cost per print, cents (from the site's cost table, weighted by the size mix). */
  labCostCents: number;
  /** Prints a month that would move in-house, last 30 days. */
  printsPerMonth: number;
  /** The same count for the 30 days before that, for the growth trend. */
  printsPrevMonth: number;
  inputs: MilestoneInputs;
};

export type BreakEven =
  | { state: "needs"; missing: string[] }
  | {
      state: "never" | "short" | "done";
      /** Own cost per print: materials + packaging/postage + labor, cents. */
      ownVariableCents: number;
      /** Lab cost minus own cost per print, cents. */
      marginCents: number;
      /** Prints a month where in-house pays for its fixed cost (null when it never does). */
      breakEven: number | null;
      /** Monthly saving (positive) or loss (negative) at the current volume, cents. */
      monthlyCents: number;
      /** Prints a month added per month, last 30 days vs the 30 before. Only when it's growing. */
      growthPerMonth: number | null;
      /** Months until break-even at that growth (straight line). Only when growing and not there yet. */
      monthsAway: number | null;
      laborCounted: boolean;
    };

export function breakEven({ labCostCents, printsPerMonth, printsPrevMonth, inputs }: BreakEvenInput): BreakEven {
  const missing: string[] = [];
  if (inputs.ownFixedMonthlyCents == null) missing.push("monthly fixed cost");
  if (inputs.ownMaterialsCents == null) missing.push("materials per print");
  if (missing.length) return { state: "needs", missing };
  const fixed = inputs.ownFixedMonthlyCents!;
  const laborCounted = inputs.ownLaborMinutes != null && inputs.ownHourlyCents != null;
  const labor = laborCounted ? (inputs.ownLaborMinutes! / 60) * inputs.ownHourlyCents! : 0;
  const ownVariableCents = Math.round(inputs.ownMaterialsCents! + (inputs.ownPackPostCents ?? 0) + labor);
  const marginCents = labCostCents - ownVariableCents;
  const monthlyCents = Math.round(printsPerMonth * marginCents - fixed);
  const growth = printsPerMonth > printsPrevMonth && printsPrevMonth > 0 ? printsPerMonth - printsPrevMonth : null;
  if (marginCents <= 0) return { state: "never", ownVariableCents, marginCents, breakEven: null, monthlyCents, growthPerMonth: growth, monthsAway: null, laborCounted };
  const be = Math.ceil(fixed / marginCents);
  const done = printsPerMonth >= be;
  const monthsAway = !done && growth ? Math.ceil((be - printsPerMonth) / growth) : null;
  return { state: done ? "done" : "short", ownVariableCents, marginCents, breakEven: be, monthlyCents, growthPerMonth: growth, monthsAway, laborCounted };
}

/** Bar width 0 to 100 for `now` toward `target`. */
export const pct = (now: number, target: number) => (target > 0 ? Math.max(0, Math.min(100, (now / target) * 100)) : 0);
