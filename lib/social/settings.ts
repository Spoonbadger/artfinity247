// Settings for Artfinity's own social posting (/admin/social). Saved with the other admin settings
// (lib/adminSettings.ts: a snapshot row in the database, so it works on Vercel). Server only.
import { readAdminSettings, writeAdminSettings } from "@/lib/adminSettings";
import { FREE_PRESETS, PRESET_IDS, isFormat, isPreset, type PresetId, type VideoFormat } from "@/lib/social/presets";

export type SocialSettings = {
  /** Post approved items to Instagram on schedule (needs the keys; without them the queue is manual). */
  enabled: boolean;
  /** When an artist's new art is approved, add a draft post for it. */
  autoQueue: boolean;
  /** Art approved after this moment is auto-queued (set when auto-queue is turned on, so old art isn't backfilled). */
  autoQueueSince: string | null;
  /** Presets new drafts use, in rotation. */
  presets: PresetId[];
  format: VideoFormat;
  captionTemplate: string;
  hashtags: string;
  maxPerDay: number;
  /** Posting times, New York, "HH:MM", earliest first. */
  times: string[];
};

export const CAPTION_FIELDS = ["{title}", "{artist}", "{handle}", "{price}", "{link}"] as const;

export const DEFAULT_SOCIAL: SocialSettings = {
  enabled: false,
  autoQueue: true,
  autoQueueSince: null,
  presets: [...FREE_PRESETS],
  format: "vertical",
  captionTemplate: "{title} by {handle}, painted in New York. Prints from {price}, made to order.\nTap the link in our bio or scan the code next to the painting: {link}",
  hashtags: "#nycart #nycartist #artprint #supportartists #artfinity",
  maxPerDay: 1,
  times: ["12:00"],
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Cleans anything (a stored snapshot, a request body) into valid settings. */
export function normalizeSocial(raw: unknown, base: SocialSettings = DEFAULT_SOCIAL): SocialSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const presets = Array.isArray(r.presets) ? (r.presets.filter(isPreset) as PresetId[]) : base.presets;
  const times = Array.isArray(r.times) ? Array.from(new Set(r.times.map(String).filter((t) => TIME_RE.test(t)))).sort() : base.times;
  const max = Number(r.maxPerDay);
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : base.enabled,
    autoQueue: typeof r.autoQueue === "boolean" ? r.autoQueue : base.autoQueue,
    autoQueueSince: typeof r.autoQueueSince === "string" && !Number.isNaN(Date.parse(r.autoQueueSince)) ? r.autoQueueSince : base.autoQueueSince,
    presets: presets.length ? presets : base.presets.length ? base.presets : [...PRESET_IDS.slice(0, 3)],
    format: isFormat(r.format) ? r.format : base.format,
    captionTemplate: typeof r.captionTemplate === "string" ? r.captionTemplate.slice(0, 1500) : base.captionTemplate,
    hashtags: typeof r.hashtags === "string" ? r.hashtags.replace(/\s+/g, " ").trim().slice(0, 500) : base.hashtags,
    maxPerDay: Number.isInteger(max) && max >= 1 && max <= 5 ? max : base.maxPerDay,
    times: times.length ? times.slice(0, 5) : base.times,
  };
}

export async function readSocialSettings(): Promise<SocialSettings> {
  const all = (await readAdminSettings()) as { social?: unknown };
  return normalizeSocial(all.social);
}

export async function writeSocialSettings(patch: Partial<SocialSettings>, by: { id: string; email?: string }) {
  const current = await readSocialSettings();
  const next = normalizeSocial({ ...current, ...patch }, current);
  // Turning auto-queue on starts from now: art approved before today isn't queued in bulk.
  if (next.autoQueue && (!current.autoQueue || !current.autoQueueSince)) next.autoQueueSince = new Date().toISOString();
  await writeAdminSettings({ social: next }, by);
  return next;
}
