// GET /api/links/:id/click : counts a click on an artist's link, then 302s to it.
// Every outbound link on /@handle/links and the artist page's social icons goes through here.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/components/links/model";

export const dynamic = "force-dynamic";

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|embedly|whatsapp|telegram|discord|curl|wget/i;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = String(params.id || "");
  const home = new URL("/", req.url);
  if (!/^[\w-]{6,40}$/.test(id)) return NextResponse.redirect(home, 302);

  const link = await prisma.artistLink.findUnique({ where: { id }, select: { url: true, active: true, artist: { select: { slug: true } } } });
  if (!link || !link.active) {
    return NextResponse.redirect(link ? new URL(`/@${link.artist.slug}/links`, req.url) : home, 302);
  }

  // Stored URLs are validated on save; check again so this can never become an open redirect to javascript: etc.
  const safe = normalizeUrl(link.url);
  if ("error" in safe) return NextResponse.redirect(new URL(`/@${link.artist.slug}/links`, req.url), 302);

  const ua = req.headers.get("user-agent") || "";
  const prefetch = req.headers.get("purpose") === "prefetch" || req.headers.get("sec-purpose")?.includes("prefetch");
  if (!BOT.test(ua) && !prefetch) {
    await prisma.artistLink.update({ where: { id }, data: { clicks: { increment: 1 } } }).catch(() => null);
  }

  const res = NextResponse.redirect(safe.url, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}
