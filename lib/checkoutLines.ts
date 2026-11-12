// Pure pieces of the print checkout (app/api/create-checkout-session/route.ts): reading a cart line, pricing it from
// the artwork's database row, and the Stripe line item that carries what the order webhook needs (lib/checkoutOrder.ts).
// No database or Stripe calls here, so lib/checkout.test.mjs can check them with plain Node.
import type Stripe from "stripe";
import { applyDiscount, isPrintSize, priceFor, SIZE_LABEL, sizeInches, type PrintSize } from "@/components/art/pricing";
import { TAX_CODE } from "@/lib/tax";

export type Line = {
  art: { id: string; slug: string; title: string; imageUrl: string; artistId: string; artistName: string; editionSize: number | null };
  size: PrintSize;
  frameChosen: boolean;
  frameColor: string | null;
  quantity: number;
  list: number; // cents, before discount
  unit: number; // cents, what the buyer pays per print
  discountPct: number;
  venue: string | null;
  qrCodeId: string | null; // the short link code this sale came through (OrderItem.qrCodeId)
  preRewardUnit?: number; // collector reward: the unit price before it (the artist's share is kept at this price)
};

/** What the buyer picked for one cart line. Only the artwork, size, frame and quantity are read; prices never are. */
export type CartPick = {
  slug: string;
  size: PrintSize;
  frameChosen: boolean;
  frameColor: string | null;
  quantity: number;
  /** The raw product, for the scan-discount fields (code, discountPct, venue, discountSig) the route checks itself. */
  p: any;
};

export function readCartItem(item: any): CartPick | null {
  const p = item?.product ?? item ?? {};
  const slug = String(p.slug ?? "").trim();
  const size = String(p.selectedSize ?? "").toLowerCase();
  if (!slug || !isPrintSize(size)) return null;
  const frameChosen = Boolean(p.frameChosen);
  const frameColor = frameChosen && ["black", "white", "natural"].includes(String(p.frameColor)) ? String(p.frameColor) : null;
  const quantity = Math.max(1, Math.min(10, Math.round(Number(item?.quantity ?? p.quantity ?? 1)) || 1));
  return { slug, size, frameChosen, frameColor, quantity, p };
}

/** The artwork fields pricing needs, as loaded from the database. */
export type PricedArtwork = {
  id: string;
  slug: string | null;
  title: string;
  imageUrl: string;
  artistId: string;
  editionSize: number | null;
  markupSmall?: number | null;
  markupMedium?: number | null;
  markupLarge?: number | null;
  markupXl?: number | null;
  artist: { name: string | null; artist_name: string | null } | null;
};

/** Price one line from the database row: the artwork's own markups, the size, the frame, then the checked scan discount. */
export function priceLine(art: PricedArtwork, pick: CartPick, scan: { discountPct: number; venue: string | null; qrCodeId: string | null }): Line {
  const { list } = priceFor(art, pick.size, pick.frameChosen, 0);
  const unit = applyDiscount(list, scan.discountPct);
  return {
    art: { id: art.id, slug: art.slug!, title: art.title, imageUrl: art.imageUrl, artistId: art.artistId, artistName: art.artist?.artist_name || art.artist?.name || "", editionSize: art.editionSize ?? null },
    size: pick.size, frameChosen: pick.frameChosen, frameColor: pick.frameColor, quantity: pick.quantity, list, unit,
    discountPct: scan.discountPct, venue: scan.venue, qrCodeId: scan.qrCodeId,
  };
}

function abs(base: string, url?: string | null) {
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) return url;
  return url.startsWith("/") ? base + url : `${base}/${url}`;
}

/** The Stripe Checkout line item for a priced line. Its product metadata is what the webhook records the order from. */
export function stripeLineItem(l: Line, base: string): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    quantity: l.quantity,
    // Quantities were set in the cart and the summary showed that exact total: no changing them on Stripe's page.
    price_data: {
      currency: "usd",
      unit_amount: l.unit,
      tax_behavior: "exclusive", // sales tax is added on top at checkout
      product_data: {
        tax_code: TAX_CODE,
        // "Print — Night Market by Maya Chen, Medium 8 × 12 in"
        name: `Print — ${l.art.title}${l.art.artistName ? ` by ${l.art.artistName}` : ""}, ${SIZE_LABEL[l.size]} ${sizeInches(l.size)}`.slice(0, 250),
        description: [
          l.frameChosen ? `${l.frameColor === "natural" ? "Natural wood" : l.frameColor === "white" ? "White" : "Black"} frame` : "Unframed",
          l.art.editionSize ? `Limited edition of ${l.art.editionSize}` : "",
          l.discountPct ? `${l.discountPct}% scan discount` : "",
          l.preRewardUnit ? "Collector reward" : "",
          "Printed in NYC",
        ].filter(Boolean).join(" · "),
        images: l.art.imageUrl ? [abs(base, l.art.imageUrl)!] : [],
        metadata: {
          artworkId: l.art.id,
          slug: l.art.slug,
          size: l.size,
          title: l.art.title,
          artistName: l.art.artistName,
          imageUrl: l.art.imageUrl ?? "",
          artistId: l.art.artistId,
          frameChosen: l.frameChosen ? "true" : "false",
          frameColor: l.frameColor ?? "",
          discountPct: String(l.discountPct || 0),
          listPrice: String(l.list),
          venue: l.venue ?? "",
          qrCodeId: l.qrCodeId ?? "",
          ...(l.preRewardUnit ? { rewardFromUnit: String(l.preRewardUnit) } : {}),
        },
      },
    },
  };
}
