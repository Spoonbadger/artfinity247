// Small, pure helpers for Stripe Checkout sessions, shared by the session creators and the checkout webhook.
// No imports from the app, so lib/checkoutSession.test.mjs can run them with plain Node.
import { randomBytes } from "node:crypto";

/**
 * An Order id made before the Stripe session, so the order code (lib/orderText.ts: the last 6 characters) can go on
 * the card statement and the Stripe receipt. Same shape as Prisma's cuid: "c" + lowercase base-36.
 */
export function newOrderId(): string {
  const bytes = randomBytes(24);
  let s = "c";
  for (let i = 0; i < 24; i++) s += (bytes[i] % 36).toString(36);
  return s;
}

/** The pre-made Order id from session metadata, if it looks like one of ours. */
export function orderIdFrom(metadata: Record<string, string> | null | undefined): string | null {
  const id = metadata?.orderId;
  return typeof id === "string" && /^c[a-z0-9]{20,32}$/.test(id) ? id : null;
}

/** "XX1KP4", the code buyers see on the thank-you page and in emails (lib/orderText.ts orderCode). */
export const codeOf = (orderId: string) => orderId.slice(-6).toUpperCase();

type Address = { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null };
type ShippingDetails = { name?: string | null; address?: Address | null } | null | undefined;
type SessionLike = {
  collected_information?: { shipping_details?: ShippingDetails } | null;
  /** Before API version 2025-03-31.basil Stripe put it here. */
  shipping_details?: ShippingDetails;
  customer_details?: { name?: string | null; address?: Address | null } | null;
};

/**
 * Where the buyer asked Stripe to ship, as stored on Order (name, one address line). Since the 2025-03-31.basil API
 * version the address lives at collected_information.shipping_details; older payloads had shipping_details.
 */
export function shippingFrom(session: SessionLike): { name: string | null; address: string | null } {
  const s = session.collected_information?.shipping_details ?? session.shipping_details ?? null;
  const a = s?.address;
  const address = a && (a.line1 || a.city)
    ? `${[a.line1, a.line2].filter(Boolean).join(", ")}, ${a.city ?? ""}, ${a.state ?? ""} ${a.postal_code ?? ""}, ${a.country ?? ""}`.replace(/\s+/g, " ").trim()
    : null;
  return { name: s?.name ?? null, address };
}

/** Stripe's card-statement suffix: letters, digits and spaces only, at most 22 characters with the prefix. */
export function statementSuffix(text: string): string {
  return text.replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 10).toUpperCase() || "ARTFINITY";
}
