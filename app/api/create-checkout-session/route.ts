import { scanDiscount } from "@/lib/scanSign";
import { codeAppliesTo, resolveCode } from "@/lib/shortlinks";
import Stripe from "stripe";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { checkoutUnavailable, testCheckoutAllowed } from "@/lib/testCheckout";
import { artistSplitsForOrder, calcItemProfitCents, type PrintSize as RevenueSize } from "@/lib/revenue";
import { claimEditionNumbers, EditionSoldOutError, editionMessage, editionShortfalls } from "@/lib/editions";
import { applyDiscount, isPrintSize, parseDiscount, parseVenue, priceFor, SIZE_LABEL, sizeInches, type PrintSize } from "@/components/art/pricing";
import { sizeAllowed } from "@/lib/printSizes";
import { followFromCheckout } from "@/lib/followers";
import { SHIPPING_TAX_CODE, TAX_CODE, TAX_ENABLED } from "@/lib/tax";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REV_SIZE: Record<PrintSize, RevenueSize> = { small: "S", medium: "M", large: "L", xl: "XL" };

function baseUrlFrom(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  try { return new URL(req.url).origin; } catch { return "https://theartfinity.com"; }
}

function abs(base: string, url?: string | null) {
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) return url;
  return url.startsWith("/") ? base + url : `${base}/${url}`;
}

type Line = {
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
};

/** A size the artwork's file is too small to print sharply. */
class SizeUnavailableError extends Error {}

