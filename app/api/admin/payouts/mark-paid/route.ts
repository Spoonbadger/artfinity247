import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { adminRoleGuard } from "@/lib/adminRoles"
import { alertKey, resolveAlerts } from "@/lib/alerts"
import { calcItemProfitCents, type PrintSize } from "@/lib/revenue"
import { resend } from "@/lib/resend"
import PayoutSentEmail from "@/emails/PayoutSentEmail"
import { activeRefunds, shareAfterRefund } from "@/lib/refunds"
import { logAdminAction } from "@/lib/audit"
import { carriedInto, getBalance } from "@/lib/balance"
import { settleCarried, unsettleCarried } from "@/lib/payouts"

export const dynamic = "force-dynamic"


export const runtime = "nodejs"


export async function POST(req: NextRequest) {
  // Money: owner and admin only (lib/adminRoles.ts).
  const { admin, denied } = await adminRoleGuard("money")
  if (denied) return denied

  const { artistId, month, unmark } = await req.json()
  if (!artistId || !month) {
    return NextResponse.json({ error: "artistId and month required" }, { status: 400 })
  }

  // fetch existing payout FIRST so we can know "previously unpaid?"
  const existing = await prisma.payout.findUnique({
    where: { artistId_month: { artistId, month } },
    select: { paidAt: true, stripeTransferId: true },
  })
  // A real Stripe transfer can't be undone here: reverse it in Stripe first, then clear it.
  if (unmark && existing?.paidAt && existing.stripeTransferId && !existing.stripeTransferId.startsWith("tr_sim_")) {
    return NextResponse.json({ error: `Paid by Stripe transfer ${existing.stripeTransferId}. Reverse it in Stripe first.` }, { status: 409 })
  }

  // get month date range (UTC-safe, same logic as payouts export)
  const [y, m] = month.split("-").map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = m === 12
    ? new Date(Date.UTC(y + 1, 0, 1))
    : new Date(Date.UTC(y, m, 1))

  // fetch all paid order items for that artist in that month
  const items = await prisma.orderItem.findMany({
    where: {
      artwork: { artistId },
      order: {
        createdAt: { gte: start, lt: end },
        paymentStatus: "paid",
        kind: { not: "bulk" },
      },
    },
    select: {
      id: true,
      orderId: true,
      lineTotal: true,
      unitPrice: true,
      size: true,
      frameChosen: true,
      quantity: true,
      artistSplit: true,
      order: {
        select: {
          createdAt: true,
        },
      },
    },
  })

  function normalizeSize(raw: string | null): PrintSize {
    const v = (raw || "").toUpperCase()
    if (v.startsWith("S")) return "S"
    if (v.startsWith("XL")) return "XL"
    if (v.startsWith("L")) return "L"
    return "M"
  }

  const refunds = await activeRefunds(Array.from(new Set(items.map((i) => i.orderId))))
  const salesCents = items.reduce((sum: any, item: any) => {
    const sizeNorm = normalizeSize(item.size)
    const b = calcItemProfitCents({
      // Same fallback as /api/admin/payouts/summary, so the recorded amount matches what the admin saw.
      lineTotal: item.lineTotal ?? (item.unitPrice ?? 0) * (item.quantity ?? 0),
      size: sizeNorm,
      frameChosen: item.frameChosen,
      quantity: item.quantity || 1,
      orderDate: item.order.createdAt,
      artistSplit: item.artistSplit,
    })
    return sum + shareAfterRefund(b.artistShare, refunds.get(item.id))
  }, 0)

  // Refund adjustments and carry-forward (lib/balance.ts): pay exactly what the artist's Money page shows for the month.
  const balance = await getBalance(artistId)
  const row = balance.payouts.find((p) => p.month === month)
  const amountCents: number = row && row.status !== "paid" ? row.payableCents : salesCents


  if (unmark) {
    // $0 months settled along with this one (a refund adjustment used them up) go back to unpaid too.
    if (existing?.paidAt) await unsettleCarried(artistId, existing.paidAt)
    const payout = await prisma.payout.upsert({
      where: { artistId_month: { artistId, month } },
      update: { paidAt: null, amountCents, method: null, stripeTransferId: null, failureReason: null },
      create: { artistId, month, amountCents, paidAt: null },
    })
    await logAdminAction(admin, "payout.unmark_paid", { type: "payout", id: payout.id }, `Unmarked ${month} payout as paid`, { artistId, month, amountCents, wasPaid: !!existing?.paidAt })

    return NextResponse.json({
      payout,
      wasPaidBefore: !!existing?.paidAt,
      markedPaid: false,
    })
  }

  // MARK AS PAID (by hand: Venmo, or another way when they have no handle)
  if (existing?.paidAt) {
    return NextResponse.json({ payout: existing, wasPaidBefore: true, markedPaid: true })
  }
  if (row && row.carryOutCents < 0) {
    return NextResponse.json({ error: `Refund adjustments are more than this month's earnings, so there's nothing to pay. The remaining $${(-row.carryOutCents / 100).toFixed(2)} comes off the next month.` }, { status: 409 })
  }
  const who = await prisma.artist.findUnique({ where: { id: artistId }, select: { venmoHandle: true } })
  const method = who?.venmoHandle ? "venmo" : "manual"
  const paidAt = new Date()
  const payout = await prisma.payout.upsert({
    where: { artistId_month: { artistId, month } },
    update: { paidAt, amountCents, method, stripeTransferId: null, failureReason: null },
    create: { artistId, month, amountCents, paidAt, method },
  })
  const settled = row ? carriedInto(balance, month) : []
  await settleCarried(artistId, settled, paidAt)
  await resolveAlerts([alertKey.payoutFailed(artistId, month), alertKey.payoutLate(artistId, month)])
  await logAdminAction(admin, "payout.mark_paid", { type: "payout", id: payout.id }, `Marked ${month} payout paid ($${(amountCents / 100).toFixed(2)}, ${method})${settled.length ? `, settling ${settled.join(", ")} at $0` : ""}`, { artistId, month, amountCents, method, ...(settled.length ? { settled } : {}) })

  // send email ONLY when transitioning unpaid → paid
  if (!existing?.paidAt) {
    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
      select: { email: true, artist_name: true },
    })

    if (artist?.email) {
      await resend.emails.send({
        from: "Artfinity <notifications@theartfinity.com>",
        to: artist.email,
        subject: `Your Artfinity payout for ${month} has been sent`,
        react: PayoutSentEmail({
          artistName: artist.artist_name ?? "Artist",
          month,
          amountCents,
        }),
      })
    }
  }

  return NextResponse.json({
    payout,
    wasPaidBefore: !!existing?.paidAt,
    markedPaid: true,
  }
)}