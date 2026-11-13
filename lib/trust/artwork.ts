// Artwork auto-approval: signals in, { decision, reasons } out. Pure (no imports), so node --test loads it directly
// (lib/trust/trust.test.mjs). The server side that gathers the signals and records the result is lib/trust/artwork.server.ts.
//
// Three modes:
//   off     the owner switched auto-approval off: today's rules (verified artists, admins and artists with
//           AUTO_APPROVE_AFTER approved pieces go live; everyone else waits). Duplicates and image-check holds wait.
//   legacy  auto-approval is on but the checks this artist needs can't run: fail safe, the same rules as "off".
//           That's no provider at all, or a new artist when only nudity is covered (the local provider without
//           the Sightengine extra check, or the extra check failed).
//   auto    every check below must pass. Anything that flags, or a check that didn't run, holds.
//
// Tiers: an established artist needs nudity covered (any provider, the free local one included). A new artist
// (account younger than minAccountDays, or fewer than AUTO_APPROVE_AFTER approved pieces) also needs gore and hate
// symbols covered (Sightengine, AWS, or the mock). AI-generated and web copies count whenever a check covers them.

export const AUTO_APPROVE_AFTER = 3;
/** An AI-generated score at or above this holds the piece (0-1). Sightengine "genai". */
export const AI_THRESHOLD = 0.9;

export type CheckOutcome = "clean" | "labeled" | "review" | "error" | "off";

export type ArtworkSignals = {
  /** The owner's auto-approval switch (resolved, lib/trust/config.ts). */
  autoApprove: boolean;
  /** An image check provider is set and can run. */
  providerReady: boolean;
  /** The automatic image check (lib/moderation) for this image. */
  check: { outcome: CheckOutcome; reasons: string[]; error?: string; aiGenerated?: number; webFullMatches?: number };
  /** What the checks that ran could tell (lib/moderation providerCoverage): nudity, gore, hate, ai, web. */
  coverage: string[];
  /** The dHash check found another artist's piece (lib/imageHash.ts). */
  duplicate: boolean;
  /** lib/trust/text.ts checkText(title, description). */
  textFlags: string[];
  artist: {
    admin: boolean;
    verified: boolean;
    suspended: boolean;
    /** Open reports (DMCA, AI, content) on any of their pieces. Counter-notices don't count. */
    openReports: number;
    approvedCount: number;
    accountAgeDays: number;
    /** Their uploads in the last 24 hours, before this one. */
    uploadsLast24h: number;
  };
  /** Print sizes the file is sharp enough for (lib/printSizes). None = too small. */
  printableCount: number;
  /** A new upload (velocity counts); false for a replaced image. */
  isNewUpload: boolean;
  settings: { velocityN: number; minAccountDays: number };
};

export type TrustReason = { code: string; detail?: string };
export type TrustMode = "off" | "legacy" | "auto";

export type ArtworkDecision = {
  decision: "approve" | "hold";
  mode: TrustMode;
  /** Why it's held, most serious first. Empty when approved. */
  reasons: TrustReason[];
  /** What passed, in plain words, for "Auto-approved: clean image, no duplicate, …". */
  passed: string[];
  /** For flaggedReason "auto_hold:<code>" when nothing more specific (duplicate, image check) applies. Null = no flag. */
  flagCode: string | null;
};

/** The first-pieces rule (today's behaviour). */
export function trustedByRecord(a: ArtworkSignals["artist"]): string | null {
  if (a.admin) return "admin";
  if (a.verified) return "verified artist";
  if (a.approvedCount >= AUTO_APPROVE_AFTER) return `${AUTO_APPROVE_AFTER}+ approved pieces`;
  return null;
}

/** New: account younger than minAccountDays, or fewer than AUTO_APPROVE_AFTER approved pieces. Admins never are. */
export function isNewArtist(a: Pick<ArtworkSignals["artist"], "admin" | "accountAgeDays" | "approvedCount">, minAccountDays: number): boolean {
  return !a.admin && (a.accountAgeDays < minAccountDays || a.approvedCount < AUTO_APPROVE_AFTER);
}

/** What a check has to cover for this artist (see the tiers above). */
export const requiredCoverage = (newArtist: boolean) => (newArtist ? ["nudity", "gore", "hate"] : ["nudity"]);

