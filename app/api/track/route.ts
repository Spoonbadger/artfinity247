// POST /api/track: one page view from components/analytics/ViewBeacon (artist, painting, collection and links pages).
// Always answers 204 so the beacon never retries or shows errors. Skips bots, Do Not Track / GPC, admins and the
// artist on their own pages, and counts a visitor once per page per 30 minutes.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { SITE_URL } from "@/lib/urls";
import { newVisitorId, scanContext, validVisitorId, VISITOR_COOKIE } from "@/lib/shortlinks";
import { classify, VIEW_WINDOW_MS, viewDevice } from "@/lib/pageviews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const done = (why: string) => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store", "X-Track": why } });

const bare = (h: string) => h.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "");
const hostOf = (u: string) => { try { return bare(new URL(u).host); } catch { return ""; } };

export async function POST(req: NextRequest) {
  const h = req.headers;
  if (h.get("dnt") === "1" || h.get("sec-gpc") === "1") return done("dnt");
  const ctx = scanContext(h);
  if (ctx.bot) return done("bot");

  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`track-ip:${ip}`, 120, 60_000)) return done("busy");

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 4000) return done("big");
    body = JSON.parse(text);
  } catch {
    return done("bad");
  }
  const artistId = typeof body.artistId === "string" && ID_RE.test(body.artistId) ? body.artistId : null;
  const artworkId = typeof body.artworkId === "string" && ID_RE.test(body.artworkId) ? body.artworkId : null;
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.split(/[?#]/)[0].slice(0, 300) : null;
  if (!artistId || !path) return done("bad");

  const me = await getUserFromCookie();
  if (me?.role === "ADMIN" || me?.id === artistId) return done("self");

  const [artist, artwork] = await Promise.all([
    prisma.artist.findUnique({ where: { id: artistId }, select: { closedAt: true } }),
    artworkId ? prisma.artwork.findFirst({ where: { id: artworkId, artistId }, select: { id: true } }) : null,
  ]);
  if (!artist || artist.closedAt || (artworkId && !artwork)) return done("bad");

  const res = done("ok");
  let vid = validVisitorId(req.cookies.get(VISITOR_COOKIE)?.value);
  if (vid) {
    const seen = await prisma.pageView.findFirst({
      where: { artistId, visitorId: vid, path, createdAt: { gte: new Date(Date.now() - VIEW_WINDOW_MS) } },
      select: { id: true },
    });
    if (seen) return done("seen");
  } else {
    vid = newVisitorId();
    // Same cookie as lib/shortlinks.ts: first-party, random, only used to count unique visitors.
    res.cookies.set(VISITOR_COOKIE, vid, { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }

  const own = [hostOf(SITE_URL), bare(h.get("host") || "")].filter(Boolean);
  const { source, referrer } = classify({ ref: body.ref, utm: body.utm, src: body.src, c: body.c, qr: body.qr }, own);

  try {
    await prisma.pageView.create({ data: { path, artistId, artworkId, source, referrer, visitorId: vid, device: viewDevice(ctx.ua) } });
  } catch (e) {
    console.error("[track] view not recorded", e);
  }
  return res;
}
