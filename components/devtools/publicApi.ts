// Public read API v1: shared response helpers and serializers.
// Only public data leaves here: no emails, phones, payout details, costs or link click counts.
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { rateLimit } from "@/lib/rateLimit";
import { basePrices, framePrices, getFinalPrice } from "@/lib/artwork_price";
import { MEDALS } from "@/lib/medals";
import type { Trust } from "@/lib/artistTrust";
import { artistUrl, artUrl, linksUrl } from "@/lib/urls";

export const API_VERSION = "v1";
/** Requests per minute, per IP. Generous in dev because every local request shares one IP. */
export const PROD_RATE_LIMIT = 60;
export const PUBLIC_RATE_LIMIT = process.env.NODE_ENV === "production" ? PROD_RATE_LIMIT : 1000;
export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 12;

type Size = keyof typeof basePrices;
const SIZES: Size[] = ["small", "medium", "large", "xl"];
const SIZE_LABEL: Record<Size, string> = { small: "Small", medium: "Medium", large: "Large", xl: "XL" };
const SIZE_IN: Record<Size, [number, number]> = { small: [5, 7], medium: [8, 12], large: [11, 17], xl: [18, 24] };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const CACHE = "public, s-maxage=60, stale-while-revalidate=300";

export function siteBase(req?: NextRequest) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  return req ? new URL(req.url).origin : "https://theartfinity.com";
}

export function absUrl(base: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return base + (path.startsWith("/") ? path : "/" + path);
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(data, {
    status,
    headers: { ...CORS, "Cache-Control": status === 200 ? CACHE : "no-store", "X-Artfinity-Api": API_VERSION, ...extra },
  });
}

export type ErrorCode = "not_found" | "bad_request" | "rate_limited" | "method_not_allowed" | "server_error";

export function apiError(code: ErrorCode, message: string, status: number, extra: Record<string, string> = {}) {
  return json({ error: { code, message } }, status, extra);
}

export const notFound = (what: string) => apiError("not_found", `${what} not found.`, 404);

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function methodNotAllowed() {
  return apiError("method_not_allowed", "This API is read-only. Use GET.", 405, { Allow: "GET, OPTIONS" });
}

function clientIp(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") || req.ip || "unknown").trim();
}

/** Wraps a GET handler with the rate limit and a JSON 500 fallback. */
export function handler<C>(fn: (req: NextRequest, ctx: C) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: C) => {
    if (!rateLimit(`public-api:${clientIp(req)}`, PUBLIC_RATE_LIMIT)) {
      return apiError("rate_limited", `Too many requests. The limit is ${PUBLIC_RATE_LIMIT} a minute.`, 429, {
        "Retry-After": "60",
        "X-RateLimit-Limit": String(PUBLIC_RATE_LIMIT),
      });
    }
    try {
      const res = await fn(req, ctx);
      res.headers.set("X-RateLimit-Limit", String(PUBLIC_RATE_LIMIT));
      return res;
    } catch (e) {
      console.error("[public-api]", e);
      return apiError("server_error", "Something went wrong on our side.", 500);
    }
  };
}

/** Handles look like `mayaokafor`; a leading @ is fine. */
export function cleanHandle(raw: string) {
  const h = decodeURIComponent(raw || "").replace(/^@/, "").trim();
  return /^[\w.-]{1,64}$/.test(h) ? h : null;
}

export function cleanSlug(raw: string) {
  const s = decodeURIComponent(raw || "").trim();
  return /^[\w.-]{1,160}$/.test(s) ? s : null;
}

export const money = (cents: number) => ({ cents, display: "$" + (cents / 100).toFixed(2), currency: "USD" });

type Markups = { markupSmall: number | null; markupMedium: number | null; markupLarge: number | null; markupXl: number | null };

function markup(a: Markups, s: Size) {
  const m = s === "small" ? a.markupSmall : s === "medium" ? a.markupMedium : s === "large" ? a.markupLarge : a.markupXl;
  return Number(m ?? 0) || 0;
}

export function fromPrice(a: Markups) {
  return Math.min(...SIZES.map((s) => getFinalPrice(s, markup(a, s))));
}

