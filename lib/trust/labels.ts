// Plain words for the trust engine's reasons, for the admin queues. Client-safe.
import { reasonText } from "@/lib/moderation/policy";
import { AUTO_APPROVE_AFTER, type TrustReason } from "./artwork";

const LABELS: Record<string, (d?: string) => string> = {
  // Artworks
  image: (d) => `image check found ${reasonText(d)}`,
  check_error: (d) => `image check didn't run${d ? ` (${d})` : ""}`,
  no_provider: () => "no image check set up",
  checks_missing: (d) => `${d ? d.replace("hate", "hate symbols").replace(", ", " and ") : "some checks"} not checked for new artists (needs the Sightengine extra check)`,
  duplicate: () => "looks like another artist's piece",
  ai_generated: (d) => `may be AI-made${d ? ` (${d}/100)` : ""}`,
  web_match: () => "same image found elsewhere online",
  text_profanity: () => "slur or profanity in the title or description",
  text_link: () => "link in the title or description",
  text_email: () => "email address in the title or description",
  text_phone: () => "phone number in the title or description",
  text_nonsense: () => "title looks like nonsense",
  report_open: (d) => `open report on their art${d && d !== "1" ? ` (${d})` : ""}`,
  suspended: () => "account suspended",
  velocity: (d) => `new artist, more than ${d || "N"} uploads in 24 hours`,
  image_too_small: () => "image too small to print",
  first_pieces: () => `new artist, first ${AUTO_APPROVE_AFTER} pieces get a look`,
  report: (d) => `reported${d ? `: ${d}` : ""}`,
  // Verification
  auto_off: () => "auto-verify is off",
  site_no_proof: (d) => `code or Artfinity link not found on ${d || "their site"}`,
  site_error: (d) => `couldn't open ${d || "their site"}`,
  instagram_not_connected: () => "Instagram not connected through Instagram sign-in",
  instagram_unchecked: () => "Instagram can't be checked automatically yet",
  no_link: () => "no website or Instagram",
  photo_error: (d) => `photo check didn't run${d ? ` (${d})` : ""}`,
  photo_flagged: (d) => `photo check found ${reasonText(d)}`,
  photo_faces_unknown: () => "photo check can't tell if a person is in it",
  photo_no_person: () => "no person in the photo",
  photo_web_match: () => "photo found elsewhere online",
  photo_ai: (d) => `photo may be AI-made${d ? ` (${d}/100)` : ""}`,
  email_unconfirmed: () => "email not confirmed",
  no_approved_art: () => "no approved artwork yet",
  account_new: (d) => `account too new${d ? ` (${d} days)` : ""}`,
  duplicate_flags: () => "duplicate flags on their art",
  revoked_dmca: () => "seal removed: copyright takedown upheld",
  revoked_suspended: () => "seal removed: account suspended",
};

export function trustReasonText(r: TrustReason): string {
  return LABELS[r.code]?.(r.detail) ?? r.code.replace(/_/g, " ");
}

/** "Auto-approved: clean image, no duplicate, …" or "Held: …". */
export function decisionLine(d: { decision: "approve" | "hold"; reasons: TrustReason[]; passed: string[] }, approvedWord = "Auto-approved"): string {
  return d.decision === "approve" ? `${approvedWord}: ${d.passed.join(", ")}` : `Held: ${d.reasons.map(trustReasonText).join(", ")}`;
}
