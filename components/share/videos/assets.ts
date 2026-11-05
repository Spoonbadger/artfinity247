// Loads what a preset needs, once, in the browser: paintings (same-origin, so the canvas isn't tainted), the
// composited room scenes from /api/scenes/render, drawn rooms (lib/rooms), fonts, the QR code and an optional logo.
// Everything is cached by URL, so switching presets or formats doesn't fetch again.
import { loadFonts } from "@/components/qr/text";
import { qrSVG } from "@/lib/qr/render";
import { findDetails, makeGrain } from "@/components/share/video/engine";
import { accentOf, dollars, paletteFromPixels } from "@/components/share/shareData";
import { autoPhotoScenes, photoScenesOn, photoSrc, sceneLabel, scenesForArt } from "@/lib/scenes/client";
import { autoScenes, renderScene, scenesOfType, ROOM_LABEL, ROOM_SIZE_IN, sceneInfo, type RoomSize } from "@/lib/rooms";
import { presetOf, type PresetId } from "@/lib/social/presets";
import type { PrintSizeKey } from "@/lib/scenes/types";
import type { Piece, Shot, VideoAssets } from "./engine";

export type PieceRef = { slug: string; title: string; fromCents: number; roomScenes?: number[] | null };
export type AssetRequest = {
  preset: PresetId;
  /** [0] is the main piece. Walks and carousels use up to 6 / 8. */
  pieces: PieceRef[];
  /** Where the QR code goes (the main piece, tagged with where it was shared). */
  qrUrl: string;
  /** Photo scene for size compare: one whose reference object (sofa, person…) gives the scale. */
  scale?: { n: number; note: string } | null;
  logoUrl?: string | null;
};

export class AssetError extends Error {
  constructor(message: string, readonly fix?: { label: string; href: string }) { super(message); }
}

const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, make: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = make();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = "async";
    // another origin (a Cloudinary profile photo): ask for CORS, or the canvas is tainted and can't be recorded
    if (/^https?:\/\//.test(src) && !src.startsWith(window.location.origin)) im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new AssetError("An image didn't load"));
    im.src = src;
  });
}
async function fetchImage(url: string): Promise<{ img: HTMLImageElement; headers: Headers }> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) throw new AssetError("That piece isn't approved or was removed. Pick another.", { label: "See my art", href: "/studio/art" });
    throw new AssetError("A room scene didn't load. Try again in a moment.");
  }
  const blob = await res.blob();
  const img = await loadImage(URL.createObjectURL(blob));
  return { img, headers: res.headers };
}
const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new AssetError("Couldn't read the painting"));
  r.readAsDataURL(blob);
});

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

/** A blurred copy (for the countdown): shrink a lot, then grow back with smoothing, twice. */
function soften(img: CanvasImageSource, iw: number, ih: number) {
  const tiny = canvas(Math.max(8, Math.round(24 * (iw / ih))), 24);
  const t = tiny.getContext("2d")!;
  t.imageSmoothingQuality = "high";
  t.drawImage(img, 0, 0, tiny.width, tiny.height);
  const mid = canvas(tiny.width * 4, 96);
  const m = mid.getContext("2d")!;
  m.imageSmoothingQuality = "high";
  m.drawImage(tiny, 0, 0, mid.width, mid.height);
  const out = canvas(Math.round(540 * (iw / ih)), 540);
  const o = out.getContext("2d")!;
  o.imageSmoothingQuality = "high";
  o.drawImage(mid, 0, 0, out.width, out.height);
  return out;
}