export function decideArtwork(s: ArtworkSignals): ArtworkDecision {
  const newArtist = isNewArtist(s.artist, s.settings.minAccountDays);
  const ran = s.check.outcome !== "error" && s.check.outcome !== "off";
  const missing = ran ? requiredCoverage(newArtist).filter((c) => !s.coverage.includes(c)) : [];
  const mode: TrustMode = !s.autoApprove ? "off" : !s.providerReady || missing.length ? "legacy" : "auto";
  const reasons: TrustReason[] = [];
  const passed: string[] = [];

  if (mode !== "auto") {
    // Today's rules: duplicates and image-check holds wait, then the first-pieces rule.
    if (s.duplicate) reasons.push({ code: "duplicate" });
    if (s.check.outcome === "review") for (const r of s.check.reasons) reasons.push({ code: "image", detail: r });
    const trusted = trustedByRecord(s.artist);
    if (!trusted) reasons.push({ code: "first_pieces" });
    if (reasons.length && mode === "legacy") reasons.push(s.providerReady ? { code: "checks_missing", detail: missing.join(", ") } : { code: "no_provider" });
    if (!reasons.length) passed.push(trusted!, ...(s.check.outcome === "clean" || s.check.outcome === "labeled" ? ["clean image"] : []), "no duplicate");
    // The first-pieces hold never had a flag; keep it that way so it reads as before in the queue.
    return { decision: reasons.length ? "hold" : "approve", mode, reasons, passed, flagCode: null };
  }

  // Image check: it must have run and be clean. A failure or timeout holds (fail safe).
  if (s.check.outcome === "error" || s.check.outcome === "off") reasons.push({ code: "check_error", detail: s.check.error });
  else if (s.check.outcome === "review") for (const r of s.check.reasons) reasons.push({ code: "image", detail: r });
  else passed.push("clean image");

  if (s.duplicate) reasons.push({ code: "duplicate" });
  else passed.push("no duplicate");

  if (s.coverage.includes("ai") && ran) {
    if (typeof s.check.aiGenerated !== "number") reasons.push({ code: "check_error", detail: "no AI-generated score" });
    else if (s.check.aiGenerated >= AI_THRESHOLD) reasons.push({ code: "ai_generated", detail: String(Math.round(s.check.aiGenerated * 100)) });
    else passed.push("no AI signal");
  }
  if (s.coverage.includes("web") && typeof s.check.webFullMatches === "number") {
    if (s.check.webFullMatches > 0) reasons.push({ code: "web_match", detail: String(s.check.webFullMatches) });
    else passed.push("not found elsewhere online");
  }

  if (s.textFlags.length) for (const f of s.textFlags) reasons.push({ code: f });
  else passed.push("title and description OK");

  if (s.artist.suspended) reasons.push({ code: "suspended" });
  if (s.artist.openReports > 0) reasons.push({ code: "report_open", detail: String(s.artist.openReports) });
  if (!s.artist.suspended && !s.artist.openReports) passed.push("no open reports");

  if (s.isNewUpload && newArtist && s.artist.uploadsLast24h >= s.settings.velocityN) {
    reasons.push({ code: "velocity", detail: String(s.settings.velocityN) });
  } else if (s.isNewUpload) passed.push("normal upload pace");

  if (s.printableCount <= 0) reasons.push({ code: "image_too_small" });
  else passed.push("big enough to print");

  const first = reasons.find((r) => r.code !== "duplicate" && r.code !== "image");
  return {
    decision: reasons.length ? "hold" : "approve",
    mode,
    reasons,
    passed: reasons.length ? [] : passed,
    flagCode: reasons.length ? (first?.code ?? reasons[0].code) : null,
  };
}

/** flaggedReason for a piece the trust engine held, when no duplicate or image-check flag says more. */
export const AUTO_HOLD_PREFIX = "auto_hold:";
export const isAutoHold = (flaggedReason: string | null | undefined) => !!flaggedReason?.startsWith(AUTO_HOLD_PREFIX);
export const autoHoldCode = (flaggedReason: string | null | undefined) => (isAutoHold(flaggedReason) ? flaggedReason!.slice(AUTO_HOLD_PREFIX.length) : null);

/** What's stored with each decision (AdminAction "artwork.auto_decision" details) and shown on the moderation card. */
export type StoredArtworkDecision = ArtworkDecision & { spotCheck: boolean; source: "upload" | "image_change" | "report"; at: string };

/** What the artist reads when the trust engine holds a piece. Generic on purpose: the reasons are for admins. */
export const HOLD_NOTICE = "Our moderation team will take a quick look before this goes live, usually within a day.";
