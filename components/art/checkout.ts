"use client";

import type { CartItemType } from "@/types";
import { SIZE_LABEL, isPrintSize, sizeInches } from "@/components/art/pricing";

/** Starts payment for these cart lines and returns the URL to go to (Stripe, or /thank-you in test mode). */
/** `follow`: the buyer ticked "Email me when … posts new work". */
export async function startCheckout(items: CartItemType[], buyer: { id?: string | null; email?: string | null; name?: string | null } = {}, opts: { follow?: boolean } = {}) {
  const res = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: items.map((ci) => ({ product: ci.product, quantity: ci.quantity })), buyer, follow: !!opts.follow }),
  });
  if (!res.ok) throw new Error(await res.text());
  const { url } = await res.json();
  if (!url) throw new Error("No checkout url");
  return url as string;
}

export const sizeText = (s: string) => (isPrintSize(s) ? `${SIZE_LABEL[s]} · ${sizeInches(s)}` : s);

/** What a cart line saved thanks to the scan discount, in cents. */
export function lineSavings(ci: CartItemType) {
  const p = ci.product as CartItemType["product"] & { listPrice?: number };
  return p.listPrice && p.listPrice > p.unitPrice ? (p.listPrice - p.unitPrice) * ci.quantity : 0;
}

/** First names of the artists in the cart: "Maya", "Maya and Juno", "Maya, Juno and Ines". */
export function cartArtistNames(items: CartItemType[]) {
  const names = Array.from(new Set(items.map((ci) => String((ci.product as { artist?: string }).artist || "").trim().split(/\s+/)[0]).filter(Boolean)));
  if (names.length <= 1) return names[0] || "the artist";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
