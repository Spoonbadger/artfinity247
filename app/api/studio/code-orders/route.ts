// POST /api/studio/code-orders { address, expectTotal? } → "Have us print them": every code in the print queue,
// printed, laminated, cut and mailed at cost (lib/codePrints.ts). Same two paths as /api/studio/bulk: Stripe Checkout
// when STRIPE_SECRET_KEY is set (→ { url } to Stripe), otherwise a paid test order right away (→ { url, dev: true }).
// expectTotal is the total the artist saw; if the price changed since, nothing is charged and the new total comes back.
import { NextRequest, NextResponse } from "next/server";
import { activeUserGuard } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkoutUnavailable, testCheckoutAllowed } from "@/lib/testCheckout";
import { checkoutSession, codePrintPricing, countsOf, isInfinity, markCodeOrderPaid, type OrderItemSnap } from "@/lib/codePrints";
import { cleanAddress, quoteFor } from "@/lib/printQueueFormat";
import { jobsByFormat, loadQueue } from "@/lib/printQueue";
import { baseUrl } from "../../qr/art";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const err = (error: string, code: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ error, code, ...extra }, { status });

export async function POST(req: NextRequest) {
  const { user, denied } = await activeUserGuard("Log in to order printed codes.");
  if (denied) return denied;
  const artist = await prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, email: true, name: true, artist_name: true } });
  if (!artist) return err("Log in to order printed codes.", "not_logged_in", 401);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const addr = cleanAddress(body?.address);
  if ("error" in addr) return err(addr.error, "address_required", 400, { field: addr.field });

  const rows = await loadQueue(artist.id);
  if (!rows.length) return err("Your print queue is empty. Add codes first.", "queue_empty", 400);

  const codeBase = process.env.NEXT_PUBLIC_APP_URL || baseUrl(req);
  const items: OrderItemSnap[] = [];
  for (const list of Array.from(jobsByFormat(rows, codeBase).values())) {
    for (const g of list) items.push({ qrCodeId: g.row.qrCodeId, code: g.row.qrCode.code, artworkId: g.row.artworkId, format: g.job.design.format, qty: g.qty, design: g.job.design, art: g.job.art, qrText: g.job.qrText });
  }
  const pricing = await codePrintPricing();
  const quote = quoteFor(countsOf(items), pricing, { infinity: await isInfinity(artist.id) });
  if (typeof body?.expectTotal === "number" && Math.round(body.expectTotal) !== quote.total) {
    return err("The price changed since you opened this page. Check the new total and order again.", "price_changed", 409, { total: quote.total });
  }

  const hasStripe = !!process.env.STRIPE_SECRET_KEY;
  if (!hasStripe && !testCheckoutAllowed()) return checkoutUnavailable("code-prints");

  const a = addr.address;
  const { placeholder: _p, ...pricingSnap } = pricing;
  try {
    const order = await prisma.codePrintOrder.create({
      data: {
        artistId: artist.id, email: artist.email, artistName: artist.artist_name || artist.name || null, status: "pending",
        items: items as unknown as object, queueItemIds: rows.map((r) => r.id), cards: quote.cards,
        shipName: a.name, shipLine1: a.line1, shipLine2: a.line2 || null, shipCity: a.city, shipState: a.state, shipZip: a.zip,
        subtotalCents: quote.subtotal, shippingCents: quote.shipping, handlingCents: quote.handling, totalCents: quote.total, pricing: pricingSnap,
      },
    });
    if (!hasStripe) {
      // Test checkout (localhost): paid right away, the same as the webhook would do.
      await prisma.codePrintOrder.update({ where: { id: order.id }, data: { stripeSessionId: `dev_${order.id}` } });
      await markCodeOrderPaid(order.id);
      console.log(`[code-prints:dev] order ${order.id} ${quote.cards} cards $${(quote.total / 100).toFixed(2)}`);
      return NextResponse.json({ url: `/studio/qr/queue?paid=${order.id}`, id: order.id, dev: true });
    }
    const url = await checkoutSession(order, baseUrl(req));
    return NextResponse.json({ url, id: order.id });
  } catch (e) {
    console.error("[code-prints] checkout failed", e);
    return err("Checkout didn't open. Nothing was charged. Try again.", "server_error", 500);
  }
}
