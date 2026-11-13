// Artist auto-verification, server side: runs the checks for lib/trust/verification.ts on a PENDING request,
// verifies the artist when everything passes, and records every decision (AdminAction "verification.auto_decision",
// by "system"). Also the auto-revoke when a DMCA notice is upheld or the artist is suspended.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { alertKey, raiseAlert, resolveAlerts } from "@/lib/alerts";
import { readEvidence } from "@/components/artist/verification";
import { screenPhoto, type PhotoCheck } from "@/lib/moderation";
import { DUPLICATE_PREFIX } from "@/lib/imageHash";
import { trustSettings } from "./settings";
import { decideVerification, findProof, type VerificationDecision, type WebsiteProof } from "./verification";
import { localFetchAllowed, safeFetchText } from "./safeFetch";
import { artfinityHosts, verifyCode } from "./verifyCode";
import { instagramProven, instagramSignInAvailable } from "./instagram";
import { trustReasonText } from "./labels";

export const VERIFY_DECISION_ACTION = "verification.auto_decision";
export const VERIFY_REVOKE_ACTION = "verification.auto_revoke";
const SYSTEM = { adminId: "system", adminEmail: "auto-check" };
const SITE = () => process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";
const FROM = "Artfinity <notifications@theartfinity.com>";
const DAY = 86_400_000;

/** The email an artist gets when they're verified (by a person or by the checks). */
export function verifiedMail(first: string, slug: string) {
  return {
    subject: "You're verified on Artfinity",
    text: `Hi ${first},\n\nWe checked your evidence. Your page now shows the verified seal next to your name.\n\n${SITE()}/@${slug}\n\nArtfinity`,
  };
}

export type StoredVerificationDecision = VerificationDecision & { at: string; photo?: Partial<PhotoCheck>; website?: WebsiteProof | null; sightengineOps?: number };

/** Website ownership: the code or the artist's Artfinity link on the page. Never throws. */
export async function checkWebsite(url: string, artistId: string, handle: string): Promise<WebsiteProof> {
  const res = await safeFetchText(url, { allowLocal: localFetchAllowed() }).catch(() => null);
  if (!res) return { url, result: "error", error: "no answer" };
  if (!res.ok) return { url, result: "error", error: res.error };
  const found = findProof(res.body, { code: verifyCode(artistId), handle, hosts: artfinityHosts() });
  return { url, result: found ?? "not_found" };
}

/**
 * Runs the checks on the artist's PENDING request. Approves (VERIFIED + the usual email) when all pass; otherwise the
 * request stays in the queue with the reasons. Returns null when there's no pending request. Never throws.
 */
export async function runAutoVerification(artistId: string): Promise<{ result: VerificationDecision; verified: boolean } | null> {
  try {
    const a = await prisma.artist.findUnique({
      where: { id: artistId },
      select: { id: true, slug: true, email: true, first_name: true, artist_name: true, name: true, verification: true, verificationEvidence: true, emailVerifiedAt: true, createdAt: true, suspendedAt: true },
    });
    if (!a || a.verification !== "PENDING") return null;
    const settings = await trustSettings();
    const ev = readEvidence(a.verificationEvidence);

    // Only spend a provider call and a fetch when the result can count.
    const live = settings.autoVerify && settings.verifyReady;
    const [website, igProven, photo, approvedCount, openReports, dupRows] = await Promise.all([
      live && ev.website ? checkWebsite(ev.website, a.id, a.slug) : Promise.resolve(null),
      live && ev.instagram ? instagramProven(a.id, ev.instagram) : Promise.resolve(false),
      live && ev.photo ? screenPhoto(ev.photo) : Promise.resolve(null),
      prisma.artwork.count({ where: { artistId, status: "APPROVED" } }),
      prisma.artReport.count({ where: { status: "open", reason: { not: "counter" }, artwork: { artistId } } }),
      prisma.adminAction.findMany({ where: { action: "artwork.reject", details: { path: ["artistId"], equals: artistId } }, select: { details: true }, take: 200 }),
    ]);
    const openDupes = await prisma.artwork.count({ where: { artistId, status: { not: "REJECTED" }, flaggedReason: { startsWith: DUPLICATE_PREFIX } } });
    const confirmedDupes = dupRows.filter((r) => String((r.details as Record<string, unknown> | null)?.flaggedReason ?? "").startsWith(DUPLICATE_PREFIX)).length;

    const result = decideVerification({
      autoVerify: settings.autoVerify,
      providerReady: settings.verifyReady,
      website: ev.website ? website ?? { url: ev.website, result: "error", error: "not checked" } : null,
      instagram: ev.instagram ? { url: ev.instagram, proven: igProven, oauthAvailable: instagramSignInAvailable() } : null,
      photo: photo
        ? { ran: photo.ran, error: photo.error, faces: photo.scores.faces, aiGenerated: photo.coverage.includes("ai") ? photo.scores.aiGenerated : undefined, webFullMatches: photo.coverage.includes("web") ? photo.scores.webFullMatches : undefined, flagged: photo.reasons }
        : { ran: false, error: ev.photo ? "not checked" : "no photo", flagged: [] },
      facesSupported: !!photo?.coverage.includes("faces"),
      record: {
        emailConfirmed: !!a.emailVerifiedAt,
        approvedCount,
        accountAgeDays: (Date.now() - a.createdAt.getTime()) / DAY,
        openReports,
        duplicateFlags: openDupes + confirmedDupes,
        suspended: !!a.suspendedAt,
      },
      settings: { minAccountDays: settings.minAccountDays },
    });

    const details: StoredVerificationDecision = {
      ...result, at: new Date().toISOString(), website,
      photo: photo ? { provider: photo.provider, ran: photo.ran, scores: photo.scores, coverage: photo.coverage, error: photo.error, ms: photo.ms } : undefined,
      sightengineOps: photo?.sightengineOps ?? 0,
    };
    const name = a.artist_name || a.name;
    await prisma.adminAction.create({
      data: {
        ...SYSTEM, action: VERIFY_DECISION_ACTION, targetType: "artist", targetId: a.id,
        summary: (result.decision === "approve" ? `Auto-verified ${name}: ${result.passed.join(", ")}` : `Verification held for ${name}: ${result.reasons.map(trustReasonText).join(", ")}`).slice(0, 500),
        details: details as unknown as Prisma.InputJsonValue,
      },
    }).catch((err) => console.error("VERIFY_DECISION_SAVE_FAIL", err));

    if (result.decision !== "approve") return { result, verified: false };
    // Conditional on PENDING, so an admin's decision a moment ago wins.
    const done = await prisma.artist.updateMany({ where: { id: a.id, verification: "PENDING" }, data: { verification: "VERIFIED", verifiedAt: new Date(), verificationNote: null } });
    if (done.count !== 1) return { result, verified: false };
    await resolveAlerts({ prefix: alertKey.verificationPrefix(a.id) });
    const first = a.first_name || name.split(" ")[0];
    await resend.emails.send({ from: FROM, to: a.email, ...verifiedMail(first, a.slug) }).catch(() => null);
    return { result, verified: true };
  } catch (err) {
    console.error("AUTO_VERIFY_FAIL", artistId, err);
    return null;
  }
}

