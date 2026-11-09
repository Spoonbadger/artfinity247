import { scanDiscount } from "@/lib/scanSign";
import { codeAppliesTo, resolveCode, scanVenue } from "@/lib/shortlinks";
import Stripe from "stripe";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { checkoutUnavailable, testCheckoutAllowed } from "@/lib/testCheckout";
import { artistSplitsForOrder, calcItemProfitCents, type PrintSize as RevenueSize } from "@/lib/revenue";
import { claimEditionNumbers, EditionSoldOutError, editionMessage, editionShortfalls } from "@/lib/editions";
import { applyDiscount, isPrintSize, parseDiscount, parseVenue, priceFor, SIZE_LABEL, sizeInches, type PrintSize } from "@/components/art/pricing";
import { sizeAllowed } from "@/lib/printSizes";
import { followFromCheckout } from "@/lib/followers";
import { sendWorkOrder } from "@/lib/printer";
import { SHIPPING_TAX_CODE, TAX_CODE, TAX_ENABLED } from "@/lib/tax";
import { getCollector, onOrderPaid } from "@/lib/collector";
import { markRewardUsed, preservedSplit, rewardOffUnit, validateReward } from "@/lib/collectorRewards";
import { codeOf, newOrderId, statementSuffix } from "@/lib/checkoutSession";
import { deliveryRange } from "@/lib/delivery";
import { HELP_DAYS_AFTER_DELIVERY } from "@/lib/reprintFormat";

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
  preRewardUnit?: number; // collector reward: the unit price before it (the artist's share is kept at this price)
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
          artist: { select: { name: true, artist_name: true, closedAt: true, suspendedAt: true } },
        },
      });
      // Only approved work can be bought (PENDING and REJECTED are skipped), and not from a suspended or closed artist.
      if (!art || art.status !== "APPROVED" || art.artist.closedAt || art.artist.suspendedAt) return null;
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
      const venue = byCode ? scanVenue(byCode) : parseVenue(p.venue);
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
  // A signed-in collector (optional, lib/collector.ts) gets their verified email filled in when none was typed.
  const collector = await getCollector().catch(() => null);
  const buyerEmail = (typeof buyer.email === "string" ? buyer.email : "").trim().toLowerCase() || collector?.email || undefined;
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

  // Collector reward code (lib/collectorRewards.ts): only for the email it was issued to, while rewards are on.
  // Comes out of Artfinity's share only: capped per print at Artfinity's share, and the artist's share is kept at the pre-reward price.
  const reward = body?.rewardCode ? await validateReward(body.rewardCode, buyerEmail).catch(() => null) : null;
  if (reward) {
    const splits = await artistSplitsForOrder(prisma, lines.map((l) => ({ artistId: l.art.artistId, quantity: 1 })), new Date());
    lines = lines.map((l, i) => {
      const off = rewardOffUnit(l.unit, reward.pct, REV_SIZE[l.size], l.frameChosen, splits[i]);
      return off > 0 ? { ...l, preRewardUnit: l.unit, unit: l.unit - off } : l;
    });
  }
  const rewardMeta = reward && buyerEmail ? { rewardCode: String(body.rewardCode).trim().toUpperCase(), rewardN: String(reward.n) } : null;

  // { quote: true }: the exact amounts the Pay button will charge (before tax), priced from the database, so the
  // checkout summary never differs from Stripe's page. Nothing is created.
  if (body?.quote === true) {
    const listTotal = lines.reduce((n, l) => n + l.list * l.quantity, 0);
    const beforeReward = lines.reduce((n, l) => n + (l.preRewardUnit ?? l.unit) * l.quantity, 0);
    const total = lines.reduce((n, l) => n + l.unit * l.quantity, 0);
    return json({
      lines: lines.map((l) => ({ slug: l.art.slug, size: l.size, frameChosen: l.frameChosen, frameColor: l.frameColor, quantity: l.quantity, list: l.list, unit: l.unit, discountPct: l.discountPct })),
      listTotal,
      scanDiscount: listTotal - beforeReward,
      reward: beforeReward - total,
      shipping: 0,
      total,
      tax: !process.env.STRIPE_SECRET_KEY ? "test" : TAX_ENABLED ? "added" : "none",
    });
  }

  // Made now so its code ("XX1KP4") can go on the card statement and the Stripe receipt; the webhook uses it.
  const orderId = newOrderId();
  const code = codeOf(orderId);

  if (!process.env.STRIPE_SECRET_KEY) {
    if (!testCheckoutAllowed()) return checkoutUnavailable("checkout");
    return devCheckout(orderId, lines, buyerEmail, buyer, follow, rewardMeta ? { email: buyerEmail!, n: reward!.n } : null);
  }

  // ---- Real Stripe Checkout (Apple Pay / Google Pay / card are offered by Stripe) ----
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
    const base = baseUrlFrom(req);
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map((l) => ({
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
    }));

    const titles = Array.from(new Set(lines.map((l) => l.art.title)));
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "pay",
      line_items,
      success_url: `${base}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cancel?order=${code}`,
      // Long enough to find a card, short enough that a forgotten tab doesn't hold an old price.
      expires_at: Math.floor(Date.now() / 1000) + 2 * 3600,
      locale: "en",
      customer_creation: "always",
      customer_email: buyerEmail,
      metadata: { orderId, userId: buyer?.id || "", buyerEmail: buyerEmail ?? "", ...(follow ? { follow: "1" } : {}), ...(collector ? { collectorId: collector.id } : {}), ...(rewardMeta ?? {}) },
      payment_intent_data: {
        description: `Artfinity order ${code}: ${titles.join(", ")}`.slice(0, 1000),
        // Card statement: "ARTFINITY* XX1KP4" (the prefix is set in the Stripe Dashboard, BILLING_SETUP.md).
        statement_descriptor_suffix: statementSuffix(code),
        metadata: { orderId, orderCode: code },
      },
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [{ shipping_rate_data: { display_name: "Free US shipping", fixed_amount: { amount: 0, currency: "usd" }, type: "fixed_amount", tax_behavior: "exclusive", tax_code: SHIPPING_TAX_CODE } }],
      automatic_tax: { enabled: TAX_ENABLED },
      custom_text: {
        shipping_address: { message: `Printed in NYC and shipped free in the US, with tracking. Arrives ${deliveryRange()}.` },
        // The terms and privacy links come from Stripe's Checkout settings (BILLING_SETUP.md), shown under the button.
        submit: { message: `Order ${code}. Arrives damaged? We reprint it free within ${HELP_DAYS_AFTER_DELIVERY} days of delivery.` },
      },
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
async function devCheckout(orderId: string, lines: Line[], email: string | undefined, buyer: { name?: string | null }, follow = false, reward: { email: string; n: number } | null = null) {
  const sessionId = `dev_${randomBytes(12).toString("hex")}`;
  try {
    const order = await prisma.$transaction(async (tx) => {
      // Lock limited artworks and hand out edition numbers before this order's items exist.
      const { numbers, shortfalls } = await claimEditionNumbers(tx, lines.map((l) => ({ artworkId: l.art.id, quantity: l.quantity })));
      if (shortfalls.length) throw new EditionSoldOutError(shortfalls);
      const created = await tx.order.create({
        data: {
          id: orderId,
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
          // A collector reward keeps the artist's share at the pre-reward price (lib/collectorRewards.ts).
          const split = l.preRewardUnit
            ? preservedSplit({ preRewardLineTotal: l.preRewardUnit * l.quantity, lineTotal, size: REV_SIZE[l.size], frameChosen: l.frameChosen, quantity: l.quantity, orderDate: created.createdAt, split: splits[i] })
            : splits[i];
          const b = calcItemProfitCents({ lineTotal, size: REV_SIZE[l.size], frameChosen: l.frameChosen, quantity: l.quantity, orderDate: created.createdAt, artistSplit: split });
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
            artistSplit: split,
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
    if (reward) await markRewardUsed(reward.email, reward.n, order.id).catch((e) => console.error("[checkout:dev] reward not marked used", e));
    await onOrderPaid(order.id);
    if (follow && email) await followFromCheckout(email, lines.map((l) => l.art.artistId), buyer?.name).catch((e) => console.error("[checkout:dev] follow failed", e));
    // Same as the webhook: send the print lab its work order (never throws; failures show in admin orders).
    const wo = await sendWorkOrder(order.id);
    if (wo.status === "failed") console.error("[checkout:dev] work order not sent", order.id, wo.error);
    return json({ url: `/thank-you?session_id=${sessionId}`, dev: true });
  } catch (err) {
    if (err instanceof EditionSoldOutError) return json({ error: err.message, soldOut: err.shortfalls }, 409);
    console.error("[checkout:dev] failed", err);
    return json({ error: "Test checkout failed" }, 500);
  }
}
