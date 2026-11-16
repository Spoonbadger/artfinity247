// GET /api/studio/search?q=  The Studio header search: the signed-in artist's own art and collections.
// (Studio pages are matched in the browser; see components/studio/StudioSearch.tsx.)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";

export type StudioSearchHit = { kind: "art" | "collection"; id: string; title: string; sub: string; href: string };

const STATUS: Record<string, string> = { PENDING: "In review", APPROVED: "Live", REJECTED: "Not approved" };

export async function GET(req: NextRequest) {
  const { user, denied } = await activeUserGuard("Log in to search your Studio.");
  if (denied) return denied;
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const ci = { contains: q, mode: "insensitive" as const };

  const [art, collections] = await Promise.all([
    prisma.artwork.findMany({
      where: { artistId: user.id, OR: [{ title: ci }, { slug: ci }] },
      take: 8,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, slug: true, status: true },
    }),
    prisma.collection.findMany({
      where: { artistId: user.id, OR: [{ title: ci }, { slug: ci }] },
      take: 4,
      orderBy: { position: "asc" },
      select: { id: true, title: true, _count: { select: { items: true } } },
    }),
  ]);

  const hits: StudioSearchHit[] = [
    ...art
      .filter((a) => a.slug)
      .map((a) => ({ kind: "art" as const, id: a.id, title: a.title, sub: STATUS[a.status] || "", href: `/studio/art/${a.slug}` })),
    ...collections.map((c) => ({
      kind: "collection" as const, id: c.id, title: c.title,
      sub: `${c._count.items} ${c._count.items === 1 ? "piece" : "pieces"}`,
      href: "/studio/collections",
    })),
  ];
  return NextResponse.json({ hits }, { headers: { "Cache-Control": "no-store" } });
}