/** The latest decision per artist, for the verification queue. */
export async function verificationDecisionsFor(artistIds: string[]): Promise<Map<string, StoredVerificationDecision>> {
  const out = new Map<string, StoredVerificationDecision>();
  if (!artistIds.length) return out;
  const rows = await prisma.adminAction.findMany({
    where: { action: { in: [VERIFY_DECISION_ACTION, VERIFY_REVOKE_ACTION] }, targetType: "artist", targetId: { in: artistIds } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, details: true, action: true },
  }).catch(() => []);
  for (const row of rows) {
    if (!row.targetId || out.has(row.targetId)) continue;
    const d = (row.details && typeof row.details === "object" ? row.details : {}) as Record<string, any>;
    out.set(row.targetId, { decision: d.decision === "approve" ? "approve" : "hold", reasons: Array.isArray(d.reasons) ? d.reasons : [], passed: Array.isArray(d.passed) ? d.passed : [], at: d.at, website: d.website ?? null, photo: d.photo });
  }
  return out;
}

const REVOKE_NOTE: Record<"dmca" | "suspended", string> = {
  dmca: "Verification was removed after a copyright takedown. Send new evidence to be checked again.",
  suspended: "Verification was removed because your page was paused.",
};

/**
 * Removes the seal when a DMCA notice against the artist is upheld or the artist is suspended. Records it, alerts
 * admins and sends the same email as a manual revoke. Does nothing for an artist who isn't verified. Never throws.
 */
export async function autoRevokeVerification(artistId: string, cause: "dmca" | "suspended", detail?: string): Promise<boolean> {
  try {
    const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true, email: true, first_name: true, artist_name: true, name: true, verification: true } });
    if (!a || a.verification !== "VERIFIED") return false;
    const note = REVOKE_NOTE[cause];
    const r = await prisma.artist.updateMany({ where: { id: a.id, verification: "VERIFIED" }, data: { verification: "REJECTED", verifiedAt: null, verificationNote: note } });
    if (r.count !== 1) return false;
    const name = a.artist_name || a.name;
    const why = cause === "dmca" ? "a copyright takedown was upheld" : "the account was suspended";
    await prisma.adminAction.create({
      data: {
        ...SYSTEM, action: VERIFY_REVOKE_ACTION, targetType: "artist", targetId: a.id, summary: `Seal removed from ${name}: ${why}`,
        details: { decision: "hold", reasons: [{ code: cause === "dmca" ? "revoked_dmca" : "revoked_suspended", detail }], passed: [], at: new Date().toISOString() } as Prisma.InputJsonValue,
      },
    }).catch((err) => console.error("AUTO_REVOKE_SAVE_FAIL", err));
    await raiseAlert({ kind: "verification", key: `verification_revoked:${a.id}:${Date.now()}`, title: `Seal removed from ${name}: ${why}`, link: "/admin/verification?tab=declined", severity: "normal" });
    const first = a.first_name || name.split(" ")[0];
    await resend.emails.send({
      from: FROM, to: a.email, subject: "Your Artfinity verification was removed",
      text: `Hi ${first},\n\nYour verified seal was removed.\n\n${note}\n\nSend new evidence here: ${SITE()}/studio/verify\n\nArtfinity`,
    }).catch(() => null);
    return true;
  } catch (err) {
    console.error("AUTO_REVOKE_FAIL", artistId, err);
    return false;
  }
}
