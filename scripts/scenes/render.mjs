#!/usr/bin/env node
// Render any picture into the photo scenes, in any size and frame, with the same compositor the site uses.
//
//   npm run scenes:render -- --art public/seed/art-01.jpg
//   npm run scenes:render -- --art east-river-late-may --sizes small,xl --frames none,black --scenes tag:cafe
//   npm run scenes:render -- --art https://example.com/painting.jpg --scenes 0-99 --out ./renders
//
// Options
//   --art <path|url|slug|/@handle/art/slug>   the picture (a slug is looked up in the database)
//   --sizes small,medium,large,xl              default: all four
//   --frames none,black,white,natural          default: all four
//   --scenes all|base|tag:<tag>|photo:<id>|0-99|5,8,13|<variant id>
//                                              all = every distinct variant; base = one per photo; numbers = scene numbers
//   --out <dir>                                default: .cache/scenes/out
//   --width 1600   --no-mat   --nudge x,y (inches)   --blur
//   --fixtures                                 include the synthetic test fixtures (built in memory)
//   --sheet                                    also write a contact sheet (sheet.jpg) of everything rendered
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(root);
const require = createRequire(import.meta.url);
const jiti = createRequire(require.resolve("tailwindcss"))("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const sharp = require("sharp");

// ---------- args ----------
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(`--${name}`);
if (flag("help") || !opt("art")) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 19).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(opt("art") ? 0 : 1);
}
const SIZES = ["small", "medium", "large", "xl"];
const FRAMES = ["none", "black", "white", "natural"];
const sizes = opt("sizes", SIZES.join(",")).split(",").filter((s) => SIZES.includes(s));
const frames = opt("frames", FRAMES.join(",")).split(",").filter((s) => FRAMES.includes(s));
const width = Math.max(320, Math.min(3200, Number(opt("width", 1600)) || 1600));
const out = path.resolve(opt("out", ".cache/scenes/out"));
const nudgeArg = opt("nudge", "");
const nudge = nudgeArg ? { x: Number(nudgeArg.split(",")[0]) || 0, y: Number(nudgeArg.split(",")[1]) || 0 } : undefined;

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

/** --art: a file, a URL, or an artwork slug (or buy-page path) looked up in the database. */
async function resolveArt(a) {
  if (/^https?:\/\//.test(a) && !/\/art\/[^/]+\/?$/.test(a)) return { src: a, name: path.basename(new URL(a).pathname).replace(/\.\w+$/, "") || "art" };
  if (fs.existsSync(path.resolve(a))) return { src: path.resolve(a), name: path.basename(a).replace(/\.\w+$/, "") };
  if (a.startsWith("/") && fs.existsSync(path.join(root, "public", a))) return { src: path.join(root, "public", a), name: path.basename(a).replace(/\.\w+$/, "") };
  const slug = a.replace(/\/+$/, "").split("/").pop();
  loadEnv();
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const art = await prisma.artwork.findUnique({ where: { slug }, select: { imageUrl: true, title: true } });
    if (!art) throw new Error(`No artwork with slug "${slug}" and no such file.`);
    console.log(`Artwork: ${art.title} (${art.imageUrl})`);
    return { src: art.imageUrl, name: slug };
  } finally {
    await prisma.$disconnect();
  }
}

// ---------- scenes ----------
const { buildCatalog, loadCatalog } = jiti(path.join(root, "lib/scenes/catalog.ts"));
const { composite } = jiti(path.join(root, "lib/scenes/composite.ts"));

const catalog = flag("fixtures") ? (await buildCatalog({ fixtures: true })).catalog : loadCatalog() ?? (await buildCatalog({})).catalog;
if (!catalog?.variants?.length) {
  console.error("No annotated photo scenes. Add photos to scenes/photos, annotate them at /admin/scenes, then npm run scenes:build.\n(For the synthetic test fixtures, add --fixtures.)");
  process.exit(1);
}
const sel = opt("scenes", "base");
/** -> [{ scene, label }] where scene is a variant id or a scene number */
function selectScenes(spec) {
  const vs = catalog.variants;
  const firstOf = new Map();
  vs.forEach((v) => firstOf.has(v.photo) || firstOf.set(v.photo, v));
  if (spec === "all") return vs.map((v) => ({ scene: v.id }));
  if (spec === "base") return [...firstOf.values()].map((v) => ({ scene: v.id }));
  if (spec.startsWith("tag:")) {
    const t = spec.slice(4);
    return vs.filter((v) => catalog.photos[v.photo].ann.tags.includes(t)).map((v) => ({ scene: v.id }));
  }
  if (spec.startsWith("photo:")) return vs.filter((v) => catalog.photos[v.photo].id === spec.slice(6)).map((v) => ({ scene: v.id }));
  const nums = [];
  for (const part of spec.split(",")) {
    const r = /^(\d+)-(\d+)$/.exec(part);
    if (r) for (let n = +r[1]; n <= +r[2] && n < 1000; n++) nums.push(n);
    else if (/^\d+$/.test(part)) nums.push(+part);
    else if (vs.some((v) => v.id === part)) nums.push(part);
  }
  return nums.map((n) => ({ scene: n }));
}
const scenes = selectScenes(sel);
if (!scenes.length) {
  console.error(`No scenes match "${sel}".`);
  process.exit(1);
}

