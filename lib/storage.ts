// Upload storage (server-only). Artwork originals stay private and are used for printing; everything public
// gets a preview (long edge 1600px, JPEG, no EXIF/GPS).
// Cloudinary (when CLOUDINARY_* are set): the preview is a public "upload" asset and the original an
// "authenticated" asset with the same public_id, so it can only be fetched with a signed URL.
// Local files: the preview goes to public/uploads/<folder>/<name>.jpg and the original to
// storage/originals/<folder>/<name>.<ext> (ORIGINALS_DIR overrides the folder). Neither needs a DB column.
import fs from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

export const PREVIEW_EDGE = 1600;
const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "uploads");
const ORIGINALS_DIR = path.resolve(process.cwd(), process.env.ORIGINALS_DIR || "storage/originals");
// Preview URLs this code writes locally: /uploads/<folder...>/<name>.jpg
const LOCAL_RE = /^\/uploads\/((?:[\w-]+\/)*[\w-]+)\/([\w-]+)\.jpg$/;

export const cloudinaryOn = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const cloud = async () => (await import("@/lib/cloudinary")).default;

/** Upright, long edge <= 1600px, white behind transparency, sRGB JPEG. sharp drops EXIF/GPS unless asked to keep it. */
export function makePreview(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: PREVIEW_EDGE, height: PREVIEW_EDGE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}

const EXT: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp", tiff: "tif", gif: "gif", heif: "heic", avif: "avif" };
function extFor(format: string | undefined, fileName?: string) {
  if (format && EXT[format]) return EXT[format];
  const e = (fileName || "").split(".").pop()?.toLowerCase() || "";
  return /^[a-z0-9]{2,5}$/.test(e) ? e : "bin";
}

export class UnreadableImage extends Error {}

type Saved = { url: string; width: number; height: number };

/**
 * Stores an upload and returns its public preview URL. width/height are the original's (print sizes use them).
 * keepOriginal stores the untouched file privately too (artwork uploads).
 */
