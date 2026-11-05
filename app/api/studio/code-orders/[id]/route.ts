// POST /api/studio/code-orders/:id { action: "retry" } → a fresh checkout for an order that wasn't paid (→ { url })
// POST /api/studio/code-orders/:id { action: "cancel" } → give up on an unpaid order (its codes stay in the queue)
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkoutUnavailable, testCheckoutAllowed } from "@/lib/testCheckout";
import { checkoutSession, markCodeOrderPaid } from "@/lib/codePrints";
import { baseUrl } from "../../../qr/art";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const err = (error: string, code: string, status: number) => NextResponse.json({ error, code }, { status });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromCookie();
  if (!user?.id) return err("Log in to keep going.", "not_logged_in", 401);
  const order = await prisma.codePrintOrder.findFirst({ where: { id: params.id, artistId: user.id } });
  if (!order) return err("We couldn't find that order.", "code_order_not_found", 404);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown };

  if (body.action === "cancel") {
    if (order.status !== "pending") return err("Only an unpaid order can be canceled here. Message us about a paid one.", "bad_request", 409);
    await prisma.codePrintOrder.update({ where: { id: order.id }, data: { status: "canceled", canceledAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "retry") {
    if (!["pending", "canceled"].includes(order.status)) return err("That order is already paid.", "bad_request", 409);
    try {
      await prisma.codePrintOrder.update({ where: { id: order.id }, data: { status: "pending", canceledAt: null } });
      if (!process.env.STRIPE_SECRET_KEY) {
        if (!testCheckoutAllowed()) return checkoutUnavailable("code-prints");
        await markCodeOrderPaid(order.id);
        return NextResponse.json({ url: `/studio/qr/queue?paid=${order.id}`, dev: true });
      }
      return NextResponse.json({ url: await checkoutSession(order, baseUrl(req)) });
    } catch (e) {
      console.error("[code-prints] retry failed", e);
      return err("Checkout didn't open. Nothing was charged. Try again.", "server_error", 500);
    }
  }
  return err("Something was missing from that request. Refresh and try again.", "bad_request", 400);
}
