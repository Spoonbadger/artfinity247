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
import { activeProvider, configuredProvider, extraProvider, providerCoverage, providerProblem, runProvider, timeoutMs } from "./providers";
import { decide, reviewReasons, scoresOf } from "./policy";
import type { AutoCheckRecord, Coverage, Decision, ModerationResult, ProviderId, Scores } from "./types";

export type { AutoCheckRecord, Coverage, Decision, ModerationResult, ProviderId } from "./types";

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

const SCORE_FIELDS = ["nudity", "sexual", "violence", "gore", "hate"] as const;

/** The main result with the extra check's scores folded in (the higher score wins). */
export function mergeResults(main: ModerationResult, extra: ModerationResult | null): ModerationResult {
  if (!extra) return main;
  const out: ModerationResult = { ...main };
  const extraMeasures = new Set(SCORE_FIELDS.filter((k) => !(extra.unchecked ?? []).includes(k)));
  for (const k of SCORE_FIELDS) if (extraMeasures.has(k)) out[k] = Math.max(main[k], extra[k]);
  const unchecked = (main.unchecked ?? []).filter((k) => !extraMeasures.has(k as (typeof SCORE_FIELDS)[number]));
  if (unchecked.length) out.unchecked = unchecked;
  else delete out.unchecked;
  for (const k of ["aiGenerated", "webFullMatches", "isPhotoOfPerson", "hasText"] as const) {
    if (typeof extra[k] === "number") out[k] = Math.max(main[k] ?? 0, extra[k]!);
  }
  return out;
}

const sightOps = (...rs: (ModerationResult | null | undefined)[]) => rs.reduce((n, r) => n + (r?.provider === "sightengine" ? r.ops ?? 0 : 0), 0);

async function alertFailed(provider: ProviderId, error: string) {
  await raiseAlert({
    kind: "image_check_failed",
    key: imageCheckFailedKey(provider),
    title: `Automatic image check isn't working (${provider}): ${error}. Uploads aren't checked (with auto-approval on, they wait for a person).`,
    link: "/admin",
    severity: "normal",
  });
}

/**
 * Checks one stored upload. Never throws. `hint` is what the dev-only mock reads (the title, which defaults to the
 * file name, plus the image URL). `newArtist`: also run the extra check (IMAGE_MODERATION_EXTRA, Sightengine gore,
 * hate symbols and AI-generated) when one is set up. Its scores are folded in; if it fails, the main result stands
 * and the record says what wasn't covered (lib/trust then holds a new artist's piece).
 */
export async function screenUpload(opts: { imageUrl: string; title: string; artistLabels: string[]; newArtist?: boolean }): Promise<Screened> {
  const provider = activeProvider();
  if (provider === "none") {
    if (configuredProvider() === "mock") console.warn("IMAGE_CHECK: the mock provider is ignored in production");
    return { decision: decide(null, opts.artistLabels), record: null, raw: null };
  }
  const extra = opts.newArtist ? extraProvider() : "none";
  const started = Date.now();
  const base = { provider, artistLabels: opts.artistLabels, at: new Date().toISOString() };
  const ms = timeoutMs();
  try {
    const image = await withTimeout(ms, (signal) => readPreview(opts.imageUrl, signal));
    if (!image) throw new Error("couldn't read the preview image");
    const input = { image, mime: mimeOf(image), hint: `${opts.title} ${opts.imageUrl}` };
    const extraStarted = Date.now();
    const [main, second] = await Promise.all([
      withTimeout(ms, (signal) => runProvider(provider, { ...input, signal, purpose: "artwork" })),
      extra === "none"
        ? Promise.resolve(null)
        : withTimeout(ms, (signal) => runProvider(extra, { ...input, signal, purpose: "extra" })).then(
            (r) => ({ ok: true as const, r, ms: Date.now() - extraStarted }),
            (e: any) => ({ ok: false as const, error: String(e?.message || e).slice(0, 200), ms: Date.now() - extraStarted }),
          ),
    ]);
    const extraResult = second?.ok ? second.r : null;
    const result = mergeResults(main, extraResult);
    const decision = decide(result, opts.artistLabels);
    void resolveAlerts({ prefix: `image_check_failed:${provider}:` }).catch(() => {});
    if (second && !second.ok) {
      console.error("IMAGE_CHECK_EXTRA_FAIL", extra, second.error);
      await alertFailed(extra, second.error);
    } else if (second?.ok) void resolveAlerts({ prefix: `image_check_failed:${extra}:` }).catch(() => {});
    const coverage = Array.from(new Set<Coverage>([...providerCoverage(provider, "artwork"), ...(extraResult ? providerCoverage(extra, "extra") : [])]));
    return {
      decision,
      record: {
        ...base, outcome: decision.outcome, scores: scoresOf(result), reasons: decision.reasons, addedLabels: decision.addedLabels, ms: Date.now() - started,
        coverage,
        ...(second ? { extra: { provider: extra, ok: second.ok, error: second.ok ? undefined : second.error, ms: second.ms } } : {}),
        sightengineOps: sightOps(main, extraResult),
      },
      raw: extraResult ? { main: main.raw, extra: extraResult.raw } : main.raw,
    };
  } catch (err: any) {
    const error = String(err?.message || err).slice(0, 200);
    console.error("IMAGE_CHECK_FAIL", provider, error);
    await alertFailed(provider, error);
    return {
      decision: decide(null, opts.artistLabels, "error"),
      record: { ...base, outcome: "error", scores: {}, reasons: [], addedLabels: [], ms: Date.now() - started, error, coverage: [] },
      raw: null,
    };
  }
}

