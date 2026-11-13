// DELETE /api/collector/account → deletes the Collector and its wishlist (cascade) and signs out.
// Orders stay: they're needed for accounting, and they still belong to the email, not to the collection.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COLLECTOR_COOKIE, getCollector, sessionCookieOptions } from "@/lib/collector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE() {
  const c = await getCollector();
  if (!c) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await prisma.collector.delete({ where: { id: c.id } });
  console.log(`[collector] deleted collection ${c.id}`);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COLLECTOR_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