export async function saveUpload(
  buf: Buffer,
  opts: { folder: string; cloudFolder: string; keepOriginal: boolean; fileName?: string },
): Promise<Saved> {
  let width = 0, height = 0, format: string | undefined;
  try {
    const m = await sharp(buf).metadata();
    // EXIF orientation 5-8: stored sideways, so swap to the upright size.
    [width, height] = (m.orientation || 0) >= 5 ? [m.height || 0, m.width || 0] : [m.width || 0, m.height || 0];
    format = m.format;
  } catch {}
  let preview: Buffer | null = null;
  try { preview = await makePreview(buf); } catch {}
  const name = crypto.randomBytes(6).toString("hex");

  if (!cloudinaryOn()) {
    if (!preview) throw new UnreadableImage();
    const dir = path.join(PUBLIC_UPLOADS, ...opts.folder.split("/"));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${name}.jpg`), preview);
    if (opts.keepOriginal) {
      const odir = path.join(ORIGINALS_DIR, ...opts.folder.split("/"));
      await fs.mkdir(odir, { recursive: true });
      await fs.writeFile(path.join(odir, `${name}.${extFor(format, opts.fileName)}`), buf);
    }
    return { url: `/uploads/${opts.folder}/${name}.jpg`, width, height };
  }

  const cloudinary = await cloud();
  const publicId = `${opts.cloudFolder}/${name}`;
  const put = (data: Buffer, o: Record<string, unknown>): Promise<any> =>
    new Promise((resolve, reject) =>
      cloudinary.uploader.upload_stream({ public_id: publicId, resource_type: "image", ...o }, (err, r) => (err ? reject(err) : resolve(r))).end(data),
    );
  // Cloudinary reads some files sharp can't (e.g. HEIC): keep the file privately, then build the preview from it.
  const privateCopy = opts.keepOriginal || !preview;
  if (privateCopy) {
    const r = await put(buf, { type: "authenticated" });
    if (!width && r.width) { width = r.width; height = r.height; }
    if (!preview) {
      const src = cloudinary.url(publicId, {
        type: "authenticated", sign_url: true, secure: true, format: "jpg",
        transformation: [{ crop: "limit", width: PREVIEW_EDGE, height: PREVIEW_EDGE }],
      });
      const res = await fetch(src);
      if (res.ok) preview = await makePreview(Buffer.from(await res.arrayBuffer())).catch(() => null);
    }
    if (!opts.keepOriginal) await cloudinary.uploader.destroy(publicId, { type: "authenticated", invalidate: true }).catch(() => {});
  }
  if (!preview) throw new UnreadableImage();
  const r = await put(preview, { type: "upload", overwrite: true, format: "jpg" });
  return { url: r.secure_url, width, height };
}

/** Cloudinary public_id from a delivery URL (drops transformations and the version). */
export function cloudPublicId(url: string): string | null {
  if (!url.includes("res.cloudinary.com")) return null;
  const after = url.split("?")[0].split("/upload/")[1];
  if (!after) return null;
  const parts = after.split("/");
  while (parts.length > 1 && (parts[0].includes(",") || /^[a-z]{1,3}_/.test(parts[0]) || /^v\d+$/.test(parts[0]))) parts.shift();
  return decodeURIComponent(parts.join("/")).replace(/\.[^/.]+$/, "");
}

/** Local original for a preview URL, if one was kept. */
async function localOriginal(previewUrl: string): Promise<string | null> {
  const m = LOCAL_RE.exec(previewUrl);
  if (!m) return null;
  const dir = path.join(ORIGINALS_DIR, ...m[1].split("/"));
  if (!dir.startsWith(ORIGINALS_DIR + path.sep)) return null;
  const hit = (await fs.readdir(dir).catch(() => [] as string[])).find((f) => f.startsWith(`${m[2]}.`));
  return hit ? path.join(dir, hit) : null;
}

/** Short-lived signed download link for a Cloudinary original, if one was kept. */
async function cloudOriginal(previewUrl: string, fileName: string): Promise<string | null> {
  const id = cloudinaryOn() ? cloudPublicId(previewUrl) : null;
  if (!id) return null;
  const cloudinary = await cloud();
  const r: any = await cloudinary.api.resource(id, { type: "authenticated" }).catch(() => null);
  if (!r) return null;
  return cloudinary.utils.private_download_url(id, r.format, {
    type: "authenticated", attachment: `${fileName}.${r.format}`, expires_at: Math.floor(Date.now() / 1000) + 300,
  } as any);
}

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", tif: "image/tiff", tiff: "image/tiff", gif: "image/gif", heic: "image/heic", avif: "image/avif" };

/**
 * Download response for the original behind a preview URL. Older uploads and demo images have no private
 * original; then it falls back to the public file (the best there is).
 */
export async function originalResponse(previewUrl: string, baseName: string): Promise<Response> {
  const fileName = baseName.replace(/[^\w-]+/g, "-").slice(0, 80) || "original";
  const file = await localOriginal(previewUrl);
  if (file) {
    const ext = path.extname(file).slice(1).toLowerCase();
    const size = (await fs.stat(file)).size;
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Content-Length": String(size),
        "Content-Disposition": `attachment; filename="${fileName}-original.${ext}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  }
  const signed = await cloudOriginal(previewUrl, `${fileName}-original`);
  const to = signed || (previewUrl.includes("res.cloudinary.com") ? previewUrl.replace(/\/upload\/(f_auto,q_auto\/)?/, "/upload/fl_attachment/") : previewUrl);
  const headers: Record<string, string> = { Location: to, "Cache-Control": "private, no-store" };
  if (!signed) headers["X-Original"] = "missing";
  return new Response(null, { status: 302, headers });
}

/** Removes a preview and its private original (e.g. after the artist replaces the image). */
export async function deleteUpload(previewUrl: string): Promise<void> {
  if (LOCAL_RE.test(previewUrl)) {
    const orig = await localOriginal(previewUrl);
    if (orig) await fs.unlink(orig).catch(() => {});
    await fs.unlink(path.join(process.cwd(), "public", ...previewUrl.split("/").filter(Boolean))).catch(() => {});
    return;
  }
  const id = cloudinaryOn() ? cloudPublicId(previewUrl) : null;
  if (!id) return;
  const cloudinary = await cloud();
  for (const type of ["upload", "authenticated"]) await cloudinary.uploader.destroy(id, { type, invalidate: true }).catch(() => {});
}
