// Shared model for the link-in-bio page (/@handle/links): link kinds, theme, validation.
// Pure module: safe to import from server routes and client components.
import { z } from "zod";

/* ---------------- Link kinds ---------------- */

export const SOCIAL_KINDS = ["instagram", "tiktok", "youtube", "facebook", "x", "pinterest", "threads", "website", "email"] as const;
export type SocialKind = (typeof SOCIAL_KINDS)[number];
export type LinkKind = SocialKind | "custom";

export const KIND_LABEL: Record<LinkKind, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
  pinterest: "Pinterest",
  threads: "Threads",
  website: "Website",
  email: "Email",
  custom: "Link",
};

/** Quick-add prefixes: type a handle, get a URL. */
export const SOCIAL_PREFIX: Partial<Record<SocialKind, string>> = {
  instagram: "https://instagram.com/",
  tiktok: "https://tiktok.com/@",
  youtube: "https://youtube.com/@",
  facebook: "https://facebook.com/",
  x: "https://x.com/",
  pinterest: "https://pinterest.com/",
  threads: "https://threads.net/@",
};

export function isSocialKind(k: string): k is SocialKind {
  return (SOCIAL_KINDS as readonly string[]).includes(k);
}

export type LinkRow = {
  id: string;
  kind: string;
  label: string | null;
  url: string;
  position: number;
  active: boolean;
  clicks: number;
};

/** Guess the icon from a URL. Returns null for an ordinary web link. */
export function detectKind(url: string): SocialKind | null {
  const u = url.trim().toLowerCase();
  if (u.startsWith("mailto:")) return "email";
  let host = "";
  try {
    host = new URL(u).hostname.replace(/^www\.|^m\./, "");
  } catch {
    return null;
  }
  const is = (...d: string[]) => d.some((x) => host === x || host.endsWith("." + x));
  if (is("instagram.com", "instagr.am")) return "instagram";
  if (is("tiktok.com")) return "tiktok";
  if (is("youtube.com", "youtu.be")) return "youtube";
  if (is("facebook.com", "fb.com", "fb.me")) return "facebook";
  if (is("x.com", "twitter.com")) return "x";
  if (is("pinterest.com", "pin.it") || /(^|\.)pinterest\.[a-z.]+$/.test(host)) return "pinterest";
  if (is("threads.net", "threads.com")) return "threads";
  return null;
}

/** Icon to draw for any link: its kind if social, else whatever the URL looks like. */
export function iconFor(link: { kind: string; url: string }): LinkKind {
  if (isSocialKind(link.kind)) return link.kind;
  return detectKind(link.url) ?? "custom";
}

/**
 * Tidy what someone typed into a URL we can store, or return an error.
 * Accepts http(s) and mailto only. "maya@x.com" becomes mailto:, "maya.art" becomes https://maya.art.
 */
export function normalizeUrl(input: string): { url: string } | { error: string } {
  let s = (input || "").trim();
  if (!s) return { error: "Add a link." };
  if (s.length > 500) return { error: "That link is too long." };
  if (/^[^\s@/:]+@[^\s@/]+\.[a-z]{2,}$/i.test(s)) s = "mailto:" + s;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { error: "That link doesn't look right." };
  }
  if (u.protocol === "mailto:") {
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(decodeURIComponent(u.pathname))) return { error: "That email doesn't look right." };
    return { url: u.toString() };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { error: "Links must start with http, https or mailto." };
  if (!u.hostname.includes(".") && u.hostname !== "localhost") return { error: "That link doesn't look right." };
  if (u.username || u.password) return { error: "That link doesn't look right." };
  return { url: u.toString() };
}

