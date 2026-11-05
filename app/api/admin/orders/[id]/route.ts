// POST /api/admin/orders/:id  Admin actions on one order (shipping and delivery go through /api/orders/:id/status).
//   { action: "refund", itemId, reason, note? }  record a line refund (money goes back in Stripe); reverses the artist share if
//                                            unpaid. Already paid out: absorbed, or a Refund adjustment off the next payout
//                                            (reason buyer_return | chargeback with the deduct policy, lib/refundPolicy.ts)
//   { action: "refund_undo", itemId }        cancel a recorded refund
//   { action: "reprint", items: [{ id, qty }] | itemId: id | "all", reason, note? }  free reprint (same flow as a buyer's request)
//   { action: "resend_receipt" } | { action: "resend_shipped" }
import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { itemBreakdown } from "@/lib/sales";
import { activeRefunds, REFUND_ACTION, REFUND_UNDO_ACTION } from "@/lib/refunds";
import { nextUnpaidMonth, utcMonth } from "@/lib/balance";
import { REFUND_REASON_LABEL, isRefundReason, refundEffect, refundPolicy } from "@/lib/refundPolicy";
import { decideRequest, requestsForOrder, ReprintError } from "@/lib/reprints";
import { REPRINT_DIRECTION, isReprintReason, statusSubject, type ReprintBody } from "@/lib/reprintFormat";
import { latestTracking, resendReceipt, sendShippingEmail } from "@/lib/orderEmails";
import { orderNumber } from "@/lib/printer";
import { adminRoleGuard } from "@/lib/adminRoles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return fail("Forbidden", 403);
  const input = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 600) : "";

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      id: true, email: true, kind: true, paymentStatus: true, shippingStatus: true, createdAt: true,
      items: { select: { id: true, title: true, size: true, quantity: true, lineTotal: true, unitPrice: true, frameChosen: true, artistSplit: true, artwork: { select: { artistId: true } } } },
    },
  });
  if (!order) return fail("Order not found.", 404);
  const no = orderNumber(order.id);

  // Refunds are money: owner and admin only (support handles everything else here).
  if (input.action === "refund" || input.action === "refund_undo") {
    const { denied } = await adminRoleGuard("money");
    if (denied) return denied;
  }

  switch (input.action) {
    case "refund": {
      const item = order.items.find((i) => i.id === input.itemId);
      if (!item) return fail("Pick a line to refund.");
      if (order.paymentStatus !== "paid" || order.kind === "bulk") return fail("Only paid retail orders can be refunded here.");
      const reason = isRefundReason(input.reason) ? input.reason : null;
      if (!reason) return fail("Pick a reason for the refund.");
      if ((await activeRefunds([order.id])).has(item.id)) return fail("That line is already refunded.", 409);
      const b = itemBreakdown({ ...item, orderDate: order.createdAt });
      const artistId = item.artwork?.artistId ?? null;
      const month = utcMonth(order.createdAt);
      const paid = artistId ? await prisma.payout.findUnique({ where: { artistId_month: { artistId, month } }, select: { paidAt: true } }) : null;
      // Reverse only what hasn't gone out yet; a paid month keeps its recorded amount. Once paid out, the owner's setting
      // decides for buyer returns and chargebacks (lib/refundPolicy.ts); damaged prints are always absorbed.
      const { policy } = await refundPolicy();
      const effect = artistId ? refundEffect({ monthPaid: !!paid?.paidAt, reason, policy }) : "absorb";
      const reversed = effect === "reverse";
      const deducted = effect === "deduct" && b.artistShare > 0;
      // Into the artist's next payout: their oldest unpaid month (all closed unpaid months go out together), else this month.
      const adjustMonth = deducted && artistId ? await nextUnpaidMonth(artistId) : null;
      const title = item.title || "print";
      const outcome = reversed ? `artist share ${money(b.artistShare)} reversed`
        : deducted ? `${month} already paid out: ${money(b.artistShare)} comes off the artist's next payout (Refund adjustment)`
        : artistId ? `${month} already paid out: artist keeps ${money(b.artistShare)}` : "";
      await logAdminAction(admin, REFUND_ACTION, { type: "order", id: order.id },
        `Refunded “${title}” (${money(b.lineTotal)}, ${REFUND_REASON_LABEL[reason].toLowerCase()})${outcome ? `, ${outcome}` : ""}`,
        { orderItemId: item.id, artistId, amountCents: b.lineTotal, shareCents: b.artistShare, reversed, deducted, adjustMonth, reason, policy, title, month, note });
      return NextResponse.json({
        ok: true, reversed, deducted, shareCents: b.artistShare,
        message: reversed ? `Refund recorded. ${money(b.artistShare)} taken off the artist's balance.`
          : deducted ? `Refund recorded. ${money(b.artistShare)} comes off the artist's next payout.`
          : "Refund recorded. Already paid out, so the artist keeps their share.",
      });
    }
    case "refund_undo": {
      const item = order.items.find((i) => i.id === input.itemId);
      const r = item ? (await activeRefunds([order.id])).get(item.id) : undefined;
      if (!item || !r) return fail("That line isn't refunded.", 409);
      // A Refund adjustment that already came off a payout can't silently come back.
      if (r.deducted && r.adjustMonth && r.artistId) {
        const p = await prisma.payout.findUnique({ where: { artistId_month: { artistId: r.artistId, month: r.adjustMonth } }, select: { paidAt: true } });
        if (p?.paidAt) return fail(`The refund adjustment already came off the artist's ${r.adjustMonth} payout. Unmark that payout first, or settle it with the artist by hand.`, 409);
      }
      await logAdminAction(admin, REFUND_UNDO_ACTION, { type: "order", id: order.id }, `Cancelled the refund on “${item.title || "print"}”`,
        { orderItemId: item.id, artistId: item.artwork?.artistId ?? null, refundActionId: r.actionId, note });
      return NextResponse.json({ ok: true });
    }
    case "reprint": {
      const reason = isReprintReason(input.reason) ? input.reason : null;
      if (!reason) return fail("Pick what went wrong.");
      const byId = new Map(order.items.map((i) => [i.id, i]));
      // items: [{ id, qty }], or itemId: one line id or "all" (whole lines).
      const picked = Array.isArray(input.items) ? input.items
        : input.itemId === "all" ? order.items.map((i) => ({ id: i.id, qty: i.quantity ?? 1 }))
        : typeof input.itemId === "string" ? [{ id: input.itemId, qty: byId.get(input.itemId)?.quantity ?? 1 }] : [];
      const items = picked
        .map((x: any) => {
          const it = byId.get(String(x?.id ?? ""));
          return it ? { id: it.id, qty: Math.min(it.quantity ?? 1, Math.max(1, Math.round(Number(x?.qty) || 1))) } : null;
        })
        .filter((x): x is { id: string; qty: number } => !!x);
      if (!items.length) return fail("Pick the print to reprint.");
      if ((await requestsForOrder(order.id)).some((r) => r.status === "open")) return fail("This order has an open reprint request. Decide it in Reprints.", 409);
      const artistId = items.map((i) => byId.get(i.id)?.artwork?.artistId).find(Boolean);
      if (!artistId) return fail("This piece isn't listed anymore, so it can't be reprinted from here.", 410);
      const body: ReprintBody = { v: 1, reason, note: note || "Created by Artfinity", photos: [], items };
      const msg = await prisma.message.create({
        data: { artistId, email: `reprint:${order.id}`, orderId: order.id, direction: REPRINT_DIRECTION, subject: statusSubject("open"), body: JSON.stringify(body) },
        select: { id: true },
      });
      try {
        const r = await decideRequest(msg.id, "approve", note);
        await logAdminAction(admin, "reprint.create", { type: "reprint", id: msg.id }, `Created a free reprint for order ${no}`, { orderId: order.id, reprintOrderId: r.reprintOrderId, reason, items, note });
        return NextResponse.json({ ok: true, ...r });
      } catch (err) {
        await prisma.message.delete({ where: { id: msg.id } }).catch(() => null);
        if (err instanceof ReprintError) return fail(err.message, err.status);
        throw err;
      }
    }
    case "resend_receipt": {
      if (order.paymentStatus !== "paid") return fail("Only paid orders have a receipt.");
      const r = await resendReceipt(order.id);
      await logAdminAction(admin, "order.resend_receipt", { type: "order", id: order.id }, r === "sent" ? `Resent the receipt to ${order.email}` : "Receipt resend skipped (email not configured)");
      return NextResponse.json({ ok: true, status: r, message: r === "sent" ? "Receipt sent" : "Skipped: email isn't configured on this server" });
    }
    case "resend_shipped": {
      if (order.shippingStatus === "pending") return fail("This order hasn't shipped yet.");
      const status = order.shippingStatus === "delivered" ? "delivered" : "shipped";
      const via = await sendShippingEmail(order.id, status, status === "shipped" ? await latestTracking(order.id) : null);
      await logAdminAction(admin, "order.resend_shipping_email", { type: "order", id: order.id }, `Resent the ${status} email to ${order.email}`, { via });
      return NextResponse.json({ ok: true, status });
    }
    default:
      return fail("Unknown action.");
  }
}
