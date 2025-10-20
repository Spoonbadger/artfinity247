// /app/api/admin/orders/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { calcItemProfitCents, type PrintSize } from "@/lib/revenue";

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error("Invalid month format. Use YYYY-MM");
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1));
  return { start, end };
}

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!));
  return payload.role === "ADMIN" ? payload : null;
}

// Normalize your stored item.size into "S" | "M" | "L"
function normalizeSize(raw: string | null): PrintSize {
  const v = (raw || "").toUpperCase();
  if (v.startsWith("S")) return "S";
  if (v.startsWith("L")) return "L";
  return "M"; // default
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
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
          include: {
            artwork: { select: { artistId: true } },
          },
        },
      },
    });

    const shaped = orders.map((order) => {
      const items = order.items.map((item) => {
        const qty = item.quantity ?? 0;
        const unit = item.unitPrice ?? 0;
        const lineTotal = item.lineTotal ?? qty * unit;

        const size = normalizeSize(item.size as string | null);

        // >>> authoritative breakdown from /lib/revenue.ts <<<
        const b = calcItemProfitCents({ lineTotal, size });

        return {
          id: item.id,
          slug: item.slug,
          size,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal,
          // override any stored costs with computed values
          printCost: b.printCost,
          shippingCost: b.shippingCost,
          laborCost: b.laborCost,
          websiteCost: b.websiteCost,
          profit: b.profit,
          artistShare: b.artistShare,
          companyShare: b.companyShare,
          artwork: { artistId: item.artwork?.artistId ?? "unknown"},
        };
      });

      return {
        id: order.id,
        stripeSessionId: order.stripeSessionId,
        email: order.email,
        amountTotal: order.amountTotal,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        shippingStatus: order.shippingStatus,
        items,
      };
    });

    return NextResponse.json(shaped);
  } catch (err) {
    console.error("admin orders error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}