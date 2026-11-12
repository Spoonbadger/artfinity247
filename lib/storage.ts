// Upload storage (server-only). Artwork originals stay private and are used for printing; everything public
// gets a preview (long edge 1600px, JPEG, no EXIF/GPS).
// Cloudinary (when CLOUDINARY_* are set): the preview is a public "upload" asset and the original an
// "authenticated" asset with the same public_id, so it can only be fetched with a signed URL.
// Browser uploads put the original there directly (POST /api/uploads/sign + /finish, since Vercel caps request
// bodies at 4.5 MB) and finishCloudUpload adds the preview. Server-side uploads (imports, photo edits, scans) use saveUpload.
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

/** Upright size and format of an image sharp can read (zeros when it can't, e.g. some HEIC files). */
async function measure(buf: Buffer): Promise<{ width: number; height: number; format?: string }> {
  try {
    const m = await sharp(buf).metadata();
    // EXIF orientation 5-8: stored sideways, so swap to the upright size.
    const [width, height] = (m.orientation || 0) >= 5 ? [m.height || 0, m.width || 0] : [m.width || 0, m.height || 0];
    return { width, height, format: m.format };
  } catch {
    return { width: 0, height: 0 };
  }
}

type Cloud = Awaited<ReturnType<typeof cloud>>;

/** Cloudinary reads some files sharp can't (e.g. HEIC): a preview built from its JPEG of the private original. */
async function cloudPreviewOf(cloudinary: Cloud, publicId: string): Promise<Buffer | null> {
  const src = cloudinary.url(publicId, {
    type: "authenticated", sign_url: true, secure: true, format: "jpg",
    transformation: [{ crop: "limit", width: PREVIEW_EDGE, height: PREVIEW_EDGE }],
  });
  const res = await fetch(src).catch(() => null);
  return res?.ok ? makePreview(Buffer.from(await res.arrayBuffer())).catch(() => null) : null;
}

function cloudPut(cloudinary: Cloud, publicId: string, data: Buffer, o: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) =>
    cloudinary.uploader.upload_stream({ public_id: publicId, resource_type: "image", ...o }, (err, r) => (err ? reject(err) : resolve(r))).end(data),
  );
}

const dropPrivate = (cloudinary: Cloud, publicId: string) =>
  cloudinary.uploader.destroy(publicId, { type: "authenticated", invalidate: true }).catch(() => {});

/**
 * Stores an upload and returns its public preview URL. width/height are the original's (print sizes use them).
 * keepOriginal stores the untouched file privately too (artwork uploads).
 */
export async function saveUpload(
  buf: Buffer,
  opts: { folder: string; cloudFolder: string; keepOriginal: boolean; fileName?: string },
): Promise<Saved> {
  const measured = await measure(buf);
  let { width, height } = measured;
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
      await fs.writeFile(path.join(odir, `${name}.${extFor(measured.format, opts.fileName)}`), buf);
    }
    return { url: `/uploads/${opts.folder}/${name}.jpg`, width, height };
  }

  const cloudinary = await cloud();
  const publicId = `${opts.cloudFolder}/${name}`;
  // Cloudinary reads some files sharp can't (e.g. HEIC): keep the file privately, then build the preview from it.
  const privateCopy = opts.keepOriginal || !preview;
  if (privateCopy) {
    const r = await cloudPut(cloudinary, publicId, buf, { type: "authenticated" });
    if (!width && r.width) { width = r.width; height = r.height; }
    if (!preview) preview = await cloudPreviewOf(cloudinary, publicId);
    if (!opts.keepOriginal) await dropPrivate(cloudinary, publicId);
  }
  if (!preview) throw new UnreadableImage();
  const r = await cloudPut(cloudinary, publicId, preview, { type: "upload", overwrite: true, format: "jpg" });
  return { url: r.secure_url, width, height };
}

/**
 * Bytes of a private original the browser uploaded straight to Cloudinary (POST /api/uploads/sign, lib/directUpload.ts),
 * or null when there's no such asset. `format` is the one Cloudinary reported; the download fails if it's wrong.
 */
export async function readCloudUpload(publicId: string, format: string): Promise<Buffer | null> {
  const cloudinary = await cloud();
  const src = cloudinary.utils.private_download_url(publicId, format, { type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300 } as any);
  const res = await fetch(src).catch(() => null);
  return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

/** Removes a browser-uploaded private original we won't use (too big, unreadable). */
export async function dropCloudUpload(publicId: string): Promise<void> {
  await dropPrivate(await cloud(), publicId);
}

/**
 * saveUpload for a file that's already in Cloudinary as a private original at publicId (uploaded by the browser):
 * measures it, stores the public 1600px preview under the same public_id, and drops the original unless keepOriginal.
 * The original is never uploaded a second time. Throws UnreadableImage (and drops the original) when nothing can read it.
 */
export async function finishCloudUpload(publicId: string, buf: Buffer, keepOriginal: boolean): Promise<Saved> {
  const cloudinary = await cloud();
  let { width, height } = await measure(buf);
  let preview: Buffer | null = await makePreview(buf).catch(() => null);
  if (!preview) preview = await cloudPreviewOf(cloudinary, publicId);
  if (!width) {
    const r: any = await cloudinary.api.resource(publicId, { type: "authenticated" }).catch(() => null);
    if (r?.width) { width = r.width; height = r.height; }
  }
  if (!preview) {
    await dropPrivate(cloudinary, publicId);
    throw new UnreadableImage();
  }
  const r = await cloudPut(cloudinary, publicId, preview, { type: "upload", overwrite: true, format: "jpg" });
  if (!keepOriginal) await dropPrivate(cloudinary, publicId);
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

/**
 * Bytes of the image behind a preview URL, for fingerprinting (lib/imageHash.ts): the private local original when
 * one was kept, else the public file under public/ (/uploads, /seed), else a Cloudinary preview. Other hosts: null.
 */
export async function readStoredImage(previewUrl: string): Promise<Buffer | null> {
  const orig = await localOriginal(previewUrl);
  if (orig) return fs.readFile(orig);
  const clean = previewUrl.split("?")[0];
  if (/^\/(?:[\w.-]+\/)*[\w.-]+\.(?:jpe?g|png|webp|gif|avif|tiff?)$/i.test(clean) && !clean.includes("..")) {
    const pub = path.join(process.cwd(), "public");
    const file = path.join(pub, ...clean.split("/").filter(Boolean));
    if (file.startsWith(pub + path.sep)) return fs.readFile(file).catch(() => null);
    return null;
  }
  if (/^https:\/\/res\.cloudinary\.com\//.test(clean)) {
    const res = await fetch(previewUrl).catch(() => null);
    return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  return null;
}

/**
 * Full-resolution bytes behind a preview URL, for photo edits (lib/imageEdits.server.ts): the private original
 * (local file or Cloudinary authenticated asset) when one was kept, else the best public copy. `original` says which.
 */
export async function readOriginalImage(previewUrl: string): Promise<{ data: Buffer; original: boolean } | null> {
  const local = await localOriginal(previewUrl);
  if (local) return { data: await fs.readFile(local), original: true };
  const id = cloudinaryOn() ? cloudPublicId(previewUrl) : null;
  if (id) {
    const cloudinary = await cloud();
    const r: any = await cloudinary.api.resource(id, { type: "authenticated" }).catch(() => null);
    if (r) {
      const src = cloudinary.utils.private_download_url(id, r.format, { type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300 } as any);
      const res = await fetch(src).catch(() => null);
      if (res?.ok) return { data: Buffer.from(await res.arrayBuffer()), original: true };
    }
  }
  const pub = await readStoredImage(previewUrl).catch(() => null);
  return pub ? { data: pub, original: false } : null;
}

/** Whether a preview URL is in this artist's own upload folder (lib/uploadPipeline.ts artistUploadTarget). */
export function inArtistFolder(previewUrl: string, user: { id: string; slug?: string | null }): boolean {
  const m = LOCAL_RE.exec(previewUrl);
  if (m) return m[1] === String(user.slug || user.id);
  const id = cloudinaryOn() ? cloudPublicId(previewUrl) : null;
  return !!id && !!user.slug && id.startsWith(`artfinity/artists/${user.slug}/artworks/`);
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
