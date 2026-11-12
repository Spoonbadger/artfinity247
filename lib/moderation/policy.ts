// What the automatic image check does with a result. Pure (type imports only), so the unit check and the backfill
// script can load it directly. Thresholds are the knobs: raise one to flag less, lower it to flag more.
//
//   High explicit sexual content, gore or hate  → held for a person (PENDING, flaggedReason "auto_moderation:<reason>",
//   (or obviously not artwork)                    admin alert). Suggested labels are added too, so "Approve + keep
//                                                 labels" in /admin/moderation is one click.
//   Moderate nudity or violence, label missing  → the label is added (blurred for buyers until they tap) and the
//                                                 piece goes live as usual; the artist is told and can change it.
//   Clean                                       → nothing changes.
// Artistic nudity is allowed with a label: nudity alone never holds a piece, only explicit sexual content does.
import type { Decision, ModerationResult, Scores } from "./types";
import type { SENSITIVE_LABELS } from "../../components/studio/sensitive";

type Label = (typeof SENSITIVE_LABELS)[number];
export const NUDITY: Label = "Nudity";
export const VIOLENCE: Label = "Violence or gore";

export const AUTO_PREFIX = "auto_moderation:";

export const THRESHOLDS = {
  /** Held for review. Scores are 0-1. */
  review: {
    sexual: 0.85,
    gore: 0.85,
    hate: 0.8,
    /** A photograph of a person, not artwork. */
    photoOfPerson: 0.9,
    /** Overlaid text on its own (screenshots). High, because artists' digital watermarks count as overlaid text. */
    textOverlay: 0.98,
    /** Overlaid text on a photo (memes): text at least this AND photo-of-person at least memePhoto. */
    memeText: 0.9,
    memePhoto: 0.5,
  },
  /** The matching label is added when it's missing. */
  label: {
    nudity: 0.5,
    sexual: 0.5,
    violence: 0.5,
    gore: 0.4,
  },
} as const;

/** Reasons, most serious first, with the words admins see on the moderation card. */
export const REASONS: Record<string, string> = {
  sexual: "explicit sexual content",
  gore: "graphic gore",
  hate: "a possible hate symbol",
  photo_of_person: "a photo of a person, not artwork",
  meme: "a meme (photo with overlaid text)",
  text_overlay: "a screenshot or overlaid text",
};

export const REVIEW_NOTICE = "A person will take a quick look before this goes live — usually within a day.";

export function labelNotice(added: string[]): string | null {
  if (!added.length) return null;
  const names = added.map((l) => `'${l}'`);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `We marked this ${list} so it's blurred until buyers tap — change it anytime.`;
}

const has = (labels: string[], l: string) => labels.some((x) => x.toLowerCase() === l.toLowerCase());

/** Why a result should be held for a person, most serious first. Empty = not held. */
export function reviewReasons(r: Scores): string[] {
  const t = THRESHOLDS.review;
  const out: string[] = [];
  if ((r.sexual ?? 0) >= t.sexual) out.push("sexual");
  if ((r.gore ?? 0) >= t.gore) out.push("gore");
  if ((r.hate ?? 0) >= t.hate) out.push("hate");
  const photo = r.isPhotoOfPerson ?? 0, text = r.hasText ?? 0;
  if (photo >= t.photoOfPerson) out.push("photo_of_person");
  else if (text >= t.memeText && photo >= t.memePhoto) out.push("meme");
  if (text >= t.textOverlay && !out.includes("meme")) out.push("text_overlay");
  return out;
}

/** Labels the scores call for. */
export function suggestedLabels(r: Scores): string[] {
  const t = THRESHOLDS.label;
  const out: string[] = [];
  if ((r.nudity ?? 0) >= t.nudity || (r.sexual ?? 0) >= t.sexual) out.push(NUDITY);
  if ((r.violence ?? 0) >= t.violence || (r.gore ?? 0) >= t.gore) out.push(VIOLENCE);
  return out;
}

/** The scores worth storing and showing (no raw response). */
export function scoresOf(r: ModerationResult): Scores {
  const s: Scores = { nudity: r.nudity, sexual: r.sexual, violence: r.violence, gore: r.gore, hate: r.hate };
  for (const k of r.unchecked ?? []) delete s[k];
  if (r.isPhotoOfPerson !== undefined) s.isPhotoOfPerson = r.isPhotoOfPerson;
  if (r.hasText !== undefined) s.hasText = r.hasText;
  if (r.aiGenerated !== undefined) s.aiGenerated = r.aiGenerated;
  if (r.faces !== undefined) s.faces = r.faces;
  if (r.webFullMatches !== undefined) s.webFullMatches = r.webFullMatches;
  return s;
}

/**
 * The decision for one upload. `result` null = the check didn't run (off, failed or timed out): nothing changes,
 * so artists are never blocked because a provider is down.
 */
export function decide(result: ModerationResult | Scores | null, artistLabels: string[], outcomeIfNone: "off" | "error" = "off"): Decision {
  if (!result) return { outcome: outcomeIfNone, reasons: [], flaggedReason: null, labels: artistLabels, addedLabels: [], notice: null };
  const addedLabels = suggestedLabels(result).filter((l) => !has(artistLabels, l));
  const labels = [...artistLabels, ...addedLabels];
  const reasons = reviewReasons(result);
  if (reasons.length) {
    return { outcome: "review", reasons, flaggedReason: `${AUTO_PREFIX}${reasons[0]}`, labels, addedLabels, notice: REVIEW_NOTICE };
  }
  if (addedLabels.length) return { outcome: "labeled", reasons: [], flaggedReason: null, labels, addedLabels, notice: labelNotice(addedLabels) };
  return { outcome: "clean", reasons: [], flaggedReason: null, labels: artistLabels, addedLabels: [], notice: null };
}

export const isAutoFlag = (flaggedReason: string | null | undefined) => !!flaggedReason?.startsWith(AUTO_PREFIX);
export const autoReasonOf = (flaggedReason: string | null | undefined) => (isAutoFlag(flaggedReason) ? flaggedReason!.slice(AUTO_PREFIX.length) : null);
export const reasonText = (reason: string | null | undefined) => (reason ? REASONS[reason] || reason.replace(/_/g, " ") : "");
