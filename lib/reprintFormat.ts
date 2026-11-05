// Free reprints for damaged, misprinted or wrong prints. Pure (safe on server and client).
// Server half (signing, DB, emails) is lib/reprints.ts.
//
// Storage: the schema has no table for these, so each request is one Message row on the order:
//   direction "reprint", email "reprint:<orderId>" (not an address, so the artist CRM never lists it,
//   same trick as lib/referrals.ts), subject "Reprint: <status>", body = JSON (ReprintBody).
// An approved reprint is a new Order: kind "reprint", paymentStatus "no_charge", amountTotal 0,
// stripeSessionId "reprint:<originalOrderId>:<n>". Every sale/earnings/edition query counts
// paymentStatus "paid" only, so it adds no sale, no earnings and uses no edition number.

export const REPRINT_DIRECTION = "reprint";
export const REPRINT_SUBJECT = "Reprint: ";
export const REPRINT_KIND = "reprint";
export const REPRINT_PAYMENT = "no_charge";

export const REPRINT_REASONS = [
  { id: "damaged", label: "Damaged in shipping", artist: "damaged in shipping" },
  { id: "misprint", label: "Misprint or color problem", artist: "misprint" },
  { id: "wrong", label: "Wrong item", artist: "wrong item sent" },
] as const;
export type ReprintReason = (typeof REPRINT_REASONS)[number]["id"];
export const isReprintReason = (r: unknown): r is ReprintReason => REPRINT_REASONS.some((x) => x.id === r);
export const reasonLabel = (r: string) => REPRINT_REASONS.find((x) => x.id === r)?.label ?? r;

export const REPRINT_STATUSES = ["open", "approved", "refunded", "declined"] as const;
export type ReprintStatus = (typeof REPRINT_STATUSES)[number];

export const MAX_PHOTOS = 3;
export const MAX_NOTE = 800;

/** Buyers can ask this long after delivery (matches the return policy). */
export const HELP_DAYS_AFTER_DELIVERY = 14;
/**
 * Orders store no delivered date, so delivery is estimated: the shipped date (when admin saved the
 * tracking number, kept as a Message) plus this many days in transit. Generous on purpose.
 */
export const TRANSIT_DAYS = 7;
/** No tracking on file (older orders): count from the order date, printing + transit included. */
export const NO_TRACKING_DAYS = 30;

export type ReprintBody = {
  v: 1;
  reason: ReprintReason;
  note: string;
  photos: string[];
  items: { id: string; qty: number }[];
  decision?: { note: string; at: string; reprintOrderId?: string };
};

export const statusSubject = (s: ReprintStatus) => `${REPRINT_SUBJECT}${s}`;

export function statusOf(subject: string | null | undefined): ReprintStatus | null {
  if (!subject?.startsWith(REPRINT_SUBJECT)) return null;
  const s = subject.slice(REPRINT_SUBJECT.length);
  return (REPRINT_STATUSES as readonly string[]).includes(s) ? (s as ReprintStatus) : null;
}

export function parseReprintBody(raw: string): ReprintBody | null {
  try {
    const b = JSON.parse(raw);
    if (!b || b.v !== 1 || !isReprintReason(b.reason) || !Array.isArray(b.items)) return null;
    return {
      v: 1,
      reason: b.reason,
      note: String(b.note ?? ""),
      photos: Array.isArray(b.photos) ? b.photos.filter((p: unknown) => typeof p === "string") : [],
      items: b.items.filter((i: any) => typeof i?.id === "string").map((i: any) => ({ id: i.id, qty: Math.max(1, Number(i.qty) || 1) })),
      decision: b.decision && typeof b.decision === "object" ? { note: String(b.decision.note ?? ""), at: String(b.decision.at ?? ""), reprintOrderId: b.decision.reprintOrderId || undefined } : undefined,
    };
  } catch {
    return null;
  }
}

const DAY = 86400000;

/** When the buyer can no longer ask through the link (see TRANSIT_DAYS / NO_TRACKING_DAYS). */
export function helpDeadline(o: { createdAt: Date }, shippedAt: Date | null): Date {
  return shippedAt
    ? new Date(shippedAt.getTime() + (TRANSIT_DAYS + HELP_DAYS_AFTER_DELIVERY) * DAY)
    : new Date(o.createdAt.getTime() + NO_TRACKING_DAYS * DAY);
}

type HelpGate = { kind: string; paymentStatus: string; shippingStatus: string; createdAt: Date };

/** open: can ask. waiting: not shipped yet. closed: past the window. never: unpaid order. */
export function helpState(o: HelpGate, shippedAt: Date | null, now = Date.now()): "open" | "waiting" | "closed" | "never" {
  if (o.paymentStatus !== "paid" && o.kind !== REPRINT_KIND) return "never";
  if (o.shippingStatus !== "shipped" && o.shippingStatus !== "delivered") return "waiting";
  return now <= helpDeadline(o, shippedAt).getTime() ? "open" : "closed";
}

/** The line the artist sees on that order in their customer timeline. */
export function artistReprintLine(reason: string) {
  const r = REPRINT_REASONS.find((x) => x.id === reason);
  return `Reprinted free by Artfinity${r ? ` (${r.artist})` : ""}`;
}
