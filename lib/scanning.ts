// Painting scanning service: size bands, prices, the live estimate and what each booking status means.
// Pure and client-safe (the Studio form computes the same estimate the server stores). Settings and database work
// live in lib/scanning.server.ts.
//
// Artfinity scans an artist's original paintings in NYC (high-res, colour-accurate) and puts the files straight onto
// their artworks, so they can sell bigger prints. Booking flow:
//   requested -> confirmed (admin sets date + final price) -> paid -> scanning -> delivered -> returned; or cancelled.
import { PRINT_SIZES, SIZE_LABEL, sizeInches } from "@/components/art/pricing";

export type BandKey = "small" | "medium" | "large";
/** A painting's band: one of the priced bands, or bigger than all of them (quoted by hand). */
export type ItemBand = BandKey | "oversized";
export const BAND_KEYS: BandKey[] = ["small", "medium", "large"];
export const ITEM_BANDS: ItemBand[] = [...BAND_KEYS, "oversized"];
/** Paintings per booking. */
export const MAX_SCAN_PIECES = 40;
export const isItemBand = (v: unknown): v is ItemBand => typeof v === "string" && (ITEM_BANDS as string[]).includes(v);

/** maxShort × maxLong inches: a painting fits when its short side and long side both fit. */
export type ScanBand = { key: BandKey; label: string; maxShort: number; maxLong: number; priceCents: number | null };

/** Settings fields that start as placeholders until the owner sets them (shown as "set by Craig" in the admin only). */
export const SCAN_FIELDS = ["prices", "pickupFee", "turnaroundDays", "returnDays", "dropoffAddress", "careText"] as const;
export type ScanField = (typeof SCAN_FIELDS)[number];

export type ScanSettings = {
  enabled: boolean;
  /** Where `enabled` comes from: SCANNING_SERVICE in the environment, the admin switch, or the default (on in dev, off in production). */
  enabledSource: "env" | "saved" | "default";
  bands: ScanBand[];
  /** NYC pickup fee; null = quoted when we confirm. */
  pickupFeeCents: number | null;
  /** Days from receiving the paintings to the files being on the artworks. */
  turnaroundDays: number;
  /** Days from receiving the paintings to giving them back. */
  returnDays: number;
  /** Where to drop off; given to the artist when a booking is confirmed (never shown on the public page). */
  dropoffAddress: string;
  /** Care wording on the public page and the Studio. Placeholder until the owner confirms it. */
  careText: string;
  /** Fields still at their placeholder default. */
  placeholders: ScanField[];
};

export const DEFAULT_BANDS: ScanBand[] = [
  { key: "small", label: "Small", maxShort: 16, maxLong: 20, priceCents: null },
  { key: "medium", label: "Medium", maxShort: 24, maxLong: 36, priceCents: null },
  { key: "large", label: "Large", maxShort: 40, maxLong: 60, priceCents: null },
];

export const DEFAULT_CARE_TEXT =
  "Only our team handles your paintings. While they're with us they stay in a locked studio, and they come back to you within {returnDays} days of drop-off. Tell us about anything fragile, varnished recently or unusually framed when you book.";

export const SCAN_DEFAULTS = {
  pickupFeeCents: null as number | null,
  turnaroundDays: 7,
  returnDays: 14,
  dropoffAddress: "",
  careText: DEFAULT_CARE_TEXT,
};

export const careTextFor = (s: Pick<ScanSettings, "careText" | "returnDays">) => s.careText.replace(/\{returnDays\}/g, String(s.returnDays));

/** The biggest print Artfinity sells, e.g. "18 × 24 in" (a scan makes every size sharp). */
export const LARGEST_PRINT = sizeInches(PRINT_SIZES[PRINT_SIZES.length - 1]);
export const LARGEST_PRINT_NAME = SIZE_LABEL[PRINT_SIZES[PRINT_SIZES.length - 1]];

export const bandLabel = (key: ItemBand, bands: ScanBand[]) => (key === "oversized" ? "Oversized" : bands.find((b) => b.key === key)?.label ?? key);
export const bandRange = (b: ScanBand) => `up to ${b.maxShort} × ${b.maxLong} in`;
export const oversizedRange = (bands: ScanBand[]) => {
  const big = bands[bands.length - 1];
  return big ? `bigger than ${big.maxShort} × ${big.maxLong} in` : "very large pieces";
};

