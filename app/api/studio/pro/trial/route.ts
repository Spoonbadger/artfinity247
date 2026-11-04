// POST /api/studio/pro/trial: start a 14-day Pro trial. DEV ONLY (same rule as test checkout,
// lib/testCheckout.ts) until Stripe Billing exists. DELETE ends Pro now (dev only, for testing).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { PRO, addDays, isProActive } from "@/lib/plans";
import { testCheckoutAllowed } from "@/lib/testCheckout";

export const dynamic = "force-dynamic";

const soon = () => NextResponse.json({ error: "Billing is coming soon." }, { status: 403 });

export async function POST() {
  if (!testCheckoutAllowed()) return soon();
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const a = await prisma.artist.findUnique({ where: { id: user.id }, select: { proUntil: true } });
  if (!a) return NextResponse.json({ error: "Artist not found." }, { status: 404 });
  if (isProActive(a)) return NextResponse.json({ error: "You're already on Pro.", proUntil: a.proUntil }, { status: 409 });
  const proUntil = addDays(new Date(), PRO.trialDays);
  await prisma.artist.update({ where: { id: user.id }, data: { plan: "PRO", proUntil } });
  console.info("PRO_TRIAL_STARTED (dev)", JSON.stringify({ artistId: user.id, proUntil: proUntil.toISOString() }));
  return NextResponse.json({ plan: "PRO", proUntil, active: true });
}

export async function DELETE() {
  if (!testCheckoutAllowed()) return soon();
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  await prisma.artist.update({ where: { id: user.id }, data: { plan: "FREE", proUntil: null } });
  return NextResponse.json({ plan: "FREE", proUntil: null, active: false });
}
