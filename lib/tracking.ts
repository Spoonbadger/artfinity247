// Shipment tracking for "your order shipped" emails. Pure (safe on server and client).
// Order has no tracking columns, so the number is kept as a Message on the order
// (direction "out", subject starting with TRACKING_SUBJECT), one per artist in the order.

export const CARRIERS = ["USPS", "UPS", "FedEx", "Other"] as const;
export type Carrier = (typeof CARRIERS)[number];
export const TRACKING_SUBJECT = "Shipped: ";

export type Tracking = { carrier: Carrier; number: string; url: string | null };

export function trackingUrl(carrier: Carrier, number: string): string | null {
  const n = encodeURIComponent(number.replace(/\s+/g, ""));
  if (carrier === "USPS") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  if (carrier === "UPS") return `https://www.ups.com/track?tracknum=${n}`;
  if (carrier === "FedEx") return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  return null;
}

/** Checks admin input. Other carriers need their own https tracking link. */
export function cleanTracking(raw: { carrier?: unknown; trackingNumber?: unknown; trackingUrl?: unknown }): { error: string } | { tracking: Tracking } {
  const carrier = CARRIERS.find((c) => c === raw.carrier);
  if (!carrier) return { error: "Pick a carrier." };
  const number = typeof raw.trackingNumber === "string" ? raw.trackingNumber.trim().replace(/\s+/g, " ") : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{3,39}$/.test(number)) return { error: "Add the tracking number." };
  if (carrier !== "Other") return { tracking: { carrier, number, url: trackingUrl(carrier, number) } };
  const url = typeof raw.trackingUrl === "string" ? raw.trackingUrl.trim() : "";
  if (!/^https:\/\/[^\s]{4,300}$/.test(url)) return { error: "For other carriers, paste the https tracking link." };
  return { tracking: { carrier, number, url } };
}

export function trackingText(t: Tracking) {
  return `${t.carrier} tracking number: ${t.number}${t.url ? `\nTrack it: ${t.url}` : ""}`;
}

/** Reads a tracking Message back ("Shipped: USPS 9400…" + body with the link). */
export function parseTrackingMessage(subject: string | null, body: string): Tracking | null {
  if (!subject?.startsWith(TRACKING_SUBJECT)) return null;
  const m = subject.slice(TRACKING_SUBJECT.length).match(/^(USPS|UPS|FedEx|Other) (.+)$/);
  if (!m) return null;
  const url = body.match(/https:\/\/\S+/)?.[0] ?? null;
  return { carrier: m[1] as Carrier, number: m[2], url };
}