// ---------- render ----------
const art = await resolveArt(opt("art"));
const artBuf = await jiti(path.join(root, "lib/scenes/composite.ts")).loadArt(art.src);
const dir = path.join(out, art.name);
fs.mkdirSync(dir, { recursive: true });
const jobs = [];
for (const s of scenes) for (const size of sizes) for (const frame of frames) jobs.push({ ...s, size, frame });
console.log(`Rendering ${jobs.length} images (${scenes.length} scenes × ${sizes.length} sizes × ${frames.length} frames) at ${width}px -> ${path.relative(root, dir) || dir}`);
const index = [];
const t0 = Date.now();
let done = 0;
async function run(job) {
  const r = await composite({ scene: job.scene, art: artBuf, size: job.size, frame: job.frame, mat: !flag("no-mat"), width, nudge, blur: flag("blur"), catalog });
  const name = `${r.variantId.replace(/[^a-zA-Z0-9_~-]/g, "_")}__${job.size}-${job.frame}.jpg`;
  fs.writeFileSync(path.join(dir, name), r.jpeg);
  index.push({ file: name, scene: job.scene, variant: r.variantId, photo: r.photoId, size: job.size, frame: job.frame, label: r.label, credit: r.credit, rect: r.rect });
  done++;
  if (done % 10 === 0 || done === jobs.length) process.stdout.write(`  ${done}/${jobs.length}\r`);
}
const POOL = 3;
let next = 0;
await Promise.all(Array.from({ length: POOL }, async () => { while (next < jobs.length) await run(jobs[next++]); }));
const order = new Map(jobs.map((j, i) => [`${j.scene}|${j.size}|${j.frame}`, i]));
index.sort((a, b) => order.get(`${a.scene}|${a.size}|${a.frame}`) - order.get(`${b.scene}|${b.size}|${b.frame}`));
fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index, null, 2));
console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s (${((Date.now() - t0) / jobs.length).toFixed(0)} ms each). index.json has the placed rectangles.`);
const unfit = index.filter((i) => !i.rect.fits);
if (unfit.length) console.log(`${unfit.length} renders put the framed print partly outside the annotated wall region (too big for that wall).`);

if (flag("sheet")) {
  const TW = 400, TH = Math.round(TW / 1.25) + 34, cols = Math.min(8, Math.max(Math.min(4, index.length), frames.length * sizes.length > 1 ? Math.min(8, frames.length * sizes.length) : Math.ceil(Math.sqrt(index.length))));
  const tiles = [];
  for (const it of index) {
    const img = await sharp(path.join(dir, it.file)).resize(TW, TH - 34, { fit: "cover" }).toBuffer();
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="34"><rect width="100%" height="100%" fill="#fff"/><text x="6" y="14" font-family="DejaVu Sans, Arial" font-size="12" fill="#15161b">${esc(it.variant)}</text><text x="6" y="29" font-family="DejaVu Sans, Arial" font-size="12" fill="#555">${esc(`${it.size} · ${it.frame} · ${it.rect.label} · ${it.rect.ppi} px/in${it.rect.fits ? "" : " · too big"}`)}</text></svg>`);
    tiles.push(await sharp({ create: { width: TW, height: TH, channels: 3, background: "#fff" } }).composite([{ input: img, left: 0, top: 0 }, { input: label, left: 0, top: TH - 34 }]).jpeg().toBuffer());
  }
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * (TW + 6) + 6, height: rows * (TH + 6) + 6, channels: 3, background: "#e9e6df" } })
    .composite(tiles.map((t, i) => ({ input: t, left: 6 + (i % cols) * (TW + 6), top: 6 + Math.floor(i / cols) * (TH + 6) })))
    .jpeg({ quality: 82 })
    .toFile(path.join(dir, "sheet.jpg"));
  console.log(`Contact sheet: ${path.join(dir, "sheet.jpg")}`);
}
