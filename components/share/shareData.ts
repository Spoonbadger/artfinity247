// Share kit: data shared by the Studio page, the image route and the embed widget.
// Works on the server and in the browser (no Node or DOM imports).
import { basePrices } from "@/lib/artwork_price";
import { artPath } from "@/lib/urls";

export type ShareArt = {
  slug: string;
  title: string;
  artist: string;
  handle: string;
  city: string | null;
  description: string;
  imageUrl: string;
  fromCents: number; // smallest print, list price
  editionSize: number | null;
  sensitive: string[];
  /** Prints sold, for the Share kit's "Best selling" sort. */
  sold?: number;
};

export type ImageFormat = "story" | "square" | "landscape";
export type ImageLayout = "wall" | "bleed" | "studio";

export const IMAGE_FORMATS: Record<ImageFormat, { name: string; sub: string; w: number; h: number }> = {
  story: { name: "Story", sub: "1080 × 1920", w: 1080, h: 1920 },
  square: { name: "Post", sub: "1080 × 1080", w: 1080, h: 1080 },
  landscape: { name: "Link preview", sub: "1200 × 630", w: 1200, h: 630 },
};
export const IMAGE_LAYOUTS: Record<ImageLayout, { name: string; sub: string }> = {
  wall: { name: "Gallery wall", sub: "Light and calm" },
  bleed: { name: "Night show", sub: "Dark, the painting glows" },
  studio: { name: "Studio table", sub: "Taped up, with its palette" },
};
export const isFormat = (v: unknown): v is ImageFormat => typeof v === "string" && v in IMAGE_FORMATS;
export const isLayout = (v: unknown): v is ImageLayout => typeof v === "string" && v in IMAGE_LAYOUTS;

export const CHANNELS = [
  { key: "instagram", name: "Instagram", dab: "#c13584" },
  { key: "tiktok", name: "TikTok", dab: "#15161b" },
  { key: "facebook", name: "Facebook", dab: "#1877f2" },
  { key: "pinterest", name: "Pinterest", dab: "#e60023" },
  { key: "email", name: "Email", dab: "#0f7a55" },
] as const;
export type Channel = (typeof CHANNELS)[number]["key"];

export const fromCents = (markupSmall: number | null | undefined) => basePrices.small + (markupSmall || 0);
export const dollars = (cents: number) => "$" + (cents / 100).toFixed(2);
export const priceLine = (a: Pick<ShareArt, "fromCents">) => `Prints from ${dollars(a.fromCents)}`;
export const editionLine = (a: Pick<ShareArt, "editionSize">) => (a.editionSize ? `Limited edition of ${a.editionSize}` : null);

/** The artwork page (/@handle/art/<slug>), tagged with where the visit came from. */
export function artLink(base: string, handle: string, slug: string, src?: string) {
  const u = new URL(artPath(handle, slug), base);
  if (src) u.searchParams.set("src", src);
  return u.toString();
}

/** What people read on a card: theartfinity.com/@handle. Local hosts show the real domain. */
export function displayHost(base: string) {
  try {
    const h = new URL(base).host.replace(/^www\./, "");
    return /^(localhost|127\.|0\.0\.0\.0)/.test(h) ? "theartfinity.com" : h;
  } catch {
    return "theartfinity.com";
  }
}
export const handleText = (base: string, handle: string) => `${displayHost(base)}/@${handle}`;

// ---------------- captions and hashtags ----------------
const STOP = new Set("a an the of in on at to and or by for with from late early my our your this that is it 6pm 7pm 5pm am pm road no".split(" "));
const MEDIUMS: [RegExp, string][] = [
  [/\boil\b/i, "oilpainting"], [/acrylic/i, "acrylicpainting"], [/watercolou?r/i, "watercolor"], [/gouache/i, "gouache"],
  [/pastel/i, "pastelart"], [/ink\b/i, "inkdrawing"], [/charcoal/i, "charcoaldrawing"], [/photo/i, "photography"],
  [/digital/i, "digitalart"], [/collage/i, "collage"], [/print(making)?\b/i, "printmaking"],
];
const tag = (s: string) => s.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();

export function hashtags(a: Pick<ShareArt, "title" | "description" | "city">, max = 5): string[] {
  const out: string[] = [];
  const add = (t: string) => { const v = tag(t); if (v.length > 2 && !out.includes(v)) out.push(v); };
  if (a.city) add(a.city);
  // Two-word places read better joined: "East River" -> #eastriver
  const words = a.title.split(/[\s,.:;!?()"'/-]+/).filter((w) => w && !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w));
  if (words.length >= 2 && words.slice(0, 2).every((w) => /^[A-Z]/.test(w))) add(words[0] + words[1]);
  else if (words[0]) add(words[0]);
  const medium = MEDIUMS.find(([re]) => re.test(a.description))?.[1];
  add(medium || "painting");
  add("artprint");
  if (a.city) add(a.city + "art");
  add("supportartists");
  return out.slice(0, max).map((t) => "#" + t);
}

export function captions(a: ShareArt, link: string): string[] {
  const tags = hashtags(a).join(" ");
  const ed = a.editionSize ? ` Limited to ${a.editionSize} prints.` : "";
  const place = a.city ? `Painted in ${a.city}.` : "Painted by hand.";
  return [
    `${a.title}. Prints from ${dollars(a.fromCents)}, made to order.${ed}\n${link}\n\n${tags}`,
    `New painting: ${a.title}. Want it on your wall? Tap the link for a print.\n${link}\n\n${tags}`,
    `${place} Now a print you can hang at home.${ed} Free US shipping.\n${link}\n\n${tags}`,
  ];
}

// ---------------- color ----------------
/** A few distinct colors from tiny RGBA pixel data (e.g. the painting at 8×8). */
export function paletteFromPixels(data: ArrayLike<number>, n = 5): string[] {
  const px: [number, number, number][] = [];
  for (let i = 0; i + 3 < data.length; i += 4) if (data[i + 3] > 128) px.push([data[i], data[i + 1], data[i + 2]]);
  if (!px.length) return ["#8b2a4b", "#ffd43b", "#ff5a36", "#0f7a55", "#15161b"];
  const sat = (c: number[]) => Math.max(...c) - Math.min(...c);
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // Greedy: start with the most saturated, then keep adding the color farthest from those picked.
  const picked: [number, number, number][] = [px.slice().sort((a, b) => sat(b) - sat(a))[0]];
  while (picked.length < n) {
    let best = px[0], bd = -1;
    for (const p of px) { const d = Math.min(...picked.map((q) => dist(p, q))) + sat(p) * 0.15; if (d > bd) { bd = d; best = p; } }
    if (bd < 12) break;
    picked.push(best);
  }
  return picked.map((c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""));
}

export function luminance(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** The most painterly accent: saturated and not too dark or light. */
export function accentOf(palette: string[]) {
  const score = (hex: string) => {
    const h = hex.replace("#", "");
    const c = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
    const l = luminance(hex);
    return Math.max(...c) - Math.min(...c) - Math.abs(l - 0.5) * 120;
  };
  return palette.slice().sort((a, b) => score(b) - score(a))[0] || "#8b2a4b";
}