/** Price every line from the DB. Client prices and titles are ignored. */
async function buildLines(items: any[]): Promise<Line[]> {
  const lines = await Promise.all(
    items.map(async (item: any): Promise<Line | null> => {
      const p = item?.product ?? item ?? {};
      const slug = String(p.slug ?? "").trim();
      const size = String(p.selectedSize ?? "").toLowerCase();
      if (!slug || !isPrintSize(size)) return null;
      const frameChosen = Boolean(p.frameChosen);
      const frameColor = frameChosen && ["black", "white", "natural"].includes(String(p.frameColor)) ? String(p.frameColor) : null;

      const art = await prisma.artwork.findUnique({
        where: { slug },
        select: {
          id: true, slug: true, title: true, imageUrl: true, artistId: true, status: true,
          markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true, editionSize: true, printableSizes: true,
          artist: { select: { name: true, artist_name: true } },
        },
      });
      // Only approved work can be bought (PENDING and REJECTED are skipped).
      if (!art || art.status !== "APPROVED") return null;
      // No blurry prints: only sizes the file is sharp enough for.
      if (!sizeAllowed(art.printableSizes, size)) {
        throw new SizeUnavailableError(`${art.title} isn't available at ${SIZE_LABEL[size]} (${sizeInches(size)}). Pick a smaller size and it will print sharp.`);
      }

      // Scan discount. Short link codes (/q/CODE) are looked up: the discount and venue come from the code's record,
      // and only when it's live and belongs to this artwork (or its artist). Older printed codes carry a signed
      // ?off= instead: signed (5–30%), or an old unsigned card capped at 10% for a while (lib/scanSign.ts).
      const qr = p.code ? await resolveCode(p.code) : null;
      const byCode = qr && codeAppliesTo(qr, art) ? qr : null;
      const offRaw = parseDiscount(p.discountPct);
      const discountPct = byCode ? parseDiscount(byCode.discountPct) || 0 : scanDiscount(slug, offRaw, parseVenue(p.venue), p.discountSig).pct;
      const venue = byCode ? byCode.venue : parseVenue(p.venue);
      const { list } = priceFor(art, size, frameChosen, 0);
      const unit = applyDiscount(list, discountPct);
      const quantity = Math.max(1, Math.min(10, Math.round(Number(item?.quantity ?? p.quantity ?? 1)) || 1));

      return {
        art: { id: art.id, slug: art.slug!, title: art.title, imageUrl: art.imageUrl, artistId: art.artistId, artistName: art.artist?.artist_name || art.artist?.name || "", editionSize: art.editionSize ?? null },
        size, frameChosen, frameColor, quantity, list, unit, discountPct, venue, qrCodeId: byCode?.id ?? null,
      };
    }),
  );
  return lines.filter(Boolean) as Line[];
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const items = Array.isArray(body?.items) ? body.items : [];
  const buyer: { id?: string | null; email?: string | null; name?: string | null } = body?.buyer || {};
  const buyerEmail = (typeof buyer.email === "string" ? buyer.email : "").trim().toLowerCase() || undefined;
  // Ticked "Email me when … posts new work" (unchecked by default). Counts as consent, so no opt-in email.
  const follow = body?.follow === true;

  let lines: Line[];
  try {
    lines = await buildLines(items);
  } catch (err) {
    if (err instanceof SizeUnavailableError) return json({ error: err.message }, 400);
    console.error("checkout: pricing failed", err);
    return json({ error: "Could not price your cart" }, 500);
  }
  if (!lines.length) return json({ error: "That piece isn't available right now." }, 400);

  // Limited editions: refuse more prints than are left (numbers are assigned when the order is recorded).
  const short = await editionShortfalls(lines.map((l) => ({ artworkId: l.art.id, title: l.art.title, editionSize: l.art.editionSize, quantity: l.quantity })));
  if (short.length) return json({ error: editionMessage(short), soldOut: short }, 409);

  if (!process.env.STRIPE_SECRET_KEY) {
    if (!testCheckoutAllowed()) return checkoutUnavailable("checkout");
    return devCheckout(lines, buyerEmail, buyer, follow);
  }

  // ---- Real Stripe Checkout (Apple Pay / Google Pay / card are offered by Stripe) ----
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
    const base = baseUrlFrom(req);
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map((l) => ({
      quantity: l.quantity,
      // Limited editions: no changing the quantity on Stripe's page (we checked what's left above).
      adjustable_quantity: l.art.editionSize ? { enabled: false } : { enabled: true, minimum: 1, maximum: 10 },
      price_data: {
        currency: "usd",
        unit_amount: l.unit,
        tax_behavior: "exclusive", // sales tax is added on top at checkout
        product_data: {
          tax_code: TAX_CODE,
          name: l.discountPct ? `${l.art.title} (${l.discountPct}% scan discount)` : l.art.title,
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
          },
        },
      },
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${base}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cancel`,
      locale: "en",
      customer_creation: "always",
      customer_email: buyerEmail,
      metadata: { userId: buyer?.id || "", buyerEmail: buyerEmail ?? "", ...(follow ? { follow: "1" } : {}) },
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [{ shipping_rate_data: { display_name: "Free US shipping", fixed_amount: { amount: 0, currency: "usd" }, type: "fixed_amount", tax_behavior: "exclusive", tax_code: SHIPPING_TAX_CODE } }],
      automatic_tax: { enabled: TAX_ENABLED },
    });
    return json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    return json({ error: "Stripe session creation failed" }, 500);
  }
}

/**
 * No STRIPE_SECRET_KEY (localhost): record a paid order directly, with the same
 * fields and cost math as app/api/webhook/route.ts, then send the buyer to thank-you.
 */
async function devCheckout(lines: Line[], email: string | undefined, buyer: { name?: string | null }, follow = false) {
  const sessionId = `dev_${randomBytes(12).toString("hex")}`;
  try {
    const order = await prisma.$transaction(async (tx) => {
      // Lock limited artworks and hand out edition numbers before this order's items exist.
      const { numbers, shortfalls } = await claimEditionNumbers(tx, lines.map((l) => ({ artworkId: l.art.id, quantity: l.quantity })));
      if (shortfalls.length) throw new EditionSoldOutError(shortfalls);
      const created = await tx.order.create({
        data: {
          stripeSessionId: sessionId,
          email: email || "test-buyer@artfinity.local",
          amountTotal: lines.reduce((sum, l) => sum + l.unit * l.quantity, 0),
          currency: "usd",
          paymentStatus: "paid",
          shippingName: (typeof buyer?.name === "string" && buyer.name.trim()) || "Test buyer",
          shippingAddress: "Test order, no shipping",
        },
      });
      // Lock in each artist's split (Free 60%, Infinity higher) as of this order.
      const splits = await artistSplitsForOrder(tx, lines.map((l) => ({ artistId: l.art.artistId, quantity: l.quantity })), created.createdAt);
      await tx.orderItem.createMany({
        data: lines.map((l, i) => {
          const lineTotal = l.unit * l.quantity;
          const b = calcItemProfitCents({ lineTotal, size: REV_SIZE[l.size], frameChosen: l.frameChosen, quantity: l.quantity, orderDate: created.createdAt, artistSplit: splits[i] });
          return {
            orderId: created.id,
            artworkId: l.art.id,
            slug: l.art.slug,
            size: REV_SIZE[l.size],
            frameChosen: l.frameChosen,
            frameColor: l.frameColor,
            unitPrice: l.unit,
            quantity: l.quantity,
            lineTotal,
            title: l.art.title,
            artistName: l.art.artistName || null,
            imageUrl: l.art.imageUrl || null,
            printCost: b.printCost,
            shippingCost: b.shippingCost,
            laborCost: b.laborCost,
            websiteCost: b.websiteCost,
            editionNumber: numbers[i],
            artistSplit: splits[i],
            qrCodeId: l.qrCodeId,
          };
        }),
      });
      return created;
    });
    console.log(
      `[checkout:dev] order ${order.id} ${sessionId} $${(order.amountTotal / 100).toFixed(2)} ` +
        lines.map((l) => `${l.art.slug}/${l.size}${l.frameChosen ? "+frame" : ""}×${l.quantity}${l.discountPct ? ` -${l.discountPct}%${l.venue ? ` @${l.venue}` : ""}` : ""}`).join(", "),
    );
    if (follow && email) await followFromCheckout(email, lines.map((l) => l.art.artistId), buyer?.name).catch((e) => console.error("[checkout:dev] follow failed", e));
    return json({ url: `/thank-you?session_id=${sessionId}`, dev: true });
  } catch (err) {
    if (err instanceof EditionSoldOutError) return json({ error: err.message, soldOut: err.shortfalls }, 409);
    console.error("[checkout:dev] failed", err);
    return json({ error: "Test checkout failed" }, 500);
  }
}
