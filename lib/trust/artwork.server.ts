// Artwork auto-approval, server side: gathers the signals for lib/trust/artwork.ts, applies the owner's settings,
// picks spot checks and records every decision (AdminAction "artwork.auto_decision", by "system").
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeProvider, extraProvider, imageCheckReady, providerCoverage, type Screened } from "@/lib/moderation";
import { pickSpotCheck, type ResolvedTrust } from "./config";
import { AUTO_APPROVE_AFTER, AUTO_HOLD_PREFIX, decideArtwork, isNewArtist, trustedByRecord, type ArtworkDecision, type ArtworkSignals, type StoredArtworkDecision, type TrustReason } from "./artwork";
import { trustReasonText } from "./labels";
import { checkText } from "./text";
import { trustSettings } from "./settings";

export const AUTO_DECISION_ACTION = "artwork.auto_decision";
/** An admin looked at a spot-checked piece and left it live. */
export const SPOT_OK_ACTION = "artwork.spot_ok";
const SYSTEM = { adminId: "system", adminEmail: "auto-check" };
const DAY = 86_400_000;

/** The artist's side of the signals. */
export async function artistRecord(artistId: string): Promise<ArtworkSignals["artist"] | null> {
  const since = new Date(Date.now() - DAY);
  const [a, approvedCount, openReports, uploadsLast24h] = await Promise.all([
    prisma.artist.findUnique({ where: { id: artistId }, select: { role: true, verification: true, suspendedAt: true, createdAt: true } }),
    prisma.artwork.count({ where: { artistId, status: "APPROVED" } }),
    prisma.artReport.count({ where: { status: "open", reason: { not: "counter" }, artwork: { artistId } } }),
    prisma.artwork.count({ where: { artistId, createdAt: { gte: since } } }),
  ]);
  if (!a) return null;
  return {
    admin: a.role === "ADMIN",
    verified: a.verification === "VERIFIED",
    suspended: !!a.suspendedAt,
    openReports,
    approvedCount,
    accountAgeDays: (Date.now() - a.createdAt.getTime()) / DAY,
    uploadsLast24h,
  };
}

export type UploadDecision = { result: ArtworkDecision; spotCheck: boolean; settings: ResolvedTrust };
export type UploadContext = { settings: ResolvedTrust; artist: ArtworkSignals["artist"] | null; newArtist: boolean };

/** Read before the image check runs: a new artist's upload also gets the extra check (lib/moderation). */
export async function uploadContext(artistId: string): Promise<UploadContext> {
  const [settings, artist] = await Promise.all([trustSettings(), artistRecord(artistId).catch(() => null)]);
  return { settings, artist, newArtist: artist ? isNewArtist(artist, settings.minAccountDays) : true };
}

/** Decides a new upload or a replaced image. Never throws: if the artist can't be read, it holds. */
export async function decideUpload(o: {
  ctx: UploadContext;
  check: Screened;
  duplicate: boolean;
  title: string;
  description: string;
  printableCount: number;
  isNewUpload: boolean;
}): Promise<UploadDecision> {
  const { settings, artist } = o.ctx;
  if (!artist) {
    return { result: { decision: "hold", mode: "auto", reasons: [{ code: "check_error", detail: "couldn't read the artist" }], passed: [], flagCode: "check_error" }, spotCheck: false, settings };
  }
  const scores = o.check.record?.scores ?? {};
  const result = decideArtwork({
    autoApprove: settings.autoApprove,
    providerReady: settings.providerReady,
    check: { outcome: o.check.decision.outcome, reasons: o.check.decision.reasons, error: o.check.record?.error, aiGenerated: scores.aiGenerated, webFullMatches: scores.webFullMatches },
    coverage: o.check.record?.coverage ?? [],
    duplicate: o.duplicate,
    textFlags: checkText(o.title, o.description),
    artist,
    printableCount: o.printableCount,
    isNewUpload: o.isNewUpload,
    settings: { velocityN: settings.velocityN, minAccountDays: settings.minAccountDays },
  });
  const spotCheck = result.decision === "approve" && result.mode === "auto" && pickSpotCheck(settings.spotCheckEvery);
  return { result, spotCheck, settings };
}

/** The flaggedReason for a held piece: duplicate first, then the image check's, then the trust engine's own. */
export function holdFlag(result: ArtworkDecision, duplicateFlag: string | null, imageFlag: string | null): string | null {
  if (result.decision !== "hold") return null;
  if (duplicateFlag) return duplicateFlag;
  if (imageFlag) return imageFlag;
  return result.flagCode ? `${AUTO_HOLD_PREFIX}${result.flagCode}` : null;
}