function loadPiece(p: PieceRef): Promise<Piece> {
  return once(`piece:${p.slug}`, async () => {
    const { img } = await fetchImage(`/api/share/painting?art=${encodeURIComponent(p.slug)}`);
    const probe = canvas(50, 60);
    const x = probe.getContext("2d", { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, 50, 60);
    const details = findDetails(x.getImageData(0, 0, 50, 60).data, 50, 60);
    x.drawImage(img, 0, 0, 8, 8);
    const palette = paletteFromPixels(x.getImageData(0, 0, 8, 8).data, 5);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    // the busiest of the three spots, nudged toward the middle so the zoom never lands on an edge
    const [dx, dy] = details[1] ?? details[0];
    return { slug: p.slug, title: p.title, price: `Prints from ${dollars(p.fromCents)}`, img, iw, ih, palette, accent: accentOf(palette), detail: [dx, dy], soft: soften(img, iw, ih) };
  });
}

/** Drawn room (SVG) rasterized once to a 1600 × 1280 canvas. */
function drawnRoom(n: number, art: { href: string; aspect: number; size: RoomSize } | null): Promise<Shot> {
  return once(`room:${n}:${art ? `${art.size}:${art.href.length}:${art.href.slice(-40)}` : "empty"}`, async () => {
    const svg = renderScene(n, art ? { href: art.href, aspect: art.aspect, size: art.size, frame: "black", mat: true } : null, { width: 1600, height: 1280, idp: `v${n}` });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const img = await loadImage(url);
      const c = canvas(1600, 1280);
      c.getContext("2d")!.drawImage(img, 0, 0, 1600, 1280);
      const size = art ? ROOM_SIZE_IN[art.size] : null;
      const box = art ? diffBox((await drawnRoom(n, null)).img, c) : undefined;
      return { img: c, iw: 1600, ih: 1280, label: ROOM_LABEL[sceneInfo(n).type], size: size ? `${size[0]} × ${size[1]} in` : undefined, box };
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}

function paintingDataUrl(slug: string) {
  return once(`data:${slug}`, async () => {
    const res = await fetch(`/api/share/painting?art=${encodeURIComponent(slug)}&w=960`);
    if (!res.ok) throw new AssetError("Couldn't load the painting. Try again in a moment.");
    return toDataUrl(await res.blob());
  });
}

const parseBox = (v: string | null): Shot["box"] => {
  const b = (v || "").split(",").map(Number);
  return b.length === 4 && b.every((x) => Number.isFinite(x)) && b[2] > b[0] && b[3] > b[1] ? (b as [number, number, number, number]) : undefined;
};

function photoShot(n: number, slug: string, size: PrintSizeKey): Promise<Shot> {
  return once(`photo:${n}:${slug}:${size}`, async () => {
    // &vb=1 keeps these apart from the buy page's cached copies, which may predate the X-Art-Box header
    const { img, headers } = await fetchImage(`${photoSrc(n, slug, size, "black", 1600)}&vb=1`);
    const printed = headers.get("X-Print-Size")?.replace("x", "×");
    return { img, iw: img.naturalWidth, ih: img.naturalHeight, label: sceneLabel(n), size: printed || undefined, box: parseBox(headers.get("X-Art-Box")) };
  });
}

/** Where two rasters of the same room differ: the print's box, as fractions. */
function diffBox(a: CanvasImageSource, b: CanvasImageSource): Shot["box"] {
  const W = 200, H = 160;
  const read = (img: CanvasImageSource) => {
    const c = canvas(W, H);
    const x = c.getContext("2d", { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, W, H);
    return x.getImageData(0, 0, W, H).data;
  };
  const da = read(a), db = read(b);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 60) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 > x0 && y1 > y0 ? [x0 / W, y0 / H, (x1 + 1) / W, (y1 + 1) / H] : undefined;
}

const SIZE_ORDER: PrintSizeKey[] = ["small", "medium", "large", "xl"];

async function roomTour(main: PieceRef, piece: Piece): Promise<Shot[]> {
  if (photoScenesOn) {
    const nums = Array.from(new Set([...scenesForArt(main), ...autoPhotoScenes(main.slug, 6)])).slice(0, 4);
    return Promise.all(nums.map((n) => photoShot(n, main.slug, "large")));
  }
  const href = await paintingDataUrl(main.slug);
  return Promise.all(autoScenes(main.slug, 4).map((n) => drawnRoom(n, { href, aspect: piece.iw / piece.ih, size: "large" })));
}

async function sizes(req: AssetRequest, piece: Piece): Promise<{ shots: Shot[]; note?: string }> {
  const main = req.pieces[0];
  if (photoScenesOn && req.scale) {
    const shots = await Promise.all(SIZE_ORDER.map((s) => photoShot(req.scale!.n, main.slug, s)));
    return { shots, note: req.scale.note };
  }
  const href = await paintingDataUrl(main.slug);
  const n = scenesOfType("living")[(main.slug.length * 7) % 100];
  const shots = await Promise.all((["small", "medium", "large", "xl"] as RoomSize[]).map((s) => drawnRoom(n, { href, aspect: piece.iw / piece.ih, size: s })));
  return { shots, note: "Sofa: about 32 in tall" };
}

async function beforeAfter(main: PieceRef, piece: Piece): Promise<{ before: Shot; after: Shot }> {
  const href = await paintingDataUrl(main.slug);
  const pool = scenesOfType("living");
  const n = pool[(main.slug.charCodeAt(0) * 13) % pool.length];
  const [before, after] = await Promise.all([drawnRoom(n, null), drawnRoom(n, { href, aspect: piece.iw / piece.ih, size: "large" })]);
  return { before, after };
}

function loadQr(url: string) {
  return once(`qr:${url}`, async () => {
    const svg = qrSVG(url, { fg: "#15161b", dots: "rounded", eyes: "frame", eyeColor: "#2b37f0" }).replace("<svg ", `<svg width="672" height="672" `);
    return loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  });
}

/** Everything the preset in `req` draws. Throws AssetError with words for the artist. */
export async function loadAssets(req: AssetRequest): Promise<VideoAssets> {
  if (!req.pieces.length) throw new AssetError("Pick a piece first.", { label: "Upload art", href: "/studio/art/new" });
  const def = presetOf(req.preset);
  const refs = def.pieces === "many" ? req.pieces.slice(0, req.preset === "carousel" ? 8 : 6) : req.pieces.slice(0, 1);
  const [fonts, qr, pieces, logo] = await Promise.all([
    loadFonts(),
    loadQr(req.qrUrl),
    Promise.all(refs.map(loadPiece)),
    req.logoUrl ? loadImage(req.logoUrl).then((img) => ({ img, w: img.naturalWidth, h: img.naturalHeight })).catch(() => null) : Promise.resolve(null),
  ]);
  const grain = await once("grain", async () => makeGrain());
  const A: VideoAssets = { fonts, grain, qr, pieces, scenes: [], sizes: [], logo };
  const main = req.pieces[0];
  if (req.preset === "room-tour") A.scenes = await roomTour(main, pieces[0]);
  if (req.preset === "size-compare") { const s = await sizes(req, pieces[0]); A.sizes = s.shots; A.sizeNote = s.note; }
  if (req.preset === "before-after") Object.assign(A, await beforeAfter(main, pieces[0]));
  return A;
}