/** The smallest band a w × h inch painting fits in (orientation doesn't matter). */
export function bandFor(w: number, h: number, bands: ScanBand[]): ItemBand {
  const short = Math.min(w, h), long = Math.max(w, h);
  if (!(short > 0) || !(long > 0)) return bands[0]?.key ?? "small";
  return bands.find((b) => short <= b.maxShort && long <= b.maxLong)?.key ?? "oversized";
}

export const usd = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });

export type Estimate = {
  /** Known part of the price (priced bands plus a set pickup fee). */
  knownCents: number;
  /** Pieces we have to quote by hand (oversized, or a band with no price yet). */
  quoteCount: number;
  /** NYC pickup asked for but the fee isn't set yet. */
  pickupQuoted: boolean;
  pickupCents: number;
  /** Nothing to quote: the estimate is the whole price. */
  complete: boolean;
  pieces: number;
};

export function estimate(items: { band: ItemBand }[], handoff: "dropoff" | "pickup", s: Pick<ScanSettings, "bands" | "pickupFeeCents">): Estimate {
  let knownCents = 0, quoteCount = 0;
  for (const it of items) {
    const price = it.band === "oversized" ? null : s.bands.find((b) => b.key === it.band)?.priceCents ?? null;
    if (price == null) quoteCount++;
    else knownCents += price;
  }
  const pickup = handoff === "pickup";
  const pickupQuoted = pickup && s.pickupFeeCents == null;
  const pickupCents = pickup && s.pickupFeeCents != null ? s.pickupFeeCents : 0;
  knownCents += pickupCents;
  return { knownCents, quoteCount, pickupQuoted, pickupCents, complete: quoteCount === 0 && !pickupQuoted, pieces: items.length };
}

/** "$240", "$160 + a quote for 1 piece", "Ask for a quote". */
export function estimateText(e: Estimate): string {
  if (!e.pieces) return "Pick a painting to see an estimate";
  const extra = [e.quoteCount ? `a quote for ${e.quoteCount} ${e.quoteCount === 1 ? "piece" : "pieces"}` : "", e.pickupQuoted ? "the pickup fee" : ""].filter(Boolean).join(" and ");
  if (e.knownCents === 0) return "We'll send you a quote";
  return extra ? `${usd(e.knownCents)} + ${extra}` : usd(e.knownCents);
}

// ---------- Statuses ----------

export const SCAN_STATUSES = ["requested", "confirmed", "paid", "scanning", "delivered", "returned", "cancelled"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];
export const isScanStatus = (v: unknown): v is ScanStatus => typeof v === "string" && (SCAN_STATUSES as readonly string[]).includes(v);

export const STATUS_LABEL: Record<ScanStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed · to pay",
  paid: "Paid",
  scanning: "Scanning",
  delivered: "Files delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

/** Paint-dab colour per status. */
export const STATUS_DAB: Record<ScanStatus, string> = {
  requested: "var(--af-sticker)",
  confirmed: "var(--af-coral)",
  paid: "var(--af-scan)",
  scanning: "#7b2d8e",
  delivered: "var(--af-earned)",
  returned: "#9aa3b5",
  cancelled: "#9aa3b5",
};

/** Steps the artist sees on a booking's progress line (cancelled is shown on its own). */
export const STATUS_STEPS: ScanStatus[] = ["requested", "confirmed", "paid", "scanning", "delivered", "returned"];

export const HANDOFF_LABEL = { dropoff: "Drop-off", pickup: "NYC pickup" } as const;
export type Handoff = keyof typeof HANDOFF_LABEL;

/** "2026-11-12" -> "Thu, Nov 12". */
export function dayLabel(day: string | Date, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  const d = typeof day === "string" ? new Date(`${day}T12:00:00Z`) : day;
  return Number.isNaN(d.getTime()) ? String(day) : d.toLocaleDateString("en-US", { ...opts, timeZone: "America/New_York" });
}

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime());
