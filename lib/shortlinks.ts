// Short links and scan tracking (server only).
// GET /q/<CODE> looks the code up, records a scan without slowing the redirect, and sends the
// visitor to the artwork (or the artist's page). No personal data: coarse device and place only,
// plus a random first-party visitor id (cookie af_vid) for counting unique visitors.
import { randomBytes, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { calcItemProfitCents } from "@/lib/revenue";
import { CODE_ALPHABET, normalizeCode } from "@/lib/shortcode";

export { normalizeCode, shortUrl, shortLabel, PLACEHOLDER_CODE } from "@/lib/shortcode";

export const VISITOR_COOKIE = "af_vid";

// ---------------- codes ----------------
function randomCode(len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** A fresh unique code: 4 characters while there's room, then 5, then 6. */
export async function createCode(): Promise<string> {
  for (const len of [4, 4, 4, 4, 5, 5, 5, 6, 6, 6]) {
    const code = randomCode(len);
    const taken = await prisma.qrCode.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Could not find a free short code");
}

export type CodeInput = {
  artistId: string;
  artworkId?: string | null;
  label?: string | null;
  venue?: string | null;
  discountPct?: number | null;
  design?: unknown;
  expiresAt?: Date | null;
};

/** Create a QrCode row with a new code. Retries if two creates race for the same code. */
export async function createQrCode(input: CodeInput) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = await createCode();
    try {
      return await prisma.qrCode.create({
        data: {
          code,
          artistId: input.artistId,
          artworkId: input.artworkId ?? null,
          label: input.label ?? null,
          venue: input.venue ?? null,
          discountPct: input.discountPct ?? null,
          design: (input.design ?? undefined) as never,
          expiresAt: input.expiresAt ?? null,
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code !== "P2002") throw e; // unique clash: try another code
    }
  }
  throw new Error("Could not create a short code");
}

const resolveSelect = {
  id: true, code: true, artistId: true, artworkId: true, venue: true, discountPct: true, active: true, expiresAt: true, label: true,
  artist: { select: { slug: true } },
  artwork: { select: { id: true, slug: true, status: true } },
} as const;

/** Case-insensitive lookup. null for anything that isn't a known code. */
export async function resolveCode(raw: unknown) {
  const code = normalizeCode(raw);
  if (!code) return null;
  return prisma.qrCode.findUnique({ where: { code }, select: resolveSelect });
}

export type ResolvedCode = NonNullable<Awaited<ReturnType<typeof resolveCode>>>;

/** Active and not past its end date. */
export function isLive(c: { active: boolean; expiresAt: Date | null }, now = new Date()) {
  return c.active && (!c.expiresAt || c.expiresAt.getTime() > now.getTime());
}

// ---------------- scans ----------------
// Link-preview crawlers (iMessage, Slack, WhatsApp...) and search bots open links without a person.
// curl is not on the list on purpose: it's how we test, and it's rare in the wild.
const BOT_RE =
  /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|facebot|meta-externalagent|embedly|whatsapp|telegram|slack|discord|skype|vkshare|pinterest|quora link|outbrain|bitlybot|tumblr|redditbot|applebot|google-inspectiontool|googleother|lighthouse|headlesschrome|phantomjs|python-requests|go-http-client|okhttp|axios|node-fetch|wget|monitor|uptime|validator/i;

export function isBot(ua: string | null | undefined) {
  if (!ua || ua.length < 8) return true;
  return BOT_RE.test(ua);
}

export function deviceFrom(ua: string | null | undefined): "phone" | "tablet" | "desktop" {
  const u = ua || "";
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(u)) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(u)) return "phone";
  return "desktop";
}

function header(h: Headers, name: string) {
  const v = h.get(name);
  if (!v) return null;
  try { return decodeURIComponent(v).slice(0, 80) || null; } catch { return v.slice(0, 80) || null; }
}

/** Device and place from the request. City/region/country come from the host's geo headers when present. */
export function scanContext(h: Headers) {
  const ua = h.get("user-agent");
  return {
    ua,
    bot: isBot(ua) || h.get("purpose") === "prefetch" || /prefetch|prerender/i.test(h.get("sec-purpose") || "") || h.get("x-purpose") === "preview",
    device: deviceFrom(ua),
    city: header(h, "x-vercel-ip-city"),
    region: header(h, "x-vercel-ip-country-region"),
    country: header(h, "x-vercel-ip-country"),
  };
}

const VID_RE = /^[A-Za-z0-9_-]{16,40}$/;
export function validVisitorId(v: string | null | undefined) {
  return v && VID_RE.test(v) ? v : null;
}
export function newVisitorId() {
  return randomBytes(16).toString("base64url");
}

export type ScanInput = { qrCodeId: string; device?: string | null; city?: string | null; region?: string | null; country?: string | null; visitorId?: string | null };

export function recordScan(s: ScanInput) {
  return prisma.scanEvent.create({
    data: { qrCodeId: s.qrCodeId, device: s.device ?? null, city: s.city ?? null, region: s.region ?? null, country: s.country ?? null, visitorId: s.visitorId ?? null },
    select: { id: true },
  });
}

/**
 * Record a scan without holding up the response. On Vercel the request context's waitUntil keeps
 * the function alive until the write lands; on a plain Node server the promise just finishes.
 */
export function recordScanLater(s: ScanInput) {
  const p = recordScan(s).catch((e) => console.error("[shortlinks] scan not recorded", e));
  try {
    const ctx = (globalThis as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } | undefined>)[Symbol.for("@vercel/request-context")]?.get?.();
    ctx?.waitUntil?.(p);
  } catch { /* not on Vercel */ }
  return p;
}

