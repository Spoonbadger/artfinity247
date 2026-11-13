// GET    /api/collector/wishlist                 → { signedIn, ids }  (hearts on cards and painting pages)
// POST   /api/collector/wishlist { artworkId }   → saves it      (signed-in collectors; others get the email sheet)
// DELETE /api/collector/wishlist { artworkId }   → removes it
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCollector, saveToWishlist } from "@/lib/collector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const idFrom = async (req: Request) => {
  const b = (await req.json().catch(() => ({}))) as { artworkId?: unknown };
  return typeof b.artworkId === "string" && b.artworkId.length <= 40 ? b.artworkId : null;
};

export async function GET() {
  const c = await getCollector();
  if (!c) return NextResponse.json({ signedIn: false, ids: [] }, { headers: { "Cache-Control": "no-store" } });
  const rows = await prisma.wishlistItem.findMany({ where: { collectorId: c.id }, select: { artworkId: true } });
  return NextResponse.json({ signedIn: true, ids: rows.map((r) => r.artworkId) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const c = await getCollector();
  if (!c) return NextResponse.json({ error: "Sign in to save pieces." }, { status: 401 });
  const id = await idFrom(req);
  if (!id) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (!(await saveToWishlist(c.id, id))) return NextResponse.json({ error: "That piece isn't available." }, { status: 404 });
  return NextResponse.json({ ok: true, saved: true });
}

export async function DELETE(req: Request) {
  const c = await getCollector();
  if (!c) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const id = await idFrom(req);
  if (!id) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  await prisma.wishlistItem.deleteMany({ where: { collectorId: c.id, artworkId: id } });
  return NextResponse.json({ ok: true, saved: false });
}
