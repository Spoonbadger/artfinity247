// Recording a paid print order from Stripe's checkout.session.completed (app/api/webhook/route.ts). Moved out of the
// route unchanged so lib/checkout.test.mjs can run it: the database is passed in, and so is the call that lists the
// session's line items from Stripe.
import type { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { artistSplitsForOrder, calcItemProfitCents } from "@/lib/revenue";
import { normalizeSize } from "@/lib/sales";
import { claimEditionNumbers } from "@/lib/editions";
import { preservedSplit } from "@/lib/collectorRewards";
import { orderIdFrom, shippingFrom } from "@/lib/checkoutSession";

/** An artist buying their own prints at cost (/studio/bulk): no split, and the artist's own shipping address. */
export type BulkOrder = { kind: "bulk"; bulkArtistId: string; shippingName: string | null; shippingAddress: string | null };

/** The OrderItem row for one Stripe line item (price.product expanded), without its edition number. */
export function orderItemFromLineItem(li: Stripe.LineItem, split: number | null, order: { id: string; createdAt: Date }) {
  const product = li.price?.product as Stripe.Product | null
  const unit = li.price?.unit_amount ?? 0
  const qty = li.quantity ?? 1
  const rawSize = product?.metadata?.size || 'medium'

  const sizeNorm = normalizeSize(rawSize)
  const lineTotal = unit * qty

  const frameChosen = product?.metadata?.frameChosen === "true"
  const rawFrameColor = product?.metadata?.frameColor || ""
  const frameColor =
    frameChosen && ["black", "white", "natural"].includes(rawFrameColor)
      ? rawFrameColor
      : null
  // Collector reward (lib/collectorRewards.ts): keep the artist's share at the pre-reward price.
  const rewardFrom = Number(product?.metadata?.rewardFromUnit || 0)
  const itemSplit = rewardFrom > unit && split != null
    ? preservedSplit({ preRewardLineTotal: rewardFrom * qty, lineTotal, size: sizeNorm, frameChosen, quantity: qty, orderDate: order.createdAt, split })
    : split
  const b = calcItemProfitCents({
    lineTotal,
    size: sizeNorm,
    frameChosen,
    quantity: qty,
    orderDate: order.createdAt,
    artistSplit: itemSplit,
  })

  return {
    orderId: order.id,
    artworkId: product?.metadata?.artworkId ?? null,
    slug: product?.metadata?.slug || '',
    size: sizeNorm,
    frameChosen,
    frameColor,
    unitPrice: unit,
    quantity: qty,
    lineTotal,
    title: product?.metadata?.title || li.description || null,
    artistName: product?.metadata?.artistName || null,
    imageUrl: product?.metadata?.imageUrl || null,

    printCost: b.printCost,
    shippingCost: b.shippingCost,
    laborCost: b.laborCost,
    websiteCost: b.websiteCost,
    artistSplit: itemSplit,
    // Short link code the sale came through (checked at checkout, carried in metadata)
    qrCodeId: product?.metadata?.qrCodeId || null,
  }
}

/**
 * Create the Order (once per Stripe session) and its items (once per order). Stripe retries and duplicate events
 * find the same order and add nothing.
 */
export async function recordCheckoutOrder(
  db: PrismaClient,
  session: Stripe.Checkout.Session,
  opts: { buyerEmail: string; bulk: BulkOrder | null; listLineItems: () => Promise<{ data: Stripe.LineItem[] }> },
) {
  const { buyerEmail, bulk } = opts
  // Since API version 2025-03-31.basil the address is at collected_information.shipping_details (lib/checkoutSession.ts).
  const shipping = shippingFrom(session)
  // The order id made with the session (its code is on the buyer's card statement and Stripe receipt), if any.
  const presetId = orderIdFrom(session.metadata)
  // 1) Idempotent order create (upsert by unique stripeSessionId)
  const order = await db.order.upsert({
    where: { stripeSessionId: session.id },
    update: {
      // Don’t touch totals on retry, but update shipping/email if missing
      email: buyerEmail,
      paymentStatus: session.payment_status ?? '',
      shippingName: shipping.name,
      shippingAddress: shipping.address,
      ...(bulk ?? {}),
    },
    create: {
      ...(presetId ? { id: presetId } : {}),
      stripeSessionId: session.id,
      email: buyerEmail,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      paymentStatus: session.payment_status ?? '',
      shippingName: shipping.name,
      shippingAddress: shipping.address,
      ...(bulk ?? {}),
    },
  })

  const existingItems = await db.orderItem.count({
    where: { orderId: order.id },
  })

  // 2) Create items once (a retry finds them already there)
  if (existingItems === 0) {
    // Line items with product expanded (so product.metadata is available)
    const lineItems = await opts.listLineItems()

    // Lock in each artist's split (Free 60%, Infinity higher) as of this order. Bulk orders pay no split.
    const splits = bulk
      ? lineItems.data.map(() => null)
      : await artistSplitsForOrder(db, lineItems.data.map((li) => ({
          artistId: (li.price?.product as Stripe.Product | null)?.metadata?.artistId || null,
          quantity: li.quantity ?? 1,
        })), order.createdAt)

    const itemsToCreate = lineItems.data.map((li, idx) => orderItemFromLineItem(li, splits[idx], order))

    if (itemsToCreate.length > 0) {
      // Limited editions: number the prints inside one transaction that locks each artwork.
      // Stripe already took the money, so a line that no longer fits (two checkouts racing for
      // the last prints) is still recorded, without a number, and logged for a refund.
      await db.$transaction(async (tx) => {
        const { numbers, shortfalls } = await claimEditionNumbers(tx, itemsToCreate.map((it) => ({ artworkId: it.artworkId, quantity: it.quantity })))
        if (shortfalls.length) console.error("EDITION OVERSOLD: refund needed", { orderId: order.id, shortfalls })
        await tx.orderItem.createMany({ data: itemsToCreate.map((it, i) => ({ ...it, editionNumber: numbers[i] })) })
      })
    }
  }

  return order
}
