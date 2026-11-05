// Photo scenes compositor (server-only): hangs an artwork on an annotated photo at true size.
// sharp has no perspective transform, so the warp is done here: a homography from the flat framed print to the wall
// quad in the output, inverse-mapped with bilinear sampling on raw RGBA buffers. ~1600px output in well under a second.
import path from "node:path";
import fsp from "node:fs/promises";
import sharp from "sharp";
import { apply, frameBox, hexToRgb, homography, invert, mul, solveWall, type M3, type P } from "./geometry";
import { loadCatalog, variantForScene, sceneLabelFor, type Catalog, type CatalogPhoto, type CatalogVariant } from "./catalog";
import { OUT_ASPECT, hash32, type CropRect } from "./variants";
import { creditLine, type FrameKey, type Grade, type PhotoCredit, type PrintSizeKey, type SceneAnnotation } from "./types";

/** Bump when the output changes, so caches refill. */
export const COMPOSITOR_VERSION = 3;
const ROOT = process.cwd();

export type ArtInput = string | Buffer;
export type CompositeOptions = {
  /** Scene number 0–999 (through data/scenes.json) or a variant id. Ignored when `photo` is given. */
  scene?: number | string;
  /** Artwork: a file path, a public path like /seed/art-01.jpg, an https URL, or a buffer. */
  art: ArtInput;
  size: PrintSizeKey;
  frame?: FrameKey | null;
  /** Mat inside the frame (default on when framed). */
  mat?: boolean;
  /** Move the print on the wall, inches (right/down as seen in the output). */
  nudge?: { x: number; y: number };
  /** Output width in px (default 1600). Height follows the crop (5:4 for catalog variants). */
  width?: number;
  /** Blur the art (sensitive work). */
  blur?: boolean;
  quality?: number;
  catalog?: Catalog | null;
  /** Render straight from a photo + annotation (admin preview, CLI on unbuilt annotations). */
  photo?: { file: string; ann: SceneAnnotation; credit?: PhotoCredit | null; id?: string };
  /** Variant overrides when rendering from `photo` (default: full image, primary anchor, neutral). */
  variant?: Partial<Pick<CatalogVariant, "anchor" | "crop" | "mirror" | "grade">>;
};

export type PlacedRect = {
  /** Framed outline in the output image, TL, TR, BR, BL (px). */
  quad: P[];
  center: P;
  /** Print (image area) and framed outline, inches, as hung (landscape-aware). */
  printIn: { w: number; h: number };
  framedIn: { w: number; h: number };
  label: string; // "18 × 24 in"
  /** Output pixels per inch at the print's center. */
  ppi: number;
  /** Whether the framed print sits inside the annotated wall region. */
  fits: boolean;
};
export type CompositeResult = {
  jpeg: Buffer;
  width: number;
  height: number;
  variantId: string;
  photoId: string;
  label: string;
  credit: string | null;
  rect: PlacedRect;
};

