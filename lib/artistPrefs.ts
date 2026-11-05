// Small per-artist settings without a schema field. Server only.
//
// One Message row per artist and key: direction "pref", email "pref:<key>" (not an address, so the customer CRM never
// lists it, same trick as lib/referrals.ts and lib/reprintFormat.ts), body = JSON.
//   digest            { off?: boolean, lastWeek?: "YYYY-MM-DD" }   weekly digest opt-out + the week last sent (lib/digest.ts)
//   auto-newsletter   { on?: boolean }                              draft a newsletter after a batch upload (lib/newsletterAuto.ts)
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const PREF_DIRECTION = "pref";
export type PrefKey = "digest" | "auto-newsletter";
const emailFor = (key: PrefKey) => `pref:${key}`;

type Json = Record<string, unknown>;

const parse = (body: string | null | undefined): Json => {
  try {
    const v = JSON.parse(body || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

export async function getPref<T extends Json>(artistId: string, key: PrefKey): Promise<Partial<T>> {
  const row = await prisma.message.findFirst({ where: { artistId, direction: PREF_DIRECTION, email: emailFor(key) }, orderBy: { createdAt: "desc" }, select: { body: true } });
  return parse(row?.body) as Partial<T>;
}

/** Many artists at once: artistId -> value. */
export async function getPrefs<T extends Json>(artistIds: string[], key: PrefKey): Promise<Map<string, Partial<T>>> {
  const rows = artistIds.length
    ? await prisma.message.findMany({ where: { artistId: { in: artistIds }, direction: PREF_DIRECTION, email: emailFor(key) }, orderBy: { createdAt: "asc" }, select: { artistId: true, body: true } })
    : [];
  return new Map(rows.map((r) => [r.artistId, parse(r.body) as Partial<T>]));
}

/** Merges `patch` into the stored value. */
export async function setPref<T extends Json>(artistId: string, key: PrefKey, patch: Partial<T>): Promise<Partial<T>> {
  const row = await prisma.message.findFirst({ where: { artistId, direction: PREF_DIRECTION, email: emailFor(key) }, orderBy: { createdAt: "desc" }, select: { id: true, body: true } });
  const next = { ...parse(row?.body), ...patch } as Partial<T>;
  if (row) await prisma.message.update({ where: { id: row.id }, data: { body: JSON.stringify(next) } });
  else await prisma.message.create({ data: { artistId, email: emailFor(key), direction: PREF_DIRECTION, subject: `Setting: ${key}`, body: JSON.stringify(next) } });
  return next;
}

// ---------- Signed one-click links (opt-outs in emails) ----------

const SECRET = process.env.SCAN_SIGNING_SECRET || process.env.JWT_SECRET || "";

export const signPrefLink = (artistId: string, key: PrefKey) => crypto.createHmac("sha256", SECRET).update(`pref:${key}:${artistId}`).digest("base64url").slice(0, 22);

export function verifyPrefLink(artistId: string, key: PrefKey, sig: unknown): boolean {
  if (!SECRET || !artistId || typeof sig !== "string" || sig.length !== 22) return false;
  const want = Buffer.from(signPrefLink(artistId, key));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
