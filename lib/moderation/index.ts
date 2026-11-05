// Automatic image check on upload (server-only). Called by POST /api/artworks/upload once the image is stored:
// the 1600px public preview (lib/storage.ts) goes to the provider set by IMAGE_MODERATION_PROVIDER
// (./providers.ts), and ./policy.ts turns the scores into "clean", "labeled" or "review".
//
// Never blocks an artist: no provider, a timeout or an error all mean the upload goes on exactly as before, and a
// failure raises one admin alert a day per provider ("image_check_failed"), resolved by the next good check.
// The result is kept as an AdminAction row ("artwork.auto_check", admin "system") keyed to the artwork, so the
// moderation card can show the scores without a schema change. See MODERATION_SETUP.md.
import fs from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { raiseAlert, resolveAlerts } from "@/lib/alerts";
import { activeProvider, configuredProvider, runProvider, timeoutMs } from "./providers";
import { decide, scoresOf } from "./policy";
import type { AutoCheckRecord, Decision, ModerationResult, ProviderId } from "./types";

export type { AutoCheckRecord, Decision, ModerationResult, ProviderId } from "./types";

export const AUTO_CHECK_ACTION = "artwork.auto_check";
const SYSTEM_ADMIN = { id: "system", email: "auto-check" };
const RAW_LIMIT = 8000;
export const imageCheckFailedKey = (provider: string, day = new Date().toISOString().slice(0, 10)) => `image_check_failed:${provider}:${day}`;

/** Bytes of the public preview behind an artwork's imageUrl (never the private original). Null if unreadable. */
export async function readPreview(imageUrl: string, signal?: AbortSignal): Promise<Buffer | null> {
  const clean = imageUrl.split("?")[0];
  if (/^\/(?:[\w.-]+\/)*[\w.-]+\.(?:jpe?g|png|webp)$/i.test(clean) && !clean.includes("..")) {
    const pub = path.join(process.cwd(), "public");
    const file = path.join(pub, ...clean.split("/").filter(Boolean));
    return file.startsWith(pub + path.sep) ? fs.readFile(file).catch(() => null) : null;
  }
  // Only our own image host: never fetch an arbitrary URL from the server.
  if (/^https:\/\/res\.cloudinary\.com\//.test(clean)) {
    const res = await fetch(imageUrl, { signal }).catch(() => null);
    return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  return null;
}

const mimeOf = (buf: Buffer) => (buf[0] === 0x89 ? "image/png" : buf[0] === 0x52 && buf[8] === 0x57 ? "image/webp" : "image/jpeg");

/** Runs `fn` with an abort signal that fires after `ms`; rejects at the deadline even if `fn` ignores the signal. */
async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { ac.abort(); reject(new Error(`timed out after ${ms} ms`)); }, ms);
  });
  try {
    return await Promise.race([fn(ac.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export type Screened = {
  decision: Decision;
  /** What to store for admins; null when no provider is set. */
  record: AutoCheckRecord | null;
  raw: unknown;
};

/**
 * Checks one stored upload. Never throws. `hint` is what the dev-only mock reads (the title, which defaults to the
 * file name, plus the image URL).
 */
export async function screenUpload(opts: { imageUrl: string; title: string; artistLabels: string[] }): Promise<Screened> {
  const provider = activeProvider();
  if (provider === "none") {
    if (configuredProvider() === "mock") console.warn("IMAGE_CHECK: the mock provider is ignored in production");
    return { decision: decide(null, opts.artistLabels), record: null, raw: null };
  }
  const started = Date.now();
  const base = { provider, artistLabels: opts.artistLabels, at: new Date().toISOString() };
  try {
    const result: ModerationResult = await withTimeout(timeoutMs(), async (signal) => {
      const image = await readPreview(opts.imageUrl, signal);
      if (!image) throw new Error("couldn't read the preview image");
      return runProvider(provider, { image, mime: mimeOf(image), hint: `${opts.title} ${opts.imageUrl}`, signal });
    });
    const decision = decide(result, opts.artistLabels);
    void resolveAlerts({ prefix: `image_check_failed:${provider}:` }).catch(() => {});
    return {
      decision,
      record: { ...base, outcome: decision.outcome, scores: scoresOf(result), reasons: decision.reasons, addedLabels: decision.addedLabels, ms: Date.now() - started },
      raw: result.raw,
    };
  } catch (err: any) {
    const error = String(err?.message || err).slice(0, 200);
    console.error("IMAGE_CHECK_FAIL", provider, error);
    await raiseAlert({
      kind: "image_check_failed",
      key: imageCheckFailedKey(provider),
      title: `Automatic image check isn't working (${provider}): ${error}. Uploads go through unchecked.`,
      link: "/admin",
      severity: "normal",
    });
    return {
      decision: decide(null, opts.artistLabels, "error"),
      record: { ...base, outcome: "error", scores: {}, reasons: [], addedLabels: [], ms: Date.now() - started, error },
      raw: null,
    };
  }
}

function trimRaw(raw: unknown): unknown {
  if (raw == null) return null;
  try {
    const s = JSON.stringify(raw);
    return s.length <= RAW_LIMIT ? JSON.parse(s) : { truncated: true, head: s.slice(0, RAW_LIMIT) };
  } catch {
    return null;
  }
}

/** Keeps the check's result with the artwork (AdminAction row). Never throws. */
export async function saveAutoCheck(artworkId: string, s: Screened): Promise<void> {
  if (!s.record) return;
  const r = s.record;
  const summary =
    r.outcome === "review" ? `Automatic image check held it for review (${r.reasons.join(", ")})`
    : r.outcome === "labeled" ? `Automatic image check added ${r.addedLabels.join(", ")}`
    : r.outcome === "error" ? `Automatic image check didn't run: ${r.error}`
    : "Automatic image check: clean";
  try {
    await prisma.adminAction.create({
      data: {
        adminId: SYSTEM_ADMIN.id, adminEmail: SYSTEM_ADMIN.email, action: AUTO_CHECK_ACTION, targetType: "artwork", targetId: artworkId,
        summary, details: { ...r, raw: trimRaw(s.raw) } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("IMAGE_CHECK_SAVE_FAIL", artworkId, err);
  }
}

/** The latest check per artwork, for the moderation cards. */
export async function autoChecksFor(artworkIds: string[]): Promise<Map<string, AutoCheckRecord>> {
  const out = new Map<string, AutoCheckRecord>();
  if (!artworkIds.length) return out;
  const rows = await prisma.adminAction.findMany({
    where: { action: AUTO_CHECK_ACTION, targetType: "artwork", targetId: { in: artworkIds } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, details: true },
  }).catch(() => []);
  for (const row of rows) {
    if (!row.targetId || out.has(row.targetId)) continue;
    const d = (row.details && typeof row.details === "object" ? row.details : {}) as Record<string, any>;
    out.set(row.targetId, {
      provider: d.provider, outcome: d.outcome, scores: d.scores || {}, reasons: d.reasons || [], addedLabels: d.addedLabels || [],
      artistLabels: d.artistLabels || [], ms: d.ms || 0, error: d.error, at: d.at,
    });
  }
  return out;
}

/** Health line for lib/integrations.ts (env only, no network). */
export { activeProvider, configuredProvider, providerProblem } from "./providers";
