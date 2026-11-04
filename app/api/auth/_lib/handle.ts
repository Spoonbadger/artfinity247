import { prisma } from "@/lib/prisma";

export const HANDLE_RE = /^[a-z0-9_.]{3,30}$/;

// Words that clash with site routes or would confuse buyers.
const RESERVED = new Set([
  "admin", "api", "app", "art", "artist", "artists", "artfinity", "theartfinity", "about", "about-us",
  "account", "auth", "cart", "checkout", "contact", "dashboard", "help", "home", "info", "login", "logout",
  "me", "new", "orders", "payouts", "privacy", "qr", "register", "root", "scan", "scenes", "search",
  "settings", "shop", "signup", "sign-up", "staff", "store", "studio", "support", "terms", "upload", "uploads", "www",
  // kept in step with /api/handles/check
  "assets", "billing", "blog", "null", "q", "seed", "static", "team", "undefined",
]);

export type HandleCheck = { available: boolean; reason?: "invalid" | "reserved" | "taken"; suggestions?: string[] };

export function normalizeHandle(raw: string) {
  return (raw || "").trim().replace(/^@/, "").toLowerCase();
}

export async function checkHandle(raw: string): Promise<HandleCheck> {
  const h = normalizeHandle(raw);
  if (!HANDLE_RE.test(h) || /^[._]|[._]$/.test(h)) return { available: false, reason: "invalid" };
  if (RESERVED.has(h)) return { available: false, reason: "reserved", suggestions: await suggest(h) };
  const hit = await prisma.artist.findFirst({ where: { slug: { equals: h, mode: "insensitive" } }, select: { id: true } });
  if (hit) return { available: false, reason: "taken", suggestions: await suggest(h) };
  return { available: true };
}

async function suggest(h: string) {
  const base = h.slice(0, 24);
  const options = [`${base}.art`, `${base}studio`, `${base}.paints`, `${base}${new Date().getFullYear() % 100}`];
  const taken = await prisma.artist.findMany({ where: { slug: { in: options } }, select: { slug: true } });
  const used = new Set(taken.map((t) => t.slug));
  return options.filter((o) => !used.has(o) && !RESERVED.has(o)).slice(0, 2);
}
