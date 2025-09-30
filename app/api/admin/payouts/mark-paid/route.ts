import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma";


export async function POST(req: NextRequest) {
  try {
    const { artistId, month } = await req.json()
    if (!artistId || !month) {
      return NextResponse.json({ error: "artistId and month required" }, { status: 400 })
    }

    const payout = await prisma.payout.upsert({
      where: { artistId_month: { artistId, month } },
      update: { paidAt: new Date() },
      create: {
        artistId,
        month,
        amountCents: 0,
        paidAt: new Date(),
      },
    })
    

    return NextResponse.json(payout)
  } catch (err) {
    console.error("❌ mark-paid error", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
