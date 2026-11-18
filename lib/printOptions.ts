// Print codes (/studio/print): the card sizes and papers people pick from. Client-safe; shared by the screen's
// preview and the PDF route, so both pack the same boxes on the same paper (lib/printPack.ts).
import { FORMATS, TEMPLATES, customName, type CustomSize, type FormatKey, type TemplateKey } from "@/components/qr/card";
import type { PackItem, PaperSize } from "@/lib/printPack";

/** A card size: one of the four formats, or the code's own custom size (Infinity). */
export type SizeKey = FormatKey | "custom";
export const SIZE_ORDER: FormatKey[] = ["label", "sticker", "tag", "poster"];
export const SIZE_NAME: Record<FormatKey, string> = { label: "Label", sticker: "Sticker", tag: "Tag", poster: "Poster" };
export const isSize = (v: unknown): v is SizeKey => v === "custom" || (typeof v === "string" && v in FORMATS);

/** Most copies of one card on one line. */
export const MAX_COPIES = 100;
/** Most lines (piece + code + size) in one print. */
export const MAX_LINES = 200;
export const clampCopies = (v: unknown, d = 1) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_COPIES, n)) : d;
};

/** The box a card takes on paper, in inches. custom: the code's saved custom size (needed for size "custom"). */
export function cardBox(size: SizeKey, custom: CustomSize | null): Omit<PackItem<never>, "ref"> | null {
  if (size === "custom") {
    if (!custom) return null;
    return { w: custom.w, h: custom.h, round: custom.shape === "round" };
  }
  const F = FORMATS[size];
  return { w: F.w, h: F.h, round: size === "sticker", page: size === "poster" };
}

export const sizeLabel = (size: SizeKey, custom: CustomSize | null) => (size === "custom" ? (custom ? customName(custom) : "Custom size") : SIZE_NAME[size]);

// ---------------- papers ----------------
export type PlainPaper = "letter" | "a4" | "legal" | "tabloid";
export type PaperKey = PlainPaper | "custom" | TemplateKey;
export const PLAIN_PAPERS: Record<PlainPaper, { name: string; sub: string; w: number; h: number }> = {
  letter: { name: "Letter", sub: "8.5 × 11 in", w: 8.5, h: 11 },
  a4: { name: "A4", sub: "210 × 297 mm", w: 8.27, h: 11.69 },
  legal: { name: "Legal", sub: "8.5 × 14 in", w: 8.5, h: 14 },
  tabloid: { name: "Tabloid", sub: "11 × 17 in", w: 11, h: 17 },
};
export const PAPER_ORDER: PaperKey[] = ["letter", "a4", "legal", "tabloid", "custom", ...(Object.keys(TEMPLATES) as TemplateKey[])];
/** Custom paper, inches. */
export const PAPER_MIN = 3, PAPER_MAX = 19;
export type CustomPaper = { w: number; h: number };

export const isPaper = (v: unknown): v is PaperKey => typeof v === "string" && (v in PLAIN_PAPERS || v === "custom" || v in TEMPLATES);

export function cleanCustomPaper(v: unknown): CustomPaper {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const num = (x: unknown, d: number) => { const n = Number(x); return Number.isFinite(n) ? Math.round(Math.max(PAPER_MIN, Math.min(PAPER_MAX, n)) * 100) / 100 : d; };
  return { w: num(o.w, 8.5), h: num(o.h, 11) };
}

/** The paper to pack on. Avery sheets are US Letter with their labels' fixed slots, centred like the printed sheet. */
export function paperSize(key: PaperKey, custom?: CustomPaper | null): PaperSize {
  if (key === "custom") return cleanCustomPaper(custom);
  if (key in PLAIN_PAPERS) { const P = PLAIN_PAPERS[key as PlainPaper]; return { w: P.w, h: P.h }; }
  const T = TEMPLATES[key as TemplateKey];
  const gw = T.cols * T.w + (T.cols - 1) * T.gx, gh = T.rows * T.h + (T.rows - 1) * T.gy;
  const x0 = (8.5 - gw) / 2, y0 = (11 - gh) / 2;
  const at: { x: number; y: number }[] = [];
  for (let r = 0; r < T.rows; r++) for (let c = 0; c < T.cols; c++) at.push({ x: x0 + c * (T.w + T.gx), y: y0 + r * (T.h + T.gy) });
  return { w: 8.5, h: 11, slots: { w: T.w, h: T.h, at } };
}

export function paperName(key: PaperKey, custom?: CustomPaper | null) {
  if (key === "custom") { const c = cleanCustomPaper(custom); return `${c.w} × ${c.h} in`; }
  if (key in PLAIN_PAPERS) { const P = PLAIN_PAPERS[key as PlainPaper]; return `${P.name}, ${P.sub}`; }
  return TEMPLATES[key as TemplateKey].name;
}

/** A label sheet only takes cards of its own size. */
export const isLabelSheet = (key: PaperKey) => key in TEMPLATES;
