import { NextRequest, NextResponse } from "next/server";
import slugify from "slugify";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paths and words that can't be an artist handle (they collide with routes or look official).
const RESERVED = new Set([
  "about", "about-us", "account", "admin", "api", "art", "artfinity", "artist", "artists", "artist-terms-and-agreement",
  "assets", "auth", "billing", "blog", "cart", "checkout", "contact", "cookie-policy", "dashboard", "help", "home",
  "login", "logout", "me", "new", "null", "orders", "privacy-policy", "q", "qr", "recover-password", "register",
  "reset-password", "return-policy", "root", "scan", "scenes", "search", "seed", "sell-with-us", "settings", "shop",
  "signup", "static", "studio", "support", "team", "terms-and-conditions", "undefined", "uploads", "www",
]);

const VALID = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

// Light per-IP limit; the claim box checks as you type (debounced).
const hits = new Map<string, { n: number; t: number }>();
function allowed(ip: string) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.t > 60_000) { hits.set(ip, { n: 1, t: now }); return true; }
  e.n++;
  return e.n <= 90;
}

function normalizeHandle(raw: string) {
  return slugify(raw.replace(/^@/, ""), { lower: true, strict: true }).slice(0, 30).replace(/-+$/, "");
}

async function isFree(h: string) {
  if (!VALID.test(h) || RESERVED.has(h)) return false;
  const hit = await prisma.artist.findUnique({ where: { slug: h }, select: { id: true } });
  return !hit;
}

async function suggest(h: string) {
  const base = h.slice(0, 24).replace(/-+$/, "") || "artist";
  for (const c of [`${base}art`, `${base}-studio`, `${base}paints`, `${base}-prints`]) if (await isFree(c)) return c;
  for (let i = 2; i < 50; i++) if (await isFree(`${base}${i}`)) return `${base}${i}`;
  return null;
}

/** GET /api/handles/check?h=name → { handle, available, suggestion, reason } */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowed(ip)) return NextResponse.json({ error: "Too many checks. Try again in a minute." }, { status: 429 });

  const raw = req.nextUrl.searchParams.get("h") || "";
  const handle = normalizeHandle(raw);

  if (handle.length < 3) {
    return NextResponse.json({ handle, available: false, suggestion: null, reason: "short" });
  }
  if (!VALID.test(handle)) {
    return NextResponse.json({ handle, available: false, suggestion: null, reason: "invalid" });
  }
  try {
    if (await isFree(handle)) return NextResponse.json({ handle, available: true, suggestion: null, reason: null });
    return NextResponse.json({ handle, available: false, suggestion: await suggest(handle), reason: RESERVED.has(handle) ? "reserved" : "taken" });
  } catch (err) {
    console.error("handle check failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
