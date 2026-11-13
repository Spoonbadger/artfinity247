// Photo scenes: files on disk (server-only).
//   scenes/photos/<id>.jpg|png|webp   real photos (Pexels fetcher or dropped in), optional <id>.json credit
//   scenes/fixtures/<id>.jpg          synthetic test backgrounds (never shown as real photos)
//   scenes/annotations/<id>.json      the annotation tool's output
//   data/scenes.json                  combined catalog (variants + scene-number slots), built by scenes:build
//   data/scenes-client.json           the small manifest the browser imports
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { computeAnnotation, solveWall, type M3 } from "./geometry";
import { assignSlots, cropsFor, variantsFor, SCENE_SLOTS, type CropRect } from "./variants";
import { GRADE_LABEL, ROOM_TAG_LABEL, creditLine, roomOf, type ClientManifest, type Grade, type PhotoCredit, type SceneAnnotation } from "./types";

const ROOT = process.cwd();
export const SCENES_DIR = path.join(ROOT, "scenes");
export const PHOTOS_DIR = path.join(SCENES_DIR, "photos");
export const FIXTURES_DIR = path.join(SCENES_DIR, "fixtures");
export const ANNOTATIONS_DIR = path.join(SCENES_DIR, "annotations");
export const CATALOG_FILE = path.join(ROOT, "data", "scenes.json");
export const CLIENT_FILE = path.join(ROOT, "data", "scenes-client.json");
const IMG_RE = /\.(jpe?g|png|webp)$/i;
export const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/;

export type PhotoFile = { id: string; file: string; source: "photo" | "fixture"; credit: PhotoCredit | null; w: number; h: number };