// ---------------- inputs ----------------
export async function loadArt(art: ArtInput): Promise<Buffer> {
  if (Buffer.isBuffer(art)) return art;
  if (/^https?:\/\//i.test(art)) {
    const res = await fetch(art, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Couldn't fetch artwork (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  const candidates = art.startsWith("/") ? [art, path.join(ROOT, "public", art)] : [path.resolve(ROOT, art)];
  for (const f of candidates) {
    try {
      return await fsp.readFile(f);
    } catch {}
  }
  throw new Error(`Artwork not found: ${art}`);
}

type Resolved = { photo: CatalogPhoto; v: CatalogVariant };

function resolve(o: CompositeOptions): Resolved {
  if (o.photo) {
    const ann = o.photo.ann;
    const s = solveWall(ann);
    if (!s) throw new Error("Annotation incomplete: needs a wall quad and a reference line.");
    const photo: CatalogPhoto = { id: o.photo.id || ann.id, file: o.photo.file, source: "photo", credit: o.photo.credit ?? null, ann, G: s.G, wallIn: s.wallIn };
    const v: CatalogVariant = {
      id: `${photo.id}~preview`,
      photo: 0,
      anchor: o.variant?.anchor ?? 0,
      crop: o.variant?.crop ?? { x: 0, y: 0, w: ann.image.w, h: ann.image.h },
      mirror: !!o.variant?.mirror,
      grade: o.variant?.grade ?? "n",
    };
    return { photo, v };
  }
  const c = o.catalog ?? loadCatalog();
  if (!c) throw new Error("No photo scenes yet: annotate photos and run `npm run scenes:build`.");
  if (typeof o.scene === "string" && !/^\d+$/.test(o.scene)) {
    const v = c.variants.find((x) => x.id === o.scene);
    if (!v) throw new Error(`Unknown variant ${o.scene}`);
    return { photo: c.photos[v.photo], v };
  }
  const hit = variantForScene(c, Number(o.scene ?? 0));
  if (!hit) throw new Error(`No variant for scene ${o.scene}`);
  return { photo: hit.photo, v: hit.variant };
}

// ---------------- the flat framed print ----------------
type Raster = { data: Uint8Array; w: number; h: number };
const FRAME_RGB: Record<Exclude<FrameKey, "none">, string> = { black: "#1b1c20", white: "#f4f3ef", natural: "#b98a58" };

/** The framed print, face on, at q px per inch, with a 2px transparent (edge-colored) border for clean warped edges. */
async function flatPrint(artBuf: Buffer, size: PrintSizeKey, frame: FrameKey, mat: boolean, q: number, blur: boolean) {
  const img = sharp(artBuf, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const sideways = (meta.orientation || 0) >= 5;
  const aw = (sideways ? meta.height : meta.width) || 4, ah = (sideways ? meta.width : meta.height) || 5;
  const box = frameBox(size, aw / ah, frame, mat);
  const FW = Math.max(8, Math.round(box.W * q)), FH = Math.max(8, Math.round(box.H * q));
  const sx = FW / box.W, sy = FH / box.H;
  const mo = box.mold * sx, mt = box.mat * sx;
  const ix = Math.round(mo + mt), iy = Math.round(box.mold * sy + box.mat * sy);
  const iw = Math.max(2, FW - 2 * ix), ih = Math.max(2, FH - 2 * iy);
  let art = sharp(artBuf, { failOn: "none" }).rotate().resize(iw, ih, { fit: "cover" }).removeAlpha();
  if (blur) art = art.blur(Math.max(1, Math.max(iw, ih) / 14));
  const artPng = await art.png().toBuffer();

  const layers: sharp.OverlayOptions[] = [];
  let base: sharp.Sharp;
  if (frame === "none") {
    base = sharp({ create: { width: FW, height: FH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } });
    layers.push({ input: artPng, left: ix, top: iy });
    // a hairline paper edge
    layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}"><rect x=".5" y=".5" width="${FW - 1}" height="${FH - 1}" fill="none" stroke="#000" stroke-opacity=".10"/></svg>`), left: 0, top: 0 });
  } else {
    const fc = FRAME_RGB[frame];
    const b = Math.max(1, mo);
    const grain =
      frame === "natural"
        ? `<filter id="gh" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="${(0.6 / q).toFixed(4)} ${(9 / q).toFixed(4)}" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .2  0 0 0 0 .1  0 0 0 1.6 -.55"/></filter>` +
          `<filter id="gv" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="${(9 / q).toFixed(4)} ${(0.6 / q).toFixed(4)}" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .2  0 0 0 0 .1  0 0 0 1.6 -.55"/></filter>`
        : "";
    const tb = (y0: number, y1: number, x0: number, x1: number, x2: number, x3: number) => `${x0},${y0} ${x1},${y0} ${x2},${y1} ${x3},${y1}`;
    const top = tb(0, b, 0, FW, FW - b, b), bot = tb(FH, FH - b, 0, FW, FW - b, b);
    const left = `0,0 ${b},${b} ${b},${FH - b} 0,${FH}`, right = `${FW},0 ${FW - b},${b} ${FW - b},${FH - b} ${FW},${FH}`;
    const lightTop = frame === "black" ? 0.12 : 0.28, darkBot = frame === "white" ? 0.1 : 0.22;
    const matFill = mat ? "#f3f0e9" : "#ffffff";
    const bev = Math.max(1, 0.1 * sx);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}"><defs>${grain}
      <linearGradient id="ms" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
      <linearGradient id="mside" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
      <rect width="${FW}" height="${FH}" fill="${fc}"/>
      ${frame === "natural" ? `<polygon points="${top}" fill="#000" filter="url(#gh)"/><polygon points="${bot}" fill="#000" filter="url(#gh)"/><polygon points="${left}" fill="#000" filter="url(#gv)"/><polygon points="${right}" fill="#000" filter="url(#gv)"/>` : ""}
      <polygon points="${top}" fill="#fff" fill-opacity="${lightTop}"/>
      <polygon points="${left}" fill="#fff" fill-opacity="${lightTop * 0.5}"/>
      <polygon points="${bot}" fill="#000" fill-opacity="${darkBot}"/>
      <polygon points="${right}" fill="#000" fill-opacity="${darkBot * 0.6}"/>
      ${frame === "white" ? `<rect x=".5" y=".5" width="${FW - 1}" height="${FH - 1}" fill="none" stroke="#000" stroke-opacity=".14"/>` : ""}
      <rect x="${b}" y="${b}" width="${FW - 2 * b}" height="${FH - 2 * b}" fill="${matFill}"/>
      <rect x="${b}" y="${b}" width="${FW - 2 * b}" height="${Math.max(2, 0.35 * sy)}" fill="url(#ms)"/>
      <rect x="${b}" y="${b}" width="${Math.max(2, 0.25 * sx)}" height="${FH - 2 * b}" fill="url(#mside)"/>
      ${mat ? `<rect x="${ix - bev}" y="${iy - bev}" width="${iw + 2 * bev}" height="${ih + 2 * bev}" fill="#fffdf8"/><rect x="${ix - bev}" y="${iy + ih}" width="${iw + 2 * bev}" height="${bev}" fill="#000" fill-opacity=".06"/>` : ""}
    </svg>`;
    base = sharp(Buffer.from(svg));
    layers.push({ input: artPng, left: ix, top: iy });
    // glass: a faint diagonal sheen, and the mat bevel's shadow on the art's top edge
    layers.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".45" stop-color="#fff" stop-opacity=".015"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
          `<rect x="${b}" y="${b}" width="${FW - 2 * b}" height="${FH - 2 * b}" fill="url(#g)"/><rect x="${ix}" y="${iy}" width="${iw}" height="${Math.max(1, 0.08 * sy)}" fill="#000" fill-opacity=".12"/></svg>`,
      ),
      left: 0,
      top: 0,
    });
  }
  const pad = 2;
  const flat = await base.composite(layers).ensureAlpha().extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: "copy" }).raw().toBuffer({ resolveWithObject: true });
  const data = new Uint8Array(flat.data.buffer, flat.data.byteOffset, flat.data.length);
  const w = flat.info.width, h = flat.info.height;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (x < pad || y < pad || x >= w - pad || y >= h - pad) data[(y * w + x) * 4 + 3] = 0;
  return { raster: { data, w, h } as Raster, box, pad, FW, FH };
}

// ---------------- warp ----------------
/** Inverse-maps a flat RGBA raster into the region [x0,x1)×[y0,y1) of the output. Hinv: output px -> raster px. */
function warp(src: Raster, Hinv: M3, x0: number, y0: number, bw: number, bh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(bw * bh * 4);
  const { data, w: sw, h: sh } = src;
  const [a, b, c, d, e, f, g, h, i] = Hinv;
  for (let yy = 0; yy < bh; yy++) {
    const Y = y0 + yy + 0.5;
    for (let xx = 0; xx < bw; xx++) {
      const X = x0 + xx + 0.5;
      const W = g * X + h * Y + i;
      const u = (a * X + b * Y + c) / W - 0.5;
      const v = (d * X + e * Y + f) / W - 0.5;
      if (u < 0 || v < 0 || u > sw - 1 || v > sh - 1) continue;
      const ux = Math.min(sw - 2, Math.floor(u)), vy = Math.min(sh - 2, Math.floor(v));
      const fx = u - ux, fy = v - vy;
      const p00 = (vy * sw + ux) * 4, p10 = p00 + 4, p01 = p00 + sw * 4, p11 = p01 + 4;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const o = (yy * bw + xx) * 4;
      for (let k = 0; k < 4; k++) out[o + k] = data[p00 + k] * w00 + data[p10 + k] * w10 + data[p01 + k] * w01 + data[p11 + k] * w11;
    }
  }
  return out;
}

async function blurGray(buf: Uint8Array, w: number, h: number, sigma: number): Promise<Uint8Array> {
  if (sigma < 0.3) return buf;
  const r = await sharp(Buffer.from(buf), { raw: { width: w, height: h, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
  return new Uint8Array(r.buffer, r.byteOffset, r.length);
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- grading ----------------
function grade(px: Uint8Array, w: number, h: number, g: Grade) {
  if (g === "n") return;
  const m = g === "w" ? [1.03, 1.0, 0.94, 2, 0, -1] : g === "c" ? [0.96, 0.995, 1.04, -1, 0, 3] : [0.88, 0.82, 0.72, 3, 1, 0];
  const cx = w / 2, cy = h / 2, R2 = cx * cx + cy * cy;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      let vig = 1;
      if (g === "e") {
        const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / R2;
        vig = 1 - 0.28 * d2;
      }
      px[o] = Math.max(0, Math.min(255, (px[o] * m[0] + m[3]) * vig));
      px[o + 1] = Math.max(0, Math.min(255, (px[o + 1] * m[1] + m[4]) * vig));
      px[o + 2] = Math.max(0, Math.min(255, (px[o + 2] * m[2] + m[5]) * vig));
    }
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

/** Source px -> output px for a crop, scale and optional mirror. */
function cropMatrix(crop: CropRect, outW: number, mirror: boolean): M3 {
  const s = outW / crop.w;
  return mirror ? [-s, 0, s * (crop.w + crop.x), 0, s, -s * crop.y, 0, 0, 1] : [s, 0, -s * crop.x, 0, s, -s * crop.y, 0, 0, 1];
}

// ---------------- main ----------------
export async function composite(o: CompositeOptions): Promise<CompositeResult> {
  const { photo, v } = resolve(o);
  const ann = photo.ann;
  const frame: FrameKey = o.frame ?? "none";
  const mat = frame !== "none" && o.mat !== false;
  const outW = Math.max(160, Math.min(3200, Math.round(o.width || 1600)));
  const crop = v.crop;
  const outH = Math.round((outW * crop.h) / crop.w);

  // background: crop, mirror, resize
  let bgPipe = sharp(path.resolve(ROOT, photo.file), { failOn: "none" }).rotate().extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h });
  if (v.mirror) {
    // With rotate() in the pipeline sharp flops before it extracts, which crops the wrong side. Crop first, then mirror.
    const cut = await bgPipe.removeAlpha().toColorspace("srgb").raw().toBuffer({ resolveWithObject: true });
    bgPipe = sharp(cut.data, { raw: { width: cut.info.width, height: cut.info.height, channels: cut.info.channels } }).flop();
  }
  const bgRaw = await bgPipe.resize(outW, outH, { fit: "fill" }).removeAlpha().toColorspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const bg = new Uint8Array(bgRaw.data.buffer, bgRaw.data.byteOffset, bgRaw.data.length);
  const C = bgRaw.info.channels; // 3

  // geometry: wall inches -> output px
  const T = cropMatrix(crop, outW, v.mirror);
  const Gout = mul(T, photo.G);
  const Gsrc = photo.G;
  const anchorSrc = ann.anchors[v.anchor] ?? ann.anchors[0];
  const anchorWall = apply(invert(Gsrc), anchorSrc);
  const nudge = o.nudge ? [v.mirror ? -o.nudge.x : o.nudge.x, o.nudge.y] : [0, 0];
  const center: P = [anchorWall[0] + nudge[0], anchorWall[1] + nudge[1]];

  // local output ppi at the center, to size the flat raster just above output resolution
  const scaleAt = (p: P) => {
    const a = apply(Gout, [p[0] - 0.5, p[1]]), b = apply(Gout, [p[0] + 0.5, p[1]]);
    const c = apply(Gout, [p[0], p[1] - 0.5]), d = apply(Gout, [p[0], p[1] + 0.5]);
    return { x: Math.hypot(b[0] - a[0], b[1] - a[1]), y: Math.hypot(d[0] - c[0], d[1] - c[1]) };
  };
  const artBuf = await loadArt(o.art);
  // the frame box needs the art aspect; measure once via a cheap metadata read inside flatPrint
  const probeBox = frameBox(o.size, 0.8, frame, mat);
  const corners0: P[] = [[center[0] - probeBox.W / 2, center[1] - probeBox.H / 2], [center[0] + probeBox.W / 2, center[1] + probeBox.H / 2]];
  const maxScale = Math.max(...[center, ...corners0, [center[0] - probeBox.W / 2, center[1] + probeBox.H / 2] as P, [center[0] + probeBox.W / 2, center[1] - probeBox.H / 2] as P].map((p) => { const s = scaleAt(p); return Math.max(s.x, s.y); }));
  const q = Math.min(Math.max(4, maxScale * 1.25), 2400 / Math.max(probeBox.W, probeBox.H) * 1.0);
  const { raster, box, pad, FW, FH } = await flatPrint(artBuf, o.size, frame, mat, q, !!o.blur);

  // framed outline on the wall -> output
  const X0 = center[0] - box.W / 2, X1 = center[0] + box.W / 2, Y0 = center[1] - box.H / 2, Y1 = center[1] + box.H / 2;
  const wallCorners: P[] = v.mirror ? [[X1, Y0], [X0, Y0], [X0, Y1], [X1, Y1]] : [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]];
  const quadOut = wallCorners.map((p) => apply(Gout, p));
  const flatCorners: P[] = [[pad, pad], [pad + FW, pad], [pad + FW, pad + FH], [pad, pad + FH]];
  const Hf = homography(flatCorners, quadOut);
  const Hinv = invert(Hf);

  const sc = scaleAt(center);
  const ppi = Math.sqrt(sc.x * sc.y);
  const depth = frame === "none" ? 0.12 : 1.1; // inches off the wall
  const strength = Math.max(0, Math.min(1, ann.shadow?.strength ?? 0.5));
  const ang = (((v.mirror ? 180 - (ann.shadow?.angle ?? 75) : ann.shadow?.angle ?? 75) % 360) * Math.PI) / 180;
  const dir: P = [Math.cos(ang), Math.sin(ang)];
  const dropOff = depth * ppi * (0.45 + 0.8 * strength);
  const dropSigma = Math.max(0.6, depth * ppi * (0.5 + 0.5 * strength));
  const margin = Math.ceil(dropOff + dropSigma * 3 + 4);
  const xs = quadOut.map((p) => p[0]), ys = quadOut.map((p) => p[1]);
  const bx0 = Math.max(0, Math.floor(Math.min(...xs)) - margin), by0 = Math.max(0, Math.floor(Math.min(...ys)) - margin);
  const bx1 = Math.min(outW, Math.ceil(Math.max(...xs)) + margin), by1 = Math.min(outH, Math.ceil(Math.max(...ys)) + margin);
  const bw = Math.max(1, bx1 - bx0), bh = Math.max(1, by1 - by0);

  let layer = warp(raster, Hinv, bx0, by0, bw, bh);
  // match the photo's softness (alpha too, so edges aren't sharper than the room)
  const soft = (ann.softness ?? 0.4) * (outW / 1600);
  if (soft >= 0.3) {
    const r = await sharp(Buffer.from(layer.buffer), { raw: { width: bw, height: bh, channels: 4 } }).blur(soft).raw().toBuffer();
    layer = new Uint8ClampedArray(r.buffer, r.byteOffset, r.length);
  }

  // shadows from the (unblurred) coverage
  const alpha = new Uint8Array(bw * bh);
  for (let k = 0; k < bw * bh; k++) alpha[k] = layer[k * 4 + 3];
  const shifted = (dx: number, dy: number) => {
    const out = new Uint8Array(bw * bh);
    const ix = Math.round(dx), iy = Math.round(dy);
    for (let y = 0; y < bh; y++) {
      const sy = y - iy;
      if (sy < 0 || sy >= bh) continue;
      for (let x = 0; x < bw; x++) {
        const sx = x - ix;
        if (sx >= 0 && sx < bw) out[y * bw + x] = alpha[sy * bw + sx];
      }
    }
    return out;
  };
  const drop = await blurGray(shifted(dir[0] * dropOff, dir[1] * dropOff), bw, bh, dropSigma);
  const contactOff = depth * ppi * 0.15;
  const contact = await blurGray(shifted(dir[0] * contactOff, dir[1] * contactOff + 0.3), bw, bh, Math.max(0.5, ppi * (frame === "none" ? 0.05 : 0.16)));
  const kDrop = (frame === "none" ? 0.12 : 0.26) + 0.34 * strength;
  const kContact = frame === "none" ? 0.12 + 0.1 * strength : 0.22 + 0.2 * strength;

  // lighting: exposure + partial white balance from the wall tint, local light falloff from the photo itself
  const [tr, tg, tb] = hexToRgb(ann.tint).map((c) => c / 255);
  const lumT = Math.max(0.05, 0.2126 * tr + 0.7152 * tg + 0.0722 * tb);
  // the tint mixes wall paint and light color, so only part of it is applied (a red brick wall must not paint the art red)
  const expo = (1 + (Math.min(1.1, Math.max(0.6, lumT / 0.75)) - 1) * 0.5) * Math.max(0.5, Math.min(1.5, ann.exposure ?? 1));
  const wb = [tr, tg, tb].map((c) => Math.min(1.06, Math.max(0.94, 1 + (c / lumT - 1) * 0.25)));
  const LW = 160, LH = Math.max(2, Math.round((LW * outH) / outW));
  const lumMap = await sharp(Buffer.from(bg.buffer, bg.byteOffset, bg.length), { raw: { width: outW, height: outH, channels: C } })
    .resize(LW, LH, { fit: "fill" })
    .greyscale()
    .blur(4)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const lum = (x: number, y: number) => {
    const u = Math.min(LW - 1, Math.max(0, (x / outW) * LW)), w2 = Math.min(LH - 1, Math.max(0, (y / outH) * LH));
    return lumMap[Math.floor(w2) * LW + Math.floor(u)] || 1;
  };
  const cOut = apply(Gout, center);
  const lRef = Math.max(8, lum(cOut[0], cOut[1]));
  const rand = rng(hash32(`${v.id}:${o.size}:${frame}`));
  const vcx = outW / 2, vcy = outH / 2, vR2 = vcx * vcx + vcy * vcy;

  for (let y = 0; y < bh; y++) {
    const Y = by0 + y;
    for (let x = 0; x < bw; x++) {
      const X = bx0 + x;
      const k = y * bw + x;
      const o3 = (Y * outW + X) * C;
      const sh = Math.min(0.85, (drop[k] / 255) * kDrop + (contact[k] / 255) * kContact);
      let r = bg[o3] * (1 - sh), g = bg[o3 + 1] * (1 - sh), b = bg[o3 + 2] * (1 - sh);
      const a = layer[k * 4 + 3] / 255;
      if (a > 0) {
        const local = Math.min(1.15, Math.max(0.85, lum(X, Y) / lRef));
        const vig = 1 - 0.1 * (((X - vcx) ** 2 + (Y - vcy) ** 2) / vR2);
        const gain = expo * local * vig;
        const n = (rand() + rand() - 1) * 5;
        const ar = layer[k * 4] * gain * wb[0] + n, ag = layer[k * 4 + 1] * gain * wb[1] + n, ab = layer[k * 4 + 2] * gain * wb[2] + n;
        r = r * (1 - a) + ar * a;
        g = g * (1 - a) + ag * a;
        b = b * (1 - a) + ab * a;
      }
      bg[o3] = Math.max(0, Math.min(255, r));
      bg[o3 + 1] = Math.max(0, Math.min(255, g));
      bg[o3 + 2] = Math.max(0, Math.min(255, b));
    }
  }
  grade(bg, outW, outH, v.grade);
  const jpeg = await sharp(Buffer.from(bg.buffer, bg.byteOffset, bg.length), { raw: { width: outW, height: outH, channels: C } })
    .jpeg({ quality: o.quality ?? 84, mozjpeg: true })
    .toBuffer();

  const fits = X0 >= -0.01 && Y0 >= -0.01 && X1 <= photo.wallIn.w + 0.01 && Y1 <= photo.wallIn.h + 0.01;
  return {
    jpeg,
    width: outW,
    height: outH,
    variantId: v.id,
    photoId: photo.id,
    label: sceneLabelFor(photo, v.grade),
    credit: creditLine(photo.credit),
    rect: {
      quad: quadOut.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10] as P),
      center: cOut,
      printIn: { w: box.w, h: box.h },
      framedIn: { w: Math.round(box.W * 100) / 100, h: Math.round(box.H * 100) / 100 },
      label: `${fmt(box.w)} × ${fmt(box.h)} in`,
      ppi: Math.round(ppi * 100) / 100,
      fits,
    },
  };
}

export { OUT_ASPECT };
