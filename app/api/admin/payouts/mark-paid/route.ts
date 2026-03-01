import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { jwtVerify } from "jose"
import { calcItemProfitCents, type PrintSize } from "@/lib/revenue"
import { Resend } from "resend"
import PayoutSentEmail from "@/emails/PayoutSentEmail"


const resend = new Resend(process.env.RESEND_API_KEY)

export const runtime = "nodejs"

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value
  if (!token) return null
  const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!))
  return payload.role === "ADMIN" ? payload : null
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { artistId, month, unmark } = await req.json()
  if (!artistId || !month) {
    return NextResponse.json({ error: "artistId and month required" }, { status: 400 })
  }

  // fetch existing payout FIRST so we can know "previously unpaid?"
  const existing = await prisma.payout.findUnique({
    where: { artistId_month: { artistId, month } },
    select: { paidAt: true },
  })

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
      },
    },
    select: {
      lineTotal: true,
      size: true,
    },
  })

  function normalizeSize(raw: string | null): PrintSize {
    const v = (raw || "").toUpperCase()
    if (v.startsWith("S")) return "S"
    if (v.startsWith("L")) return "L"
    return "M"
  }

  const amountCents = items.reduce((sum, item) => {
    const sizeNorm = normalizeSize(item.size)
    const b = calcItemProfitCents({
      lineTotal: item.lineTotal ?? 0,
      size: sizeNorm,
    })
    return sum + b.artistShare
  }, 0)


  if (unmark) {
    const payout = await prisma.payout.upsert({
      where: { artistId_month: { artistId, month } },
      update: { paidAt: null, amountCents },
      create: { artistId, month, amountCents, paidAt: null },
    })

    return NextResponse.json({
      payout,
      wasPaidBefore: !!existing?.paidAt,
      markedPaid: false,
    })
  }

  // MARK AS PAID
  const payout = await prisma.payout.upsert({
    where: { artistId_month: { artistId, month } },
    update: { paidAt: new Date(), amountCents },
    create: { artistId, month, amountCents, paidAt: new Date() },
  })

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