export function sizesFor(a: Markups) {
  return SIZES.map((s) => ({
    size: s,
    label: SIZE_LABEL[s],
    inches: `${SIZE_IN[s][0]} × ${SIZE_IN[s][1]}`,
    price: money(getFinalPrice(s, markup(a, s))),
    framedPrice: framePrices[s] !== undefined ? money(getFinalPrice(s, markup(a, s), true)) : null,
  }));
}

export const PUBLIC_ARTWORK: Prisma.ArtworkWhereInput = { status: "APPROVED", slug: { not: null }, artist: { closedAt: null, suspendedAt: null } };

export const artworkSelect = {
  id: true, slug: true, title: true, imageUrl: true, sensitive: true, editionSize: true, createdAt: true,
  markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true,
  artist: { select: { slug: true, name: true, artist_name: true } },
} satisfies Prisma.ArtworkSelect;

export type ArtworkRow = Prisma.ArtworkGetPayload<{ select: typeof artworkSelect }>;

export function displayName(a: { artist_name?: string | null; name?: string | null }) {
  return a.artist_name || a.name || "Artist";
}

export function edition(size: number | null, sold: number) {
  if (!size) return null;
  const s = Math.min(sold, size);
  return { size, sold: s, remaining: Math.max(0, size - s), soldOut: s >= size };
}

export function serializeArtwork(base: string, a: ArtworkRow, editionSold = 0) {
  return {
    slug: a.slug!,
    title: a.title,
    url: artUrl(a.artist.slug, a.slug!, base),
    image: { url: absUrl(base, a.imageUrl), alt: a.title },
    sensitive: a.sensitive,
    fromPrice: money(fromPrice(a)),
    edition: edition(a.editionSize, editionSold),
    artist: { handle: a.artist.slug, name: displayName(a.artist), url: artistUrl(a.artist.slug, base) },
    createdAt: a.createdAt.toISOString(),
  };
}

/** Paid, non-bulk print counts for limited-edition works, keyed by artwork id. */
export async function editionSales(prisma: typeof import("@/lib/prisma").prisma, rows: { id: string; editionSize: number | null }[]) {
  const ids = rows.filter((r) => r.editionSize).map((r) => r.id);
  const map = new Map<string, number>();
  if (!ids.length) return map;
  const sums = await prisma.orderItem.groupBy({
    by: ["artworkId"],
    where: { artworkId: { in: ids }, order: { paymentStatus: "paid", kind: { not: "bulk" } } },
    _sum: { quantity: true },
    _count: { _all: true },
  });
  for (const s of sums) if (s.artworkId) map.set(s.artworkId, s._sum.quantity ?? s._count._all);
  return map;
}

export function serializeMedal(trust: Trust) {
  const m = trust.medal ? MEDALS.find((x) => x.tier === trust.medal) : null;
  return m ? { tier: m.tier, label: m.label, color: m.color } : null;
}

export function parseLimit(raw: string | null) {
  if (raw == null || raw === "") return DEFAULT_LIMIT;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, MAX_LIMIT);
}

export const artistSelect = {
  id: true, slug: true, name: true, artist_name: true, bio: true, profileImage: true, city: true, state: true, country: true, createdAt: true,
  links: { where: { active: true }, orderBy: { position: "asc" }, select: { kind: true, label: true, url: true } },
  _count: { select: { artworks: { where: PUBLIC_ARTWORK } } },
} satisfies Prisma.ArtistSelect;

export type ArtistRow = Prisma.ArtistGetPayload<{ select: typeof artistSelect }>;

export function serializeArtist(base: string, a: ArtistRow, trust: Trust) {
  const api = `${base}/api/public/v1/artists/${a.slug}`;
  return {
    handle: a.slug,
    name: displayName(a),
    bio: a.bio || "",
    avatar: a.profileImage ? absUrl(base, a.profileImage) : null,
    location: { city: a.city || null, region: a.state || null, country: a.country || null },
    verified: trust.verified,
    medal: serializeMedal(trust),
    printsSold: trust.showStats ? trust.printsSold : null,
    artworkCount: a._count.artworks,
    memberSince: a.createdAt.toISOString(),
    url: artistUrl(a.slug, base),
    linksUrl: linksUrl(a.slug, base),
    links: a.links.filter((l) => /^(https?:|mailto:)/i.test(l.url)).map((l) => ({ kind: l.kind, label: l.label || null, url: l.url })),
    api: { artworks: `${api}/artworks`, collections: `${api}/collections` },
  };
}
