import { editionLabel } from "@/lib/editions";
import ReceiptEmail from "@/emails/ReceiptEmail";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { deliveryRange } from "@/lib/delivery";
import { frameText, friendlySize, orderCode } from "@/lib/orderText";
import { rewardSettings } from "@/lib/collectorRewards";

const from = process.env.EMAIL_FROM || "Artfinity <contact@theartfinity.com>";

/**
 * Artfinity's default receipt. Goes through the shared client (lib/resend): logged in dev, retried on passing errors.
 * Idempotent: an order whose receipt already went out is skipped.
 */
export async function sendReceiptEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      email: true,
      amountTotal: true,
      currency: true,
      createdAt: true,
      shippingName: true,
      shippingAddress: true,
      receiptSentAt: true,
      items: {
        select: {
          title: true,
          imageUrl: true,
          size: true,
          quantity: true,
          unitPrice: true,
          frameChosen: true,
          frameColor: true,
          editionNumber: true,
          artwork: { select: { editionSize: true, artist: { select: { name: true, artist_name: true } } } },
        },
      },
    },
  });

  if (!order || !order.email) return { skipped: true };

  // Idempotency: don't resend if already sent
  if (order.receiptSentAt) return { alreadySent: true };

  const code = orderCode(order.id);
  const rewards = (await rewardSettings().catch(() => null))?.enabled ?? false;
  const { data, error } = await resend.emails.send(
    {
      from,
      to: order.email,
      subject: `Your Artfinity order ${code}`,
      react: ReceiptEmail({
        code,
        totalCents: order.amountTotal,
        currency: order.currency,
        shippingName: order.shippingName,
        shippingAddressLine: order.shippingAddress ?? undefined,
        arrives: deliveryRange(order.createdAt),
        rewards,
        items: order.items.map((it) => ({
          title: it.title,
          imageUrl: it.imageUrl,
          size: friendlySize(it.size),
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          frame: frameText(it.frameChosen, it.frameColor),
          artist: it.artwork?.artist ? it.artwork.artist.artist_name || it.artwork.artist.name : null,
          edition: editionLabel(it.editionNumber, it.quantity, it.artwork?.editionSize),
        })),
      }),
    },
    { idempotencyKey: `receipt-${order.id}` },
  );

  if (error) throw error;

  await prisma.order.update({
    where: { id: order.id },
    data: { receiptSentAt: new Date() },
  });

  return { id: data?.id };
}
