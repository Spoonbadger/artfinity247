// Numbers the help articles quote, read from the code that enforces them. Server only (some sources use Prisma).
import { basePrices, framePrices } from "@/lib/artwork_price";
import { FRAME_COLORS, PRINT_SIZES, SIZE_LABEL, sizeInches, type PrintSize } from "@/components/art/pricing";
import { PIXELS_NEEDED, PRINT_DPI } from "@/lib/printSizes";
import { breakdown, money } from "@/lib/earnings";
import { FREE_SPLIT, PRO, REFERRALS, pct, proPrice } from "@/lib/plans";
import { LATE_AFTER_DAYS, PAYOUT_DAY_OF_MONTH, RETURN_WINDOW_DAYS } from "@/lib/balance";
import { PRINT_BUSINESS_DAYS, SHIP_BUSINESS_DAYS } from "@/lib/delivery";
import { BULK_HANDLING_FEE_CENTS, BULK_SIZES, BULK_SIZE_KEY, BULK_TIERS, bulkUnitCost } from "@/lib/bulk";
import { LEGACY_MAX_PCT, LEGACY_UNTIL } from "@/lib/scanSign";
import { EDITION_MAX, EDITION_MIN, LAST_FEW } from "@/lib/editionFormat";
import { MEDALS } from "@/lib/medals";
import { AUTO_APPROVE_AFTER } from "@/lib/artworkLive";
import { VENMO_CONFIRM_HOURS } from "@/lib/venmo";
import { MAX_ARTWORKS as NEWSLETTER_MAX_ART, SEND_GAP_MS } from "@/lib/newsletter";
import { HELP_DAYS_AFTER_DELIVERY, MAX_PHOTOS, REPRINT_REASONS } from "@/lib/reprintFormat";
import { DISCOUNTS, FORMATS, PRESETS } from "@/components/qr/card";
import { LAYOUTS, MAX_PINNED, PAINTS } from "@/components/artist/theme";
import { EDIT_WINDOW_DAYS } from "@/lib/reviews";
import { SOURCE_LABEL } from "@/lib/pageviews";
import { DAILY_UPLOAD_LIMIT, QUEUE_CONCURRENCY, QUEUE_MAX } from "@/lib/uploadLimits";

export { money, pct, proPrice, FREE_SPLIT, PRO, REFERRALS, RETURN_WINDOW_DAYS, PAYOUT_DAY_OF_MONTH, LATE_AFTER_DAYS };
export { PRINT_BUSINESS_DAYS, SHIP_BUSINESS_DAYS, EDITION_MIN, EDITION_MAX, LAST_FEW, MEDALS, AUTO_APPROVE_AFTER, VENMO_CONFIRM_HOURS };
export { DAILY_UPLOAD_LIMIT, QUEUE_CONCURRENCY, QUEUE_MAX };
export { NEWSLETTER_MAX_ART, HELP_DAYS_AFTER_DELIVERY, MAX_PHOTOS, REPRINT_REASONS, EDIT_WINDOW_DAYS, PRINT_DPI, LEGACY_MAX_PCT };

export const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const dollars = (cents: number) => (cents % 100 === 0 ? `$${cents / 100}` : money(cents));

export const PAYOUT_DAY = ordinal(PAYOUT_DAY_OF_MONTH);
export const FREE_PCT = pct(FREE_SPLIT);
export const PRO_PCT = pct(PRO.split);
export const PRO_PRICE = proPrice();
export const PRO_CAP_NOTE = PRO.monthlyPrintCap ? ` on up to ${PRO.monthlyPrintCap} prints a month (prints past that pay the Free split)` : "";

export const SIZE_NAMES = list(PRINT_SIZES.map((s) => `${SIZE_LABEL[s]} (${sizeInches(s)})`));
export const SMALLEST = `${SIZE_LABEL.small} (${sizeInches("small")})`;
export const LARGEST = `${SIZE_LABEL.xl} (${sizeInches("xl")})`;

/** | Size | Inches | Min. pixels | */
export const PIXEL_TABLE = [
  "| Size | Print | Pixels needed (long × short edge) |",
  "|---|---|---|",
  ...PRINT_SIZES.map((s) => `| ${SIZE_LABEL[s]} | ${sizeInches(s)} | ${PIXELS_NEEDED[s][0].toLocaleString("en-US")} × ${PIXELS_NEEDED[s][1].toLocaleString("en-US")} px |`),
].join("\n");