// ---------------- stats (Studio) ----------------
const DAY = 86400000;

export type CodeStats = {
  scans: number;
  scans7: number;
  visitors: number;
  sales: number; // order items (lines) attributed
  prints: number;
  revenueCents: number;
  shareCents: number;
  lastScan: Date | null;
};

const emptyStats = (): CodeStats => ({ scans: 0, scans7: 0, visitors: 0, sales: 0, prints: 0, revenueCents: 0, shareCents: 0, lastScan: null });

/** Per-code totals for a set of codes, keyed by QrCode.id. */
export async function statsFor(codeIds: string[], now = new Date()): Promise<Map<string, CodeStats>> {
  const out = new Map<string, CodeStats>(codeIds.map((id) => [id, emptyStats()]));
  if (!codeIds.length) return out;
  const since7 = new Date(now.getTime() - 7 * DAY);
  const [all, recent, visitors, items] = await Promise.all([
    prisma.scanEvent.groupBy({ by: ["qrCodeId"], where: { qrCodeId: { in: codeIds } }, _count: { _all: true }, _max: { createdAt: true } }),
    prisma.scanEvent.groupBy({ by: ["qrCodeId"], where: { qrCodeId: { in: codeIds }, createdAt: { gte: since7 } }, _count: { _all: true } }),
    prisma.scanEvent.groupBy({ by: ["qrCodeId", "visitorId"], where: { qrCodeId: { in: codeIds }, visitorId: { not: null } } }),
    prisma.orderItem.findMany({
      where: { qrCodeId: { in: codeIds }, order: { paymentStatus: "paid", kind: { not: "bulk" } } },
      select: { qrCodeId: true, size: true, frameChosen: true, quantity: true, unitPrice: true, lineTotal: true, artistSplit: true, order: { select: { createdAt: true } } },
    }),
  ]);
  for (const r of all) { const s = out.get(r.qrCodeId)!; s.scans = r._count._all; s.lastScan = r._max.createdAt; }
  for (const r of recent) out.get(r.qrCodeId)!.scans7 = r._count._all;
  for (const r of visitors) out.get(r.qrCodeId)!.visitors++;
  for (const it of items) {
    const s = out.get(it.qrCodeId!);
    if (!s) continue;
    const qty = it.quantity ?? 1;
    const line = it.lineTotal ?? (it.unitPrice ?? 0) * qty;
    const size = toSize(it.size);
    s.sales++;
    s.prints += qty;
    s.revenueCents += line;
    s.shareCents += calcItemProfitCents({ lineTotal: line, size, frameChosen: it.frameChosen, quantity: qty, orderDate: it.order.createdAt, artistSplit: it.artistSplit }).artistShare;
  }
  return out;
}

function toSize(s: string | null | undefined): "S" | "M" | "L" | "XL" {
  const v = String(s || "").toLowerCase();
  if (v === "s" || v === "small") return "S";
  if (v === "l" || v === "large") return "L";
  if (v === "xl" || v === "x-large") return "XL";
  return "M";
}

/** Scans across all of an artist's codes in [from, to). */
export function countArtistScans(artistId: string, from: Date, to: Date) {
  return prisma.scanEvent.count({ where: { qrCode: { artistId }, createdAt: { gte: from, lt: to } } });
}
