// POST /api/studio/bulk: an artist orders their own prints at cost (Order.kind = "bulk").
// Same two paths as /api/create-checkout-session: Stripe Checkout when STRIPE_SECRET_KEY is set
// (the webhook records the order from session metadata), otherwise a paid test order right away.
// Bulk orders never count toward earnings, medals, customers or payouts (those queries skip kind "bulk").
import Stripe from "stripe";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendWorkOrder } from "@/lib/printer";
import { checkoutUnavailable, testCheckoutAllowed } from "@/lib/testCheckout";
import { getUserFromCookie } from "@/lib/auth";
import { calcItemProfitCents } from "@/lib/revenue";
import { BULK_MAX_LINES, BULK_MAX_PER_LINE, BULK_SIZE_KEY, BULK_SIZE_LABEL, bulkQuote, isBulkSize } from "@/lib/bulk";
import { claimEditionNumbers, EditionSoldOutError, editionMessage, editionShortfalls } from "@/lib/editions";
import { sizeAllowed } from "@/lib/printSizes";
import { TAX_CODE, TAX_ENABLED } from "@/lib/tax";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const clean = (v: unknown, max = 120) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function baseUrlFrom(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  try { return new URL(req.url).origin; } catch { return "https://theartfinity.com"; }
}

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return json({ error: "Log in to keep going.", code: "not_logged_in" }, 401);
  const artist = await prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, email: true, name: true, artist_name: true } });
  if (!artist) return json({ error: "Log in to keep going.", code: "not_logged_in" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Something was missing from that request. Refresh and try again.", code: "bad_request" }, 400); }

  // Lines: only the artist's own, non-rejected work.
  const raw = Array.isArray(body?.lines) ? body.lines.slice(0, BULK_MAX_LINES) : [];
  const ids = Array.from(new Set(raw.map((l: any) => String(l?.artworkId ?? "")).filter(Boolean))) as string[];
  const arts = await prisma.artwork.findMany({
    where: { id: { in: ids }, artistId: artist.id, status: { not: "REJECTED" } },
    select: { id: true, slug: true, title: true, imageUrl: true, editionSize: true, printableSizes: true },
  });
  const byId = new Map(arts.map((a) => [a.id, a]));
  const lines = raw
    .map((l: any) => {
      const art = byId.get(String(l?.artworkId ?? ""));
      const size = String(l?.size ?? "");
      const quantity = Math.round(Number(l?.quantity));
      if (!art || !isBulkSize(size) || !Number.isFinite(quantity) || quantity < 1 || quantity > BULK_MAX_PER_LINE) return null;
      const framed = Boolean(l?.framed);
      const frameColor = framed && ["black", "white", "natural"].includes(String(l?.frameColor)) ? String(l.frameColor) : framed ? "black" : null;
      return { art, size, framed, frameColor, quantity };
    })
    .filter(Boolean) as { art: (typeof arts)[number]; size: "S" | "M" | "L" | "XL"; framed: boolean; frameColor: string | null; quantity: number }[];
  if (!lines.length) return json({ error: "Add at least one print.", code: "no_lines" }, 400);

  // No blurry prints, same rule as retail checkout: only sizes the file is sharp enough for.
  const blurry = lines.find((l) => !sizeAllowed(l.art.printableSizes, BULK_SIZE_KEY[l.size]));
  if (blurry) {
    const s = BULK_SIZE_LABEL[blurry.size];
    return json({ error: `${blurry.art.title} isn't sharp enough for ${s.name} (${s.inches}). Pick a smaller size.`, code: "size_too_big", size: blurry.size, artworkId: blurry.art.id }, 400);
  }

  // Ship to (required: these go to the artist, not a buyer)
  const ship = {
    name: clean(body?.ship?.name, 80),
    line1: clean(body?.ship?.line1),
    line2: clean(body?.ship?.line2),
    city: clean(body?.ship?.city, 60),
    state: clean(body?.ship?.state, 30),
    zip: clean(body?.ship?.zip, 12),
  };
  if (!ship.name || !ship.line1 || !ship.city || !ship.state || !/^\d{5}(-\d{4})?$/.test(ship.zip)) {
    return json({ error: "Add a full US shipping address.", code: "address_required" }, 400);
  }
  const shipAddress = `${ship.line1}${ship.line2 ? `, ${ship.line2}` : ""}, ${ship.city}, ${ship.state} ${ship.zip}, US`;

  const quote = bulkQuote(lines);

  // Limited editions: bulk prints use up numbers too, so refuse more than are left.
  const short = await editionShortfalls(lines.map((l) => ({ artworkId: l.art.id, title: l.art.title, editionSize: l.art.editionSize, quantity: l.quantity })));
  if (short.length) return json({ error: editionMessage(short), code: "sold_out", soldOut: short }, 409);

  if (!process.env.STRIPE_SECRET_KEY) {
    if (!testCheckoutAllowed()) return checkoutUnavailable("bulk");
    return testOrder();
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
    const base = baseUrlFrom(req);
    const artistName = artist.artist_name || artist.name || "";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "en",
      customer_email: artist.email,
      line_items: lines.map((l, i) => ({
        quantity: l.quantity,
        price_data: {
          currency: "usd",
          unit_amount: quote.lines[i].unitAfter,
          tax_behavior: "exclusive",
          product_data: {
            tax_code: TAX_CODE,
            name: `${l.art.title}, ${BULK_SIZE_LABEL[l.size].name}${l.framed ? " framed" : ""} (at cost)`,
            metadata: {
              artworkId: l.art.id,
              slug: l.art.slug ?? "",
              size: BULK_SIZE_KEY[l.size],
              title: l.art.title,
              artistName,
              imageUrl: l.art.imageUrl ?? "",
              artistId: artist.id,
              frameChosen: l.framed ? "true" : "false",
              frameColor: l.frameColor ?? "",
            },
          },
        },
      })),
      // The handling fee rides as the shipping rate, so no extra line item reaches the webhook.
      shipping_options: [{ shipping_rate_data: { display_name: "Handling, US shipping included", fixed_amount: { amount: quote.handling, currency: "usd" }, type: "fixed_amount", tax_behavior: "exclusive" } }],
      automatic_tax: { enabled: TAX_ENABLED },
      metadata: { kind: "bulk", bulkArtistId: artist.id, buyerEmail: artist.email, shipName: ship.name, shipAddress, tags: body?.tags ? "yes" : "" },
      success_url: `${base}/studio/bulk?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/studio/bulk`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error("bulk: Stripe session failed", err);
    return json({ error: "Checkout didn't open. Try again.", code: "server_error" }, 500);
  }

  /** No Stripe keys (localhost): record a paid bulk order now. Same fields as the webhook writes. */
  async function testOrder() {
    const sessionId = `dev_${randomBytes(12).toString("hex")}`;
    try {
      const order = await prisma.$transaction(async (tx) => {
        const { numbers, shortfalls } = await claimEditionNumbers(tx, lines.map((l) => ({ artworkId: l.art.id, quantity: l.quantity })));
        if (shortfalls.length) throw new EditionSoldOutError(shortfalls);
        const created = await tx.order.create({
          data: {
            stripeSessionId: sessionId,
            email: artist!.email,
            amountTotal: quote.total,
            currency: "usd",
            paymentStatus: "paid",
            kind: "bulk",
            bulkArtistId: artist!.id,
            shippingName: ship.name,
            shippingAddress: shipAddress,
          },
        });
        await tx.orderItem.createMany({
          data: lines.map((l, i) => {
            const lineTotal = quote.lines[i].lineTotal;
            const b = calcItemProfitCents({ lineTotal, size: l.size, frameChosen: l.framed, quantity: l.quantity, orderDate: created.createdAt });
            return {
              orderId: created.id,
              artworkId: l.art.id,
              slug: l.art.slug,
              size: l.size,
              frameChosen: l.framed,
              frameColor: l.frameColor,
              unitPrice: quote.lines[i].unitAfter,
              quantity: l.quantity,
              lineTotal,
              title: l.art.title,
              artistName: artist!.artist_name || artist!.name || null,
              imageUrl: l.art.imageUrl || null,
              printCost: b.printCost,
              shippingCost: b.shippingCost,
              laborCost: b.laborCost,
              websiteCost: b.websiteCost,
              editionNumber: numbers[i],
            };
          }),
        });
        return created;
      });
      console.log(`[bulk:dev] order ${order.id} ${sessionId} ${quote.prints} prints $${(quote.total / 100).toFixed(2)}`);
      // Same as the webhook: the print lab gets its work order (never throws).
      await sendWorkOrder(order.id);
      return json({ url: `/studio/bulk?placed=${order.id}`, dev: true });
    } catch (err) {
      if (err instanceof EditionSoldOutError) return json({ error: err.message, code: "sold_out", soldOut: err.shortfalls }, 409);
      console.error("[bulk:dev] failed", err);
      return json({ error: "The test order didn't go through. Try again.", code: "server_error" }, 500);
    }
  }
}