/** | Size | Lowest price | Frame adds | */
export const PRICE_TABLE = [
  "| Size | Print | Lowest price | A frame adds |",
  "|---|---|---|---|",
  ...PRINT_SIZES.map((s) => `| ${SIZE_LABEL[s]} | ${sizeInches(s)} | ${money(basePrices[s])} | ${dollars(framePrices[s])} |`),
].join("\n");

export const FRAME_COLOR_NAMES = list(FRAME_COLORS.map((f) => f.label.toLowerCase()));

export const DELIVERY_MIN = PRINT_BUSINESS_DAYS.min + SHIP_BUSINESS_DAYS.min;
export const DELIVERY_MAX = PRINT_BUSINESS_DAYS.max + SHIP_BUSINESS_DAYS.max;

// ---------- Worked earnings example (lib/earnings.ts breakdown, the same math as the Studio) ----------
export const EXAMPLE_SIZE: PrintSize = "medium";
export const EXAMPLE_MARKUP = 1000; // the artist adds $10 over the lowest price
const freeEx = breakdown(EXAMPLE_SIZE, EXAMPLE_MARKUP, 0, false, new Date(), FREE_SPLIT);
const proEx = breakdown(EXAMPLE_SIZE, EXAMPLE_MARKUP, 0, false, new Date(), PRO.split);
const offEx = breakdown(EXAMPLE_SIZE, EXAMPLE_MARKUP, 10, false, new Date(), FREE_SPLIT);
const baseEx = breakdown(EXAMPLE_SIZE, 0, 0, false, new Date(), FREE_SPLIT);
export const EXAMPLE = {
  size: `${SIZE_LABEL[EXAMPLE_SIZE]} (${sizeInches(EXAMPLE_SIZE)})`,
  base: money(basePrices[EXAMPLE_SIZE]),
  markup: money(EXAMPLE_MARKUP),
  price: money(freeEx.price),
  cost: money(freeEx.cost),
  fee: money(freeEx.fee),
  hosting: money(freeEx.hosting),
  profit: money(freeEx.profit),
  free: money(freeEx.artist),
  pro: money(proEx.artist),
  company: money(freeEx.company),
  offPrice: money(offEx.price),
  offArtist: money(offEx.artist),
  baseArtist: money(baseEx.artist),
};

// ---------- QR Studio ----------
export const QR_PRESETS = Object.values(PRESETS).map((p) => ({ name: p.name, sub: p.sub, format: FORMATS[p.format] }));
export const QR_FORMATS = Object.values(FORMATS);
export const QR_DISCOUNTS = list(DISCOUNTS.filter(Boolean).map((d) => `${d}%`));
export const LEGACY_UNTIL_TEXT = LEGACY_UNTIL.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

// ---------- Page design ----------
export const PAINT_COUNT = PAINTS.length;
export const LAYOUT_NAMES = list(LAYOUTS.map((l) => `${l.name} (${l.note.toLowerCase()})`));
export { MAX_PINNED };

// ---------- Bulk ----------
export const BULK_FEE = money(BULK_HANDLING_FEE_CENTS);
export const BULK_TIER_TEXT = list([...BULK_TIERS].sort((a, b) => a.min - b.min).map((t) => `${t.pct}% off at ${t.min}+ prints`));
export const BULK_TABLE = [
  "| Size | Unframed, each | Framed, each |",
  "|---|---|---|",
  ...BULK_SIZES.map((s) => `| ${SIZE_LABEL[BULK_SIZE_KEY[s]]} (${sizeInches(BULK_SIZE_KEY[s])}) | ${money(bulkUnitCost(s, false))} | ${money(bulkUnitCost(s, true))} |`),
].join("\n");

// ---------- Followers, analytics ----------
export const NEWSLETTER_GAP_HOURS = Math.round(SEND_GAP_MS / 3_600_000);
export const SOURCE_NAMES = list(Object.values(SOURCE_LABEL));

export const MEDAL_TEXT = list([...MEDALS].reverse().map((m) => `${m.label.split(" ")[0]} at ${m.min} prints`));

export const REPRINT_REASON_TEXT = list(REPRINT_REASONS.map((r) => r.label.toLowerCase()));