/** Records one decision. Never throws. */
export async function recordArtworkDecision(artworkId: string, d: { result: ArtworkDecision; spotCheck?: boolean; source: StoredArtworkDecision["source"] }): Promise<void> {
  const r = d.result;
  const details: StoredArtworkDecision = { ...r, spotCheck: !!d.spotCheck, source: d.source, at: new Date().toISOString() };
  const summary = r.decision === "approve"
    ? `Auto-approved${d.spotCheck ? " (spot check)" : ""}: ${r.passed.join(", ")}`
    : `Held: ${r.reasons.map(trustReasonText).join(", ")}`;
  try {
    await prisma.adminAction.create({
      data: { ...SYSTEM, action: AUTO_DECISION_ACTION, targetType: "artwork", targetId: artworkId, summary: summary.slice(0, 500), details: details as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    console.error("AUTO_DECISION_SAVE_FAIL", artworkId, err);
  }
}

/** A report came in on a live piece: it goes back in review (lib/reports behaviour decides whether it stays live). */
export async function recordReportHold(artworkId: string, reason: string): Promise<void> {
  const reasons: TrustReason[] = [{ code: "report", detail: reason }];
  await recordArtworkDecision(artworkId, { result: { decision: "hold", mode: "auto", reasons, passed: [], flagCode: "report" }, source: "report" });
}

/** The latest decision per artwork, for the moderation cards. */
export async function autoDecisionsFor(artworkIds: string[]): Promise<Map<string, StoredArtworkDecision>> {
  const out = new Map<string, StoredArtworkDecision>();
  if (!artworkIds.length) return out;
  const rows = await prisma.adminAction.findMany({
    where: { action: AUTO_DECISION_ACTION, targetType: "artwork", targetId: { in: artworkIds } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, details: true },
  }).catch(() => []);
  for (const row of rows) {
    if (!row.targetId || out.has(row.targetId)) continue;
    const d = (row.details && typeof row.details === "object" ? row.details : {}) as Record<string, any>;
    out.set(row.targetId, {
      decision: d.decision === "approve" ? "approve" : "hold", mode: d.mode || "auto", reasons: Array.isArray(d.reasons) ? d.reasons : [],
      passed: Array.isArray(d.passed) ? d.passed : [], flagCode: d.flagCode ?? null, spotCheck: !!d.spotCheck, source: d.source || "upload", at: d.at,
    });
  }
  return out;
}

/** Live pieces picked for a spot check in the last 60 days that no admin has looked at yet, newest first. */
export async function openSpotChecks(limit = 120): Promise<string[]> {
  const since = new Date(Date.now() - 60 * DAY);
  const picked = await prisma.adminAction.findMany({
    where: { action: AUTO_DECISION_ACTION, targetType: "artwork", createdAt: { gte: since }, details: { path: ["spotCheck"], equals: true } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true },
    take: 500,
  }).catch(() => []);
  const ids = Array.from(new Set(picked.map((p) => p.targetId).filter((x): x is string => !!x)));
  if (!ids.length) return [];
  const [seen, live] = await Promise.all([
    prisma.adminAction.findMany({ where: { action: SPOT_OK_ACTION, targetType: "artwork", targetId: { in: ids } }, select: { targetId: true } }),
    prisma.artwork.findMany({ where: { id: { in: ids }, status: "APPROVED" }, select: { id: true } }),
  ]);
  const done = new Set(seen.map((s) => s.targetId));
  const isLive = new Set(live.map((l) => l.id));
  return ids.filter((id) => !done.has(id) && isLive.has(id)).slice(0, limit);
}

/** The line next to "Post" on /studio/art/new: what happens to this artist's next upload. */
export async function uploadReviewNote(artistId: string): Promise<{ note: string; reviewed: boolean }> {
  const { settings, artist, newArtist } = await uploadContext(artistId);
  // New artists need the extra check (gore, hate symbols) unless the main provider covers it.
  const covered = !newArtist || ["gore", "hate"].every((c) => (providerCoverage(activeProvider(), "artwork") as string[]).concat(extraProvider() !== "none" ? providerCoverage(extraProvider(), "extra") : []).includes(c));
  if (settings.autoApprove && imageCheckReady() && covered) {
    return { note: "Most pieces go live right after a quick automatic check. If something needs a look, a person checks it, usually within a day.", reviewed: false };
  }
  if (artist && trustedByRecord(artist)) return { note: "Most pieces go live on your page the moment you post them.", reviewed: false };
  return { note: `A person checks your first ${AUTO_APPROVE_AFTER} pieces, usually within a day. We email you when each one is live.`, reviewed: true };
}
