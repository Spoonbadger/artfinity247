// GET /api/studio/pro: the signed-in artist's plan. { plan, proUntil, active, split, priceCents, billing, status }
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { FREE_SPLIT, PRO, isProActive } from "@/lib/plans";
import { testCheckoutAllowed } from "@/lib/testCheckout";
import { billingMode, getBillingState } from "@/lib/billing";
import { billingView } from "@/lib/billingStatus";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const a = await prisma.artist.findUnique({ where: { id: user.id }, select: { plan: true, proUntil: true } });
  if (!a) return NextResponse.json({ error: "Artist not found." }, { status: 404 });
  const active = isProActive(a);
  return NextResponse.json({
    plan: a.plan,
    proUntil: a.proUntil,
    active,
    split: active ? PRO.split : FREE_SPLIT,
    priceCents: PRO.priceCents,
    billing: billingMode(), // "live" | "simulated" | "off" (lib/billing.ts)
    status: billingView(await getBillingState(user.id), a.proUntil).kind,
    devTrial: testCheckoutAllowed(),
  });
}
