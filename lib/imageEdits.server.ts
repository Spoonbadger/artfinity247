// Applies photo edits (lib/imageEdits.ts) to a full-resolution original. Server-only.
// Quarter turns and plain crops use sharp directly (no resampling). Straighten and "Fix angle" fold into one
// projective map, inverse-sampled once from the original with bilinear filtering on raw pixels (sharp has no
// perspective transform; same approach as lib/scenes/composite.ts).
import sharp from "sharp";
import { editPlan, isIdentity, parseStored, warp, type ImageEdits, type StoredEdits } from "@/lib/imageEdits";
import { inArtistFolder } from "@/lib/storage";

/** Largest output we'll write (long edge), so a bad request can't ask for a gigapixel image. */
const MAX_EDGE = 16000;

/** Encodes print masters: high-quality JPEG, no chroma subsampling, sRGB. */
const master = (img: sharp.Sharp) => img.jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true });

/** Upright W×H of an image file (EXIF orientation applied). */
export async function uprightSize(buf: Buffer) {
  const m = await sharp(buf, { failOn: "none" }).metadata();
  const sideways = (m.orientation || 0) >= 5;
  return { w: (sideways ? m.height : m.width) || 0, h: (sideways ? m.width : m.height) || 0 };
}

/** The edited image as a full-resolution JPEG, plus its size. Throws on unreadable input. */
export async function applyEdits(buf: Buffer, e: ImageEdits): Promise<{ data: Buffer; width: number; height: number }> {
  const { w: W, h: H } = await uprightSize(buf);
  if (!W || !H) throw new Error("unreadable");
  if (isIdentity(e)) {
    const data = await master(sharp(buf, { failOn: "none" }).rotate().flatten({ background: "#ffffff" })).toBuffer();
    return { data, width: W, height: H };
  }
  const plan = editPlan(W, H, e);
  if (Math.max(plan.outW, plan.outH) > MAX_EDGE) throw new Error("too_big");

  // Only turns and a crop: exact, straight from sharp.
  if (!e.corners && Math.abs(e.angle) < 0.01) {
    // sharp takes one rotation per pipeline: EXIF first (to raw, no re-encode), then the quarter turn.
    const up = await sharp(buf, { failOn: "none" }).rotate().flatten({ background: "#ffffff" }).removeAlpha().toColorspace("srgb").raw().toBuffer({ resolveWithObject: true });
    let img = sharp(up.data, { raw: { width: up.info.width, height: up.info.height, channels: up.info.channels as 3 } }).rotate(e.rotate);
    const cw = plan.stages.C.w, ch = plan.stages.C.h;
    const c = e.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const left = Math.min(Math.round(c.x * cw), cw - 1), top = Math.min(Math.round(c.y * ch), ch - 1);
    const width = Math.max(1, Math.min(plan.outW, cw - left)), height = Math.max(1, Math.min(plan.outH, ch - top));
    img = img.extract({ left, top, width, height });
    const data = await master(img).toBuffer();
    return { data, width, height };
  }

  const src = await sharp(buf, { failOn: "none" }).rotate().flatten({ background: "#ffffff" }).removeAlpha().toColorspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const out = warp(new Uint8Array(src.data.buffer, src.data.byteOffset, src.data.length), src.info.width, src.info.height, src.info.channels, plan.M, plan.outW, plan.outH);
  const data = await master(sharp(Buffer.from(out.buffer, out.byteOffset, out.length), { raw: { width: plan.outW, height: plan.outH, channels: src.info.channels as 3 } })).toBuffer();
  return { data, width: plan.outW, height: plan.outH };
}

/**
 * The `imageEdits` field the artwork routes receive (artworkFields.tsx artworkFormData).
 * undefined = field left out, null = clear, else stored edits whose source is the artist's own upload or in `known`.
 */
export function editsFromForm(raw: FormDataEntryValue | null, user: { id: string; slug?: string | null }, known: (string | null | undefined)[] = []): StoredEdits | null | undefined {
  if (raw === null) return undefined;
  const text = String(raw).trim();
  if (!text) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return undefined; }
  const e = parseStored(parsed);
  if (!e) return undefined;
  return inArtistFolder(e.source, user) || known.includes(e.source) ? e : undefined;
}