/** A safe scene id from a file name. */
export const idFromFile = (name: string) =>
  name.replace(IMG_RE, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fsp.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Upright size (EXIF orientations 5–8 are stored sideways). */
export async function imageSize(file: string) {
  const m = await sharp(file).metadata();
  return (m.orientation || 0) >= 5 ? { w: m.height || 0, h: m.width || 0 } : { w: m.width || 0, h: m.height || 0 };
}

/** Every photo (and, with fixtures, every synthetic fixture), sorted by id. Any jpg/png/webp dropped in counts. */
export async function listPhotos(opts: { fixtures?: boolean } = {}): Promise<PhotoFile[]> {
  const out: PhotoFile[] = [];
  const dirs: [string, PhotoFile["source"]][] = [[PHOTOS_DIR, "photo"]];
  if (opts.fixtures) dirs.push([FIXTURES_DIR, "fixture"]);
  const seen = new Set<string>();
  for (const [dir, source] of dirs) {
    let names: string[] = [];
    try {
      names = await fsp.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names.sort()) {
      if (!IMG_RE.test(name) || name.startsWith(".")) continue;
      const id = idFromFile(name);
      if (!ID_RE.test(id) || seen.has(id)) continue;
      seen.add(id);
      const file = path.join(dir, name);
      const base = file.replace(IMG_RE, "");
      let credit = await readJson<PhotoCredit>(base + ".json");
      if (source === "fixture") credit = { ...(credit || {}), fixture: true };
      try {
        const { w, h } = await imageSize(file);
        out.push({ id, file: path.relative(ROOT, file), source, credit, w, h });
      } catch {
        // unreadable image: skip
      }
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export async function findPhoto(id: string): Promise<PhotoFile | null> {
  if (!ID_RE.test(id)) return null;
  const all = await listPhotos({ fixtures: true });
  return all.find((p) => p.id === id) ?? null;
}

export async function readAnnotation(id: string): Promise<SceneAnnotation | null> {
  if (!ID_RE.test(id)) return null;
  return readJson<SceneAnnotation>(path.join(ANNOTATIONS_DIR, `${id}.json`));
}

export async function readAllAnnotations(): Promise<Map<string, SceneAnnotation>> {
  const map = new Map<string, SceneAnnotation>();
  let names: string[] = [];
  try {
    names = await fsp.readdir(ANNOTATIONS_DIR);
  } catch {
    return map;
  }
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    const a = await readJson<SceneAnnotation>(path.join(ANNOTATIONS_DIR, n));
    if (a?.id) map.set(a.id, a);
  }
  return map;
}

/** Validates, fills `computed`, and writes scenes/annotations/<id>.json. */
export async function writeAnnotation(a: SceneAnnotation): Promise<SceneAnnotation> {
  if (!ID_RE.test(a.id)) throw new Error("Bad id");
  const clean: SceneAnnotation = {
    id: a.id,
    version: 1,
    image: { w: Math.round(a.image.w), h: Math.round(a.image.h) },
    status: a.status === "rejected" ? "rejected" : "ok",
    quad: a.quad,
    anchors: (a.anchors || []).slice(0, 3),
    ref: a.ref,
    ref2: a.ref2 && a.ref2.inches > 0 ? a.ref2 : null,
    lens: a.lens || null,
    tint: /^#[0-9a-f]{6}$/i.test(a.tint) ? a.tint : "#e9e6e0",
    shadow: { angle: ((Math.round(a.shadow?.angle ?? 75) % 360) + 360) % 360, strength: Math.max(0, Math.min(1, Number(a.shadow?.strength ?? 0.5))) },
    tags: Array.from(new Set((a.tags || []).map(String))).slice(0, 12),
    exposure: a.exposure != null && a.exposure !== 1 ? Math.max(0.5, Math.min(1.5, Number(a.exposure))) : undefined,
    softness: a.softness != null ? Math.max(0, Math.min(2, Number(a.softness))) : undefined,
    updatedAt: new Date().toISOString(),
  };
  if (clean.status !== "rejected") clean.computed = computeAnnotation(clean);
  await fsp.mkdir(ANNOTATIONS_DIR, { recursive: true });
  const file = path.join(ANNOTATIONS_DIR, `${a.id}.json`);
  await fsp.writeFile(file + ".tmp", JSON.stringify(clean, null, 2) + "\n");
  await fsp.rename(file + ".tmp", file);
  return clean;
}

// ---------------- the catalog ----------------
export type CatalogPhoto = {
  id: string;
  file: string;
  source: "photo" | "fixture";
  credit: PhotoCredit | null;
  ann: SceneAnnotation;
  /** wall inches -> source image px */
  G: M3;
  wallIn: { w: number; h: number };
};
export type CatalogVariant = { id: string; photo: number; anchor: number; crop: CropRect; mirror: boolean; grade: Grade };
export type Catalog = {
  v: 1;
  rev: string;
  builtAt: string;
  fixtures: boolean;
  photos: CatalogPhoto[];
  variants: CatalogVariant[];
  /** Variant id per scene number 0–999 ([] when there are no photo scenes). */
  slots: string[];
  /** true where the number repeats an earlier variant (fewer than 1,000 distinct). */
  repeat: boolean[];
  distinct: number;
};

export type BuildReport = {
  photos: number;
  annotated: number;
  rejected: number;
  unannotated: string[];
  variants: number;
  distinct: number;
  perPhoto: number;
  photosFor1000: number;
};

/** Reads every annotated photo, derives variants, and assigns the 1,000 scene numbers. */
export async function buildCatalog(opts: { fixtures?: boolean; write?: boolean } = {}) {
  const photos = await listPhotos({ fixtures: !!opts.fixtures });
  const anns = await readAllAnnotations();
  const prev = await readJson<Catalog>(CATALOG_FILE);
  const out: CatalogPhoto[] = [];
  const variants: CatalogVariant[] = [];
  const perPhoto: string[][] = [];
  const unannotated: string[] = [];
  let rejected = 0;
  for (const p of photos) {
    const ann = anns.get(p.id);
    if (!ann) {
      unannotated.push(p.id);
      continue;
    }
    if (ann.status === "rejected") {
      rejected++;
      continue;
    }
    // points are stored for the upright image; rescale if the file was replaced at another resolution
    const a = rescale(ann, p.w, p.h);
    const s = solveWall(a);
    if (!s || !a.anchors?.length) {
      unannotated.push(p.id);
      continue;
    }
    a.computed = computeAnnotation(a);
    const idx = out.length;
    out.push({ id: p.id, file: p.file, source: p.source, credit: p.credit, ann: a, G: s.G, wallIn: s.wallIn });
    const crops = a.anchors.map((_, i) => cropsFor(a, s, i));
    const list = variantsFor(idx, p.id, crops, !a.tags.includes("no-mirror"));
    variants.push(...list.map((v) => ({ id: v.id, photo: v.photo, anchor: v.anchor, crop: v.crop, mirror: v.mirror, grade: v.grade })));
    perPhoto.push(list.map((v) => v.id));
  }
  const prevOk = prev && prev.fixtures === !!opts.fixtures ? prev : null;
  const { slots, repeat, distinct } = out.length ? assignSlots(perPhoto, prevOk) : { slots: [], repeat: [], distinct: 0 };
  const rev = crypto
    .createHash("sha1")
    .update(JSON.stringify({ o: out.map((p) => [p.id, p.ann.updatedAt, p.file]), slots }))
    .digest("hex")
    .slice(0, 10);
  const catalog: Catalog = { v: 1, rev, builtAt: new Date().toISOString(), fixtures: !!opts.fixtures, photos: out, variants, slots, repeat, distinct };
  const client = clientManifest(catalog);
  const avg = out.length ? variants.length / out.length : 12;
  const report: BuildReport = {
    photos: photos.length,
    annotated: out.length,
    rejected,
    unannotated,
    variants: variants.length,
    distinct,
    perPhoto: Math.round(avg * 10) / 10,
    photosFor1000: Math.ceil(SCENE_SLOTS / Math.max(1, avg)),
  };
  if (opts.write) {
    await fsp.mkdir(path.dirname(CATALOG_FILE), { recursive: true });
    await fsp.writeFile(CATALOG_FILE, JSON.stringify(catalog) + "\n");
    await fsp.writeFile(CLIENT_FILE, JSON.stringify(client) + "\n");
    cached = null;
  }
  return { catalog, client, report };
}

function rescale(a: SceneAnnotation, w: number, h: number): SceneAnnotation {
  const copy: SceneAnnotation = JSON.parse(JSON.stringify(a));
  if (!a.image?.w || (a.image.w === w && a.image.h === h)) return { ...copy, image: { w, h } };
  const sx = w / a.image.w, sy = h / a.image.h;
  const s = (p: [number, number]): [number, number] => [p[0] * sx, p[1] * sy];
  copy.quad = a.quad.map(s) as SceneAnnotation["quad"];
  copy.anchors = a.anchors.map(s);
  copy.ref = { ...a.ref, a: s(a.ref.a), b: s(a.ref.b) };
  if (a.ref2) copy.ref2 = { ...a.ref2, a: s(a.ref2.a), b: s(a.ref2.b) };
  copy.image = { w, h };
  return copy;
}

export function sceneLabelFor(p: CatalogPhoto, grade: Grade) {
  const room = roomOf(p.ann.tags);
  const base = room ? ROOM_TAG_LABEL[room] : "Wall";
  return grade === "e" ? `${base} · ${GRADE_LABEL.e}` : base;
}

export function clientManifest(c: Catalog): ClientManifest {
  const byId = new Map(c.variants.map((v) => [v.id, v]));
  return {
    v: 1,
    rev: c.rev,
    count: c.distinct,
    photos: c.photos.map((p) => ({
      id: p.id,
      room: roomOf(p.ann.tags),
      label: sceneLabelFor(p, "n"),
      credit: creditLine(p.credit),
      url: p.credit?.url ?? null,
      ...(p.source === "fixture" ? { fixture: true } : {}),
    })),
    p: c.slots.map((id) => byId.get(id)?.photo ?? -1),
    g: c.slots.map((id) => byId.get(id)?.grade ?? "n").join(""),
    r: c.repeat.map((x) => (x ? "1" : "0")).join(""),
  };
}

// ---------------- runtime loader ----------------
let cached: { mtime: number; catalog: Catalog } | null = null;

/** data/scenes.json, re-read when it changes. null when missing or empty (procedural rooms are used then). */
export function loadCatalog(): Catalog | null {
  try {
    const st = fs.statSync(CATALOG_FILE);
    if (!cached || cached.mtime !== st.mtimeMs) cached = { mtime: st.mtimeMs, catalog: JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8")) };
    return cached.catalog.slots?.length ? cached.catalog : null;
  } catch {
    return null;
  }
}

export function variantForScene(c: Catalog, n: number) {
  const id = c.slots[((Math.round(n) % SCENE_SLOTS) + SCENE_SLOTS) % SCENE_SLOTS];
  const v = c.variants.find((x) => x.id === id);
  return v ? { variant: v, photo: c.photos[v.photo] } : null;
}
