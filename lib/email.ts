import { Resend } from "resend";
import ReceiptEmail from "@/emails/ReceiptEmail"
import { prisma } from "@/lib/prisma";

const resendKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "Artfinity <receipts@example.com>";

export async function sendReceiptEmail(orderId: string) {
  if (!resendKey) {
    console.warn("RESEND_API_KEY missing; skipping email.");
    return { skipped: true };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      email: true,
      amountTotal: true,
      currency: true,
      shippingName: true,
      shippingAddress: true, // stored as string line already in your webhook
      receiptSentAt: true,
      items: {
        select: {
          title: true,
          imageUrl: true,
          size: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });

  if (!order || !order.email) return { skipped: true };

  // Idempotency: don’t resend if already sent
  if (order.receiptSentAt) return { alreadySent: true };

  const resend = new Resend(resendKey);

  const { data, error } = await resend.emails.send({
    from,
    to: order.email,
    subject: "Your Artfinity receipt",
    react: ReceiptEmail({
      orderId: order.id,
      email: order.email,
      totalCents: order.amountTotal,
      currency: order.currency,
      shippingName: order.shippingName,
      shippingAddressLine: order.shippingAddress ?? undefined,
      items: order.items
    }),
  });

  if (error) throw error;

  await prisma.order.update({
    where: { id: order.id },
    data: { receiptSentAt: new Date() },
  });

  return { id: data?.id };
}