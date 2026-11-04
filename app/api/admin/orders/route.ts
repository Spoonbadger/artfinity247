// /app/api/admin/orders/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin"
import { calcItemProfitCents, type PrintSize } from "@/lib/revenue"

export const dynamic = "force-dynamic"

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error("Invalid month format. Use YYYY-MM");
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1));
  return { start, end };
}


// Normalize stored item.size into "S" | "M" | "L" | "XL"
function normalizeSize(raw: string | null): PrintSize {
  const v = (raw || "").toUpperCase();
  if (v.startsWith("S")) return "S";
  if (v.startsWith("XL")) return "XL"
  if (v.startsWith("L")) return "L";
  return "M"; // default
}

export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // may be "YYYY-MM" or "all"/null

    let createdAt: Record<string, Date> | undefined;
    if (month && month !== "all") {
      const { start, end } = monthRange(month);
      createdAt = { gte: start, lt: end };
    }

    const orders = await prisma.order.findMany({
      where: createdAt ? { createdAt } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          select: {
            id: true,
            slug: true,
            size: true,
            frameChosen: true,
            frameColor: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            imageUrl: true,
            artistSplit: true,
            artwork: { select: { artistId: true } },
          },
        },
      },
    })

    const shaped = orders.map((order: any) => {
      const items = order.items.map((item: any) => {
        const qty = item.quantity ?? 0;
        const unit = item.unitPrice ?? 0;
        const lineTotal = item.lineTotal ?? qty * unit;

        const size = normalizeSize(item.size as string | null);

        // >>> authoritative breakdown from /lib/revenue.ts <<<
        const b = calcItemProfitCents({
          lineTotal,
          size,
          frameChosen: item.frameChosen,
          quantity: qty || 1,
          orderDate: order.createdAt,
          artistSplit: item.artistSplit,
        })

        return {
          id: item.id,
          slug: item.slug,
          size,
          frameChosen: item.frameChosen,
          frameColor: item.frameColor,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal,
          printCost: b.printCost,
          shippingCost: b.shippingCost,
          laborCost: b.laborCost,
          websiteCost: b.websiteCost,
          profit: b.profit,
          artistShare: b.artistShare,
          companyShare: b.companyShare,
          imageUrl: item.imageUrl,
          artwork: { artistId: item.artwork?.artistId ?? "unknown"},
        }
      })

      return {
        id: order.id,
        stripeSessionId: order.stripeSessionId,
        email: order.email,
        amountTotal: order.amountTotal,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        shippingStatus: order.shippingStatus,
        sentToPrinter: order.sentToPrinter,
        shippingName: order.shippingName,
        shippingAddress: order.shippingAddress,
        items,
      }
    })

    return NextResponse.json(shaped);
  } catch (err) {
    console.error("admin orders error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}