// One-off: make already-uploaded artwork originals private and leave a web preview at the same public URL.
// Dry run by default. Safe to run again: files that already have a private original are skipped.
//
//   pnpm images:privatize                 # show what would change (local files)
//   pnpm images:privatize --apply         # do it
//   pnpm images:privatize --cloudinary    # Cloudinary images in the DB instead (add --apply to do it)
//
// Local: public/uploads/<folder>/<12 hex>.jpg (artist uploads) moves to storage/originals/<folder>/ (or ORIGINALS_DIR),
// and a 1600px preview without metadata is written in its place. Demo assets (public/seed, public/uploads/arts,
// users, scenes) and review/reprint photos are left alone. No DB changes: image URLs stay the same.
// Cloudinary: each Artwork/OrderItem image is copied to an "authenticated" (signed-only) asset with the same
// public_id, then the public asset is overwritten with the preview. Needs CLOUDINARY_* and DATABASE_URL.
// Preview settings match makePreview in lib/storage.ts.
import fs from "fs";
import path from "path";
import sharp from "sharp";

try { process.loadEnvFile(); } catch {}
const APPLY = process.argv.includes("--apply");
const CLOUD = process.argv.includes("--cloudinary");
const EDGE = 1600;
const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "uploads");
const ORIGINALS = path.resolve(process.cwd(), process.env.ORIGINALS_DIR || "storage/originals");
const SKIP_DIRS = new Set(["arts", "users", "scenes", "reviews", "reprints"]);
const NAME_RE = /^[0-9a-f]{12}\.jpg$/;

const preview = (buf) =>
  sharp(buf, { failOn: "none" }).rotate()
    .resize({ width: EDGE, height: EDGE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();

const writeAtomic = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", data);
  fs.renameSync(file + ".tmp", file);
};

async function local() {
  const counts = { move: 0, repair: 0, skip: 0 };
  const dirs = fs.existsSync(PUBLIC_UPLOADS) ? fs.readdirSync(PUBLIC_UPLOADS, { withFileTypes: true }) : [];
  for (const d of dirs) {
    if (!d.isDirectory() || SKIP_DIRS.has(d.name)) continue;
    for (const name of fs.readdirSync(path.join(PUBLIC_UPLOADS, d.name))) {
      if (!NAME_RE.test(name)) continue;
      const pub = path.join(PUBLIC_UPLOADS, d.name, name);
      const odir = path.join(ORIGINALS, d.name);
      const base = name.replace(/\.jpg$/, "");
      const kept = fs.existsSync(odir) && fs.readdirSync(odir).find((f) => f.startsWith(`${base}.`) && !f.endsWith(".tmp"));
      if (kept) {
        // Already private. Repair only if the public file is still bigger than a preview.
        const m = await sharp(pub).metadata().catch(() => ({}));
        if (Math.max(m.width || 0, m.height || 0) <= EDGE && !m.exif) { counts.skip++; continue; }
        counts.repair++;
        console.log(`${APPLY ? "repair" : "would repair"}  /uploads/${d.name}/${name}`);
        if (APPLY) writeAtomic(pub, await preview(fs.readFileSync(path.join(odir, kept))));
        continue;
      }
      counts.move++;
      console.log(`${APPLY ? "privatize" : "would privatize"}  /uploads/${d.name}/${name}`);
      if (!APPLY) continue;
      const buf = fs.readFileSync(pub);
      const small = await preview(buf);
      writeAtomic(path.join(odir, name), buf);
      writeAtomic(pub, small);
    }
  }
  console.log(`\nLocal: ${counts.move} to privatize, ${counts.repair} to repair, ${counts.skip} already done. Originals: ${ORIGINALS}`);
}

async function cloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.");
    process.exit(1);
  }
  const { v2: cld } = await import("cloudinary");
  cld.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const where = { imageUrl: { contains: "res.cloudinary.com" } };
  const urls = [
    ...(await prisma.artwork.findMany({ where, select: { imageUrl: true } })),
    ...(await prisma.orderItem.findMany({ where, select: { imageUrl: true } })),
  ].map((r) => r.imageUrl);
  await prisma.$disconnect();

  // Same rules as cloudPublicId in lib/storage.ts.
  const publicId = (url) => {
    const after = url.split("?")[0].split("/upload/")[1];
    if (!after) return null;
    const parts = after.split("/");
    while (parts.length > 1 && (parts[0].includes(",") || /^[a-z]{1,3}_/.test(parts[0]) || /^v\d+$/.test(parts[0]))) parts.shift();
    return decodeURIComponent(parts.join("/")).replace(/\.[^/.]+$/, "");
  };
  const ids = [...new Set(urls.map(publicId).filter(Boolean))];
  const put = (buf, o) => new Promise((res, rej) => cld.uploader.upload_stream({ resource_type: "image", ...o }, (e, r) => (e ? rej(e) : res(r))).end(buf));
  const counts = { move: 0, skip: 0, fail: 0 };
  for (const id of ids) {
    if (await cld.api.resource(id, { type: "authenticated" }).then(() => true, () => false)) { counts.skip++; continue; }
    counts.move++;
    console.log(`${APPLY ? "privatize" : "would privatize"}  ${id}`);
    if (!APPLY) continue;
    try {
      const pub = await cld.api.resource(id, { type: "upload" });
      const res = await fetch(pub.secure_url);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await put(buf, { public_id: id, type: "authenticated" });
      let small = await preview(buf).catch(() => null);
      if (!small) {
        // sharp can't read it (e.g. HEIC): let Cloudinary convert, then clean it up.
        const src = cld.url(id, { type: "authenticated", sign_url: true, secure: true, format: "jpg", transformation: [{ crop: "limit", width: EDGE, height: EDGE }] });
        small = await preview(Buffer.from(await (await fetch(src)).arrayBuffer()));
      }
      // Same public_id: old URLs now serve the preview.
      await put(small, { public_id: id, type: "upload", overwrite: true, invalidate: true });
    } catch (e) {
      counts.fail++;
      console.error(`  failed: ${e?.message || e}`);
    }
  }
  console.log(`\nCloudinary: ${counts.move} to privatize, ${counts.skip} already done, ${counts.fail} failed.`);
}

if (!APPLY) console.log("Dry run. Add --apply to make changes.\n");
await (CLOUD ? cloudinary() : local());