export type PhotoCheck = { provider: ProviderId; ran: boolean; scores: Scores; reasons: string[]; coverage: Coverage[]; error?: string; ms: number; sightengineOps: number };

/** The provider for verification photos: the extra check when one is set up (Sightengine faces), else the main one. */
export function photoProvider(): ProviderId {
  const extra = extraProvider();
  if (extra !== "none") return extra;
  return imageCheckReady() ? activeProvider() : "none";
}

/** A provider is ready that can tell whether a person is in a verification photo. */
export const photoCheckReady = () => providerCoverage(photoProvider(), "verification").includes("faces");

/**
 * The verification photo check (lib/trust): is a person in it, is it AI-made, is it clean. Sightengine gets only the
 * "faces" and "genai" models here (two operations). Never throws; ran=false when no provider is set or the check failed.
 */
export async function screenPhoto(imageUrl: string): Promise<PhotoCheck> {
  const provider = photoProvider();
  const coverage = providerCoverage(provider, "verification");
  const started = Date.now();
  if (provider === "none") return { provider, ran: false, scores: {}, reasons: [], coverage: [], error: "no provider", ms: 0, sightengineOps: 0 };
  try {
    const result: ModerationResult = await withTimeout(timeoutMs(), async (signal) => {
      const image = await readPreview(imageUrl, signal);
      if (!image) throw new Error("couldn't read the photo");
      return runProvider(provider, { image, mime: mimeOf(image), hint: imageUrl, signal, purpose: "verification" });
    });
    const reasons = coverage.includes("nudity") ? reviewReasons(result).filter((r) => r !== "photo_of_person" && r !== "meme" && r !== "text_overlay") : [];
    return { provider, ran: true, scores: scoresOf(result), reasons, coverage, ms: Date.now() - started, sightengineOps: sightOps(result) };
  } catch (err: any) {
    const error = String(err?.message || err).slice(0, 200);
    console.error("PHOTO_CHECK_FAIL", provider, error);
    return { provider, ran: false, scores: {}, reasons: [], coverage, error, ms: Date.now() - started, sightengineOps: 0 };
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
      coverage: Array.isArray(d.coverage) ? d.coverage : undefined, extra: d.extra, sightengineOps: d.sightengineOps,
    });
  }
  return out;
}

/** Health line for lib/integrations.ts (env only, no network). */
export { activeProvider, configuredProvider, extraProvider, providerCoverage, providerProblem, SIGHTENGINE_FREE_OPS } from "./providers";

/** The image check can run right now: a provider is set, allowed here, and has its keys. */
export function imageCheckReady(): boolean {
  const p = activeProvider();
  return p !== "none" && !providerProblem(p);
}
