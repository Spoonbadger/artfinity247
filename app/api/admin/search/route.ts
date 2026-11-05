// GET /api/admin/search?q=  Global admin search: artists, orders, artworks and printed codes.
import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { orderNumber } from "@/lib/printer";

export const dynamic = "force-dynamic";

export type AdminSearchHit = { kind: "artist" | "order" | "artwork" | "code"; id: string; title: string; sub: string; href: string };

export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") || "").trim().replace(/^[@#]/, "").slice(0, 80);
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const ci = { contains: q, mode: "insensitive" as const };

  const [artists, orders, artworks, codes] = await Promise.all([
    prisma.artist.findMany({
      where: { OR: [{ name: ci }, { artist_name: ci }, { first_name: ci }, { last_name: ci }, { slug: ci }, { email: ci }] },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, artist_name: true, slug: true, email: true, closedAt: true, suspendedAt: true },
    }),
    prisma.order.findMany({
      where: { OR: [{ id: { contains: q.toLowerCase() } }, { email: ci }, { shippingName: ci }, { stripeSessionId: { contains: q } }] },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, shippingName: true, amountTotal: true, createdAt: true, kind: true },
    }),
    prisma.artwork.findMany({
      where: { OR: [{ title: ci }, { slug: ci }] },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, artist: { select: { id: true, artist_name: true, name: true } } },
    }),
    q.length <= 12
      ? prisma.qrCode.findMany({
          where: { OR: [{ code: { contains: q.toUpperCase() } }, { label: ci }, { venue: ci }] },
          take: 5,
          select: { id: true, code: true, label: true, venue: true, artistId: true, artist: { select: { artist_name: true, name: true } }, artwork: { select: { title: true } } },
        })
      : Promise.resolve([]),
  ]);

  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
  const hits: AdminSearchHit[] = [
    ...artists.map((a) => ({
      kind: "artist" as const, id: a.id, title: a.artist_name || a.name,
      sub: `@${a.slug} · ${a.email}${a.suspendedAt ? " · suspended" : a.closedAt ? " · closed" : ""}`,
      href: `/admin/artists/${a.id}`,
    })),
    ...orders.map((o) => ({
      kind: "order" as const, id: o.id, title: `Order ${orderNumber(o.id)} · ${usd(o.amountTotal)}`,
      sub: `${o.shippingName || "No name"} · ${o.email} · ${o.createdAt.toISOString().slice(0, 10)}${o.kind !== "retail" ? ` · ${o.kind}` : ""}`,
      href: `/admin/orders/${o.id}`,
    })),
    ...artworks.map((a) => ({
      kind: "artwork" as const, id: a.id, title: a.title,
      sub: `${a.artist.artist_name || a.artist.name} · ${a.status.toLowerCase()}`,
      href: `/admin/artworks/${a.id}/edit`,
    })),
    ...codes.map((c) => ({
      kind: "code" as const, id: c.id, title: `Code ${c.code}`,
      sub: [c.artist.artist_name || c.artist.name, c.artwork?.title, c.label || c.venue].filter(Boolean).join(" · "),
      href: `/admin/artists/${c.artistId}#codes`,
    })),
  ];
  return NextResponse.json({ hits }, { headers: { "Cache-Control": "no-store" } });
}
