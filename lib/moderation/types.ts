// Shared shapes for the automatic image check (lib/moderation). Types only, so plain-JS scripts and tests that
// load the pure modules (providers.ts, policy.ts) with Node's type stripping never need to resolve this file.

export type ProviderId = "sightengine" | "google" | "aws" | "local" | "mock" | "none";

/** Every provider's answer, normalized. Scores are 0-1 (1 = certain). */
export type ModerationResult = {
  /** Visible nudity of any kind (artistic nudes included). */
  nudity: number;
  /** Explicit sexual content (sexual activity, pornographic display). */
  sexual: number;
  violence: number;
  /** Blood, injuries, corpses. */
  gore: number;
  /** Hate symbols (nazi, white-supremacist, extremist). */
  hate: number;
  /** A photograph of a person rather than artwork. Undefined when the provider can't tell. */
  isPhotoOfPerson?: number;
  /** Overlaid/digital text (memes, screenshots). Undefined when the provider can't tell. */
  hasText?: number;
  /** Made by an image generator (Sightengine "genai" model). Undefined when the provider can't tell. */
  aiGenerated?: number;
  /** Faces found (Sightengine "faces" model, requested only for verification photos). Undefined when not asked or unknown. */
  faces?: number;
  /** Full copies of the image found elsewhere online. No provider fills this yet (follow-up: Google Vision web detection). */
  webFullMatches?: number;
  /** Scores this provider doesn't measure (left at 0 above, hidden on the moderation card). The local provider: gore, hate... */
  unchecked?: ScoreKey[];
  /** Billed operations, for providers that bill per model (Sightengine). */
  ops?: number;
  provider: ProviderId;
  /** The provider's response as it came back (trimmed for storage). */
  raw: unknown;
};

export type ScoreKey = "nudity" | "sexual" | "violence" | "gore" | "hate" | "isPhotoOfPerson" | "hasText" | "aiGenerated" | "faces" | "webFullMatches";
export type Scores = Partial<Record<ScoreKey, number>>;

/** What a provider gets: the 1600px preview's bytes, a hint (title + URL, read by the dev-only mock) and an abort signal. */
export type ProviderInput = {
  image: Buffer; mime: string; hint: string; signal: AbortSignal;
  purpose?: Purpose;
};

/**
 * Why a provider is called: "artwork" (an upload), "extra" (the second check for new artists, lib/moderation
 * IMAGE_MODERATION_EXTRA: Sightengine gore, hate symbols and AI-generated) or "verification" (a photo of the artist:
 * Sightengine faces and AI-generated only).
 */
export type Purpose = "artwork" | "extra" | "verification";

/** What a check can tell: nudity/explicit, gore, hate symbols, AI-generated, faces, copies online. */
export type Coverage = "nudity" | "gore" | "hate" | "ai" | "faces" | "web";

export type Env = Record<string, string | undefined>;

export type Outcome = "clean" | "labeled" | "review" | "error" | "off";

/** What lib/moderation/policy.ts decides for one upload. */
export type Decision = {
  outcome: Outcome;
  /** Why it was held, most serious first ("sexual", "gore", "hate", "photo_of_person", "text_overlay"). */
  reasons: string[];
  /** "auto_moderation:<reason>" when held for review. */
  flaggedReason: string | null;
  /** The artwork's labels after the check: the artist's own, plus any the check added. */
  labels: string[];
  /** Labels the check added (not chosen by the artist). */
  addedLabels: string[];
  /** Shown to the artist in the upload result. */
  notice: string | null;
};

/** The stored record (AdminAction "artwork.auto_check" details), shown on the moderation card. */
export type AutoCheckRecord = {
  provider: ProviderId;
  outcome: Outcome;
  scores: Scores;
  reasons: string[];
  addedLabels: string[];
  artistLabels: string[];
  ms: number;
  error?: string;
  at: string;
  /** What the checks that ran could tell (lib/moderation providerCoverage). Missing on records from before tiers. */
  coverage?: Coverage[];
  /** The extra check for new artists (IMAGE_MODERATION_EXTRA), when it ran. */
  extra?: { provider: ProviderId; ok: boolean; error?: string; ms: number };
  /** Sightengine operations this check used (for the free-tier count on /admin/settings/auto-approval). */
  sightengineOps?: number;
};