/** Short readable form of a URL for lists: "instagram.com/maya". */
export function prettyUrl(url: string) {
  if (url.startsWith("mailto:")) return url.slice(7);
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

export const MAX_LINKS = 30;

export const linkInput = z.object({
  url: z.string().max(600),
  label: z.string().trim().max(60).nullish(),
  /** "icon" shows it in the social row; "button" makes it a big button. */
  display: z.enum(["icon", "button"]).optional(),
  kind: z.string().max(20).optional(),
  active: z.boolean().optional(),
});

/** Decide the stored kind from what the editor sent. */
export function resolveKind(url: string, display?: "icon" | "button", kind?: string): LinkKind {
  if (display === "button") return "custom";
  if (kind && (isSocialKind(kind) || kind === "custom")) {
    if (display === "icon" && kind === "custom") return detectKind(url) ?? "website";
    return kind as LinkKind;
  }
  const detected = detectKind(url);
  if (display === "icon") return detected ?? "website";
  return detected ?? "custom";
}

/* ---------------- Theme ---------------- */

export const BUTTON_STYLES = [
  { id: "pill", label: "Pill" },
  { id: "rounded", label: "Square" },
  { id: "brush", label: "Brush" },
  { id: "outline", label: "Outline" },
] as const;

export const BACKGROUNDS = [
  { id: "painting", label: "Painting" },
  { id: "blur", label: "Blurred" },
  { id: "wash", label: "Color wash" },
] as const;

export const FONTS = [
  { id: "gallery", label: "Gallery", display: "Bricolage", body: "Instrument Sans" },
  { id: "classic", label: "Classic", display: "Fraunces", body: "Instrument Sans" },
  { id: "painted", label: "Painted", display: "Caveat Brush", body: "Instrument Sans" },
  { id: "editorial", label: "Editorial", display: "DM Serif", body: "DM Sans" },
] as const;

/** Paint palette for the color pickers. */
export const PAINTS = [
  { name: "Titanium white", hex: "#ffffff" },
  { name: "Ivory black", hex: "#15161b" },
  { name: "Cadmium yellow", hex: "#ffd43b" },
  { name: "Ultramarine", hex: "#2b37f0" },
  { name: "Vermilion", hex: "#ff5a36" },
  { name: "Burnt orange", hex: "#e8743b" },
  { name: "Viridian", hex: "#2f7d6d" },
  { name: "Turquoise", hex: "#5bc0be" },
  { name: "Alizarin", hex: "#a4243b" },
  { name: "Raw umber", hex: "#6b4f3a" },
  { name: "Rose madder", hex: "#f2b8c6" },
  { name: "Dioxazine", hex: "#4b2a7b" },
] as const;

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a color like #2b37f0.").transform((s) => s.toLowerCase());

export const themeSchema = z.object({
  bgArtworkId: z.string().max(40).nullable().default(null),
  bg: z.enum(["painting", "blur", "wash"]).default("painting"),
  scrim: z.enum(["none", "soft", "strong"]).default("soft"),
  washColor: hex.default("#2f7d6d"),
  button: z.enum(["pill", "rounded", "brush", "outline"]).default("pill"),
  buttonColor: hex.default("#ffffff"),
  textColor: hex.default("#15161b"),
  font: z.enum(["gallery", "classic", "painted", "editorial"]).default("gallery"),
  showShop: z.boolean().default(true),
});

export type LinksTheme = z.infer<typeof themeSchema>;

export const DEFAULT_THEME: LinksTheme = themeSchema.parse({});

/** Read whatever is stored in Artist.linksTheme, falling back field by field to defaults. */
export function readTheme(raw: unknown): LinksTheme {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_THEME } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_THEME)) {
    const one = themeSchema.shape[key as keyof LinksTheme].safeParse(src[key]);
    if (one.success && src[key] !== undefined) out[key] = one.data;
  }
  return out as LinksTheme;
}

/* ---------------- Color helpers ---------------- */

function lum(hexColor: string) {
  const n = parseInt(hexColor.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function isLight(hexColor: string) {
  return lum(hexColor) > 0.4;
}

/* ---------------- Public page data ---------------- */

export type LinksArt = { id: string; slug: string | null; title: string; imageUrl: string; sensitive: string[] };

export type LinksPageData = {
  slug: string;
  name: string;
  bio: string;
  city: string;
  avatar: string | null;
  printsSold: number;
  verified: boolean;
  links: { id: string; kind: string; label: string | null; url: string }[];
  /** Newest pieces for the shop tiles (safe ones first). */
  tiles: LinksArt[];
  background: LinksArt | null;
  theme: LinksTheme;
};
