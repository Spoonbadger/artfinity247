// Fills Artwork.imageHash (64-bit dHash, 16 hex chars) for artworks that don't have one yet, then reports
// near-duplicates across artists. It never changes an artwork's status: pairs it finds are listed for a person.
//
//   node --env-file=.env scripts/backfill-image-hashes.mjs          # only missing hashes
//   node --env-file=.env scripts/backfill-image-hashes.mjs --all    # recompute every hash
//
// Where the bytes come from, best first: the private original (storage/originals/<folder>/<name>.*, or
// ORIGINALS_DIR), the public file under public/ (/uploads previews, /seed images), or the Cloudinary preview.
// Must match dHash() in lib/imageHash.ts.
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ALL = process.argv.includes("--all");
const THRESHOLD = 6;
const ROOT = process.cwd();
const ORIGINALS_DIR = path.resolve(ROOT, process.env.ORIGINALS_DIR || "storage/originals");
const PUBLIC = path.join(ROOT, "public");
const LOCAL_RE = /^\/uploads\/((?:[\w-]+\/)*[\w-]+)\/([\w-]+)\.jpg$/;

async function dHash(buf) {
  const px = await sharp(buf, { failOn: "none" }).rotate().flatten({ background: "#ffffff" }).grayscale()
    .resize(9, 8, { fit: "fill", kernel: "lanczos3" }).raw().toBuffer();
  let hex = "";
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) byte = (byte << 1) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1 : 0);
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

const POP = Array.from({ length: 256 }, (_, i) => { let n = 0; for (let v = i; v; v >>= 1) n += v & 1; return n; });
function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < 16; i += 2) d += POP[parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16)];
  return d;
}

async function bytesFor(url) {
  const m = LOCAL_RE.exec(url);
  if (m) {
    const dir = path.join(ORIGINALS_DIR, ...m[1].split("/"));
    const hit = (await fs.readdir(dir).catch(() => [])).find((f) => f.startsWith(`${m[2]}.`));
    if (hit) return { buf: await fs.readFile(path.join(dir, hit)), from: "original" };
  }
  const clean = url.split("?")[0];
  if (clean.startsWith("/") && !clean.includes("..")) {
    const buf = await fs.readFile(path.join(PUBLIC, ...clean.split("/").filter(Boolean))).catch(() => null);
    return buf ? { buf, from: "public" } : null;
  }
  if (/^https:\/\/res\.cloudinary\.com\//.test(clean)) {
    const res = await fetch(url).catch(() => null);
    return res?.ok ? { buf: Buffer.from(await res.arrayBuffer()), from: "cloudinary" } : null;
  }
  return null;
}

const rows = await prisma.artwork.findMany({
  where: ALL ? {} : { imageHash: null },
  select: { id: true, title: true, imageUrl: true },
});
const tally = { original: 0, public: 0, cloudinary: 0, missing: 0, unreadable: 0 };
for (const r of rows) {
  const got = await bytesFor(r.imageUrl);
  if (!got) { tally.missing++; console.warn(`  no file: ${r.id} ${r.imageUrl}`); continue; }
  const hash = await dHash(got.buf).catch(() => null);
  if (!hash) { tally.unreadable++; console.warn(`  unreadable: ${r.id} ${r.imageUrl}`); continue; }
  await prisma.artwork.update({ where: { id: r.id }, data: { imageHash: hash } });
  tally[got.from]++;
}
console.log(`Hashed ${rows.length - tally.missing - tally.unreadable} of ${rows.length}`, tally);

// Report: closest pair across different artists, and every pair at or under the threshold.
const all = await prisma.artwork.findMany({
  where: { imageHash: { not: null } },
  select: { id: true, title: true, artistId: true, imageHash: true, status: true },
});
let closest = null;
const near = [];
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    if (all[i].artistId === all[j].artistId) continue;
    const d = hamming(all[i].imageHash, all[j].imageHash);
    if (!closest || d < closest.d) closest = { d, a: all[i], b: all[j] };
    if (d <= THRESHOLD) near.push({ d, a: all[i], b: all[j] });
  }
}
if (closest) console.log(`Closest pair across artists: ${closest.d} bits ("${closest.a.title}" vs "${closest.b.title}"). Threshold is ${THRESHOLD}.`);
for (const p of near) console.log(`  near-duplicate (${p.d}): ${p.a.id} "${p.a.title}" [${p.a.status}]  ~  ${p.b.id} "${p.b.title}" [${p.b.status}]`);
if (!near.length) console.log("No near-duplicates across artists.");
await prisma.$disconnect();
