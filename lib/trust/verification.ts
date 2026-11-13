// Artist auto-verification: signals in, { decision, reasons } out, plus the page scan that finds the ownership
// proof. Pure (no imports), so node --test loads it directly. The server side is lib/trust/verification.server.ts.
//
// Approve only when all three pass:
//   1. Proof they own the link: the code or their Artfinity link is on their website, or their Instagram is
//      connected through Instagram sign-in (lib/oauth) with the same handle.
//   2. The photo check ran and found a person (and, if the provider can tell, the photo isn't elsewhere online).
//   3. Track record: email confirmed, 1+ approved piece, account old enough, no open reports, no duplicate flags,
//      not suspended.
// Anything else waits in the verification queue with the reasons. Off, or no provider: everything waits.

import type { TrustReason } from "./artwork";

/** A verification photo with an AI-generated score at or above this waits for a person (Sightengine "genai"). */
export const PHOTO_AI_THRESHOLD = 0.9;

export type WebsiteProof = { url: string; result: "code" | "link" | "not_found" | "error"; error?: string };
export type InstagramProof = { url: string; proven: boolean; oauthAvailable: boolean };

export type VerificationSignals = {
  autoVerify: boolean;
  providerReady: boolean;
  website: WebsiteProof | null;
  instagram: InstagramProof | null;
  photo: { ran: boolean; error?: string; faces?: number; aiGenerated?: number; webFullMatches?: number; flagged: string[] };
  /** The provider can count faces (lib/moderation providerCaps). */
  facesSupported: boolean;
  record: { emailConfirmed: boolean; approvedCount: number; accountAgeDays: number; openReports: number; duplicateFlags: number; suspended: boolean };
  settings: { minAccountDays: number };
};

export type VerificationDecision = { decision: "approve" | "hold"; reasons: TrustReason[]; passed: string[] };

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

export function decideVerification(s: VerificationSignals): VerificationDecision {
  const reasons: TrustReason[] = [];
  const passed: string[] = [];
  if (!s.autoVerify) reasons.push({ code: "auto_off" });
  else if (!s.providerReady) reasons.push({ code: "no_provider" });

  // 1. Ownership: one proven link is enough.
  const site = s.website;
  const siteOk = !!site && (site.result === "code" || site.result === "link");
  const igOk = !!s.instagram?.proven;
  if (siteOk) passed.push(site!.result === "code" ? `code found on ${host(site!.url)}` : `Artfinity link found on ${host(site!.url)}`);
  if (igOk) passed.push("Instagram connected");
  if (!siteOk && !igOk) {
    if (site?.result === "not_found") reasons.push({ code: "site_no_proof", detail: host(site.url) });
    if (site?.result === "error") reasons.push({ code: "site_error", detail: `${host(site.url)}: ${site.error || "no answer"}` });
    if (s.instagram) reasons.push({ code: s.instagram.oauthAvailable ? "instagram_not_connected" : "instagram_unchecked" });
    if (!site && !s.instagram) reasons.push({ code: "no_link" });
  }

  // 2. The photo.
  if (s.providerReady) {
    if (!s.photo.ran) reasons.push({ code: "photo_error", detail: s.photo.error });
    else {
      if (s.photo.flagged.length) for (const f of s.photo.flagged) reasons.push({ code: "photo_flagged", detail: f });
      if (!s.facesSupported || typeof s.photo.faces !== "number") reasons.push({ code: "photo_faces_unknown" });
      else if (s.photo.faces < 1) reasons.push({ code: "photo_no_person" });
      else passed.push("a person in the photo");
      if (typeof s.photo.aiGenerated === "number") {
        if (s.photo.aiGenerated >= PHOTO_AI_THRESHOLD) reasons.push({ code: "photo_ai", detail: String(Math.round(s.photo.aiGenerated * 100)) });
        else passed.push("photo not AI-made");
      }
      if (typeof s.photo.webFullMatches === "number") {
        if (s.photo.webFullMatches > 0) reasons.push({ code: "photo_web_match", detail: String(s.photo.webFullMatches) });
        else passed.push("photo not found elsewhere online");
      }
    }
  }

  // 3. Track record.
  const r = s.record;
  if (!r.emailConfirmed) reasons.push({ code: "email_unconfirmed" });
  else passed.push("email confirmed");
  if (r.approvedCount < 1) reasons.push({ code: "no_approved_art" });
  else passed.push(`${r.approvedCount} approved piece${r.approvedCount === 1 ? "" : "s"}`);
  if (r.accountAgeDays < s.settings.minAccountDays) reasons.push({ code: "account_new", detail: `${Math.floor(r.accountAgeDays)} of ${s.settings.minAccountDays}` });
  else passed.push(`account ${Math.floor(r.accountAgeDays)} days old`);
  if (r.openReports > 0) reasons.push({ code: "report_open", detail: String(r.openReports) });
  if (r.duplicateFlags > 0) reasons.push({ code: "duplicate_flags", detail: String(r.duplicateFlags) });
  if (r.suspended) reasons.push({ code: "suspended" });
  if (!r.openReports && !r.duplicateFlags && !r.suspended) passed.push("no reports or flags");

  return { decision: reasons.length ? "hold" : "approve", reasons, passed: reasons.length ? [] : passed };
}

/**
 * Looks for the ownership proof in a fetched page: the artist's code, or a link to their Artfinity page
 * (theartfinity.com/@handle, any of `hosts`). Whole-handle match, so @maya doesn't match @mayalee.
 */
export function findProof(html: string, o: { code: string; handle: string; hosts: string[] }): "code" | "link" | null {
  const text = html.replace(/&#0*64;|&commat;/gi, "@").replace(/&#x0*40;/gi, "@").replace(/&amp;/gi, "&");
  if (o.code && text.toLowerCase().includes(o.code.toLowerCase())) return "code";
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hosts = Array.from(new Set(o.hosts.map((h) => h.replace(/^www\./, "").toLowerCase()).filter(Boolean)));
  if (!o.handle || !hosts.length) return null;
  const re = new RegExp(`(?:^|[^a-z0-9.-])(?:www\\.)?(?:${hosts.map(esc).join("|")})(?::\\d+)?/(?:%40|@)${esc(o.handle)}(?![a-z0-9._-])`, "i");
  return re.test(text) ? "link" : null;
}

/** The handle in an Instagram URL from the evidence (https://instagram.com/handle), lowercased, or null. */
export function instagramHandle(url: string | null | undefined): string | null {
  const m = /instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i.exec(url || "");
  return m ? m[1].toLowerCase() : null;
}
