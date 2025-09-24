import { PrismaClient } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from 'jose'

const prisma = new PrismaClient()

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m || m < 1 || m > 12) throw new Error("Invalid month format. Use YYYY-MM")
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1))
  return { start, end }
}

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
  return payload.role === "ADMIN" ? payload : null;
}

export async function GET(req: NextRequest) {
    const admin = await requireAdmin(req)
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get("month")

    let dateFilter = {}
    if (month) {
      const { start, end } = monthRange(month)
      dateFilter = { gte: start, lt: end }
    }

    const orders = await prisma.order.findMany({
      where: {
        createdAt: dateFilter,
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          select: {
            id: true,
            slug: true,
            size: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            printCost: true,
            shippingCost: true,
            laborCost: true,
            websiteCost: true,
            artwork: { select: { artistId: true } },
          },
        },
      },
    })

    // add profit + shares
    const withShares = orders.map(order => ({
      ...order,
      items: order.items.map(item => {
        const expenses =
          (item.printCost ?? 0) +
          (item.shippingCost ?? 0) +
          (item.laborCost ?? 0) +
          (item.websiteCost ?? 0)
        const profit = (item.lineTotal ?? 0) - expenses
        const artistShare = Math.floor(profit / 2)
        const companyShare = profit - artistShare
        return { ...item, profit, artistShare, companyShare }
      }),
    }))

    return NextResponse.json(withShares)
  } catch (err) {
    console.error("admin orders error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
