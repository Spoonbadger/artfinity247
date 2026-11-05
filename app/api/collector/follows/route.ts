// POST /api/collector/follows { id, action: "unfollow" | "resubscribe" } → { ok, following }
// Only Follower rows for the collector's own (verified) email. Resubscribing confirms: they proved the address by signing in.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCollector } from "@/lib/collector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const c = await getCollector();
  if (!c) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  if (typeof b.id !== "string" || (b.action !== "unfollow" && b.action !== "resubscribe")) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const f = await prisma.follower.findFirst({ where: { id: b.id, email: { equals: c.email, mode: "insensitive" } }, select: { id: true, confirmedAt: true } });
  if (!f) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const now = new Date();
  await prisma.follower.update({
    where: { id: f.id },
    data: b.action === "unfollow" ? { unsubscribedAt: now } : { unsubscribedAt: null, confirmedAt: f.confirmedAt ?? now },
  });
  return NextResponse.json({ ok: true, following: b.action === "resubscribe" });
}
