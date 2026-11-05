// Buy-page gallery helpers (server only): which room scenes to show and where the close-ups go.
import sharp from "sharp";
import { loadCatalog } from "@/lib/scenes/catalog";
import { creditLine, roomOf } from "@/lib/scenes/types";
import { readArtImage } from "@/lib/scenes/server";
import { isScene, sceneInfo, scenesFor, scenesOfType, type RoomType } from "@/lib/rooms/scene";
import { hashString } from "@/lib/rooms/rng";

export type GalleryRoom = {
  /** Scene number: a photo slot (kind "photo") or a drawn room (kind "drawn"). */
  n: number;
  kind: "photo" | "drawn";
  label: string;
  credit?: string | null;
  url?: string | null;
};

/** A close-up: the centre of the region to enlarge, as fractions of the image's width and height. */
export type Detail = { cx: number; cy: number };

const ROOMS = 4;

/**
 * Rooms for the gallery: real photos first (one per photo, widest daylight crop, the artist's picks when they chose
 * photo scenes), then drawn daylight rooms with furniture for scale to make up four.
 */
export function galleryRooms(art: { slug: string; roomScenes?: number[] | null }): GalleryRoom[] {
  const out: GalleryRoom[] = [];
  const cat = loadCatalog();
  const usedTypes = new Set<string>();
  if (cat) {
    const best = new Map<number, { n: number; area: number; crop: { x: number; y: number; w: number; h: number } }>();
    const picks = new Set((art.roomScenes || []).filter(isScene));
    cat.slots.forEach((id, n) => {
      const v = cat.variants.find((x) => x.id === id);
      if (!v || v.grade === "e" || v.grade === "c") return;
      const p = cat.photos[v.photo];
      if (!p || p.credit?.fixture) return;
      // an artist's pick wins; otherwise the widest, unmirrored, neutral crop shows the most room
      const area = (picks.has(n) ? 1e9 : 0) + v.crop.w * v.crop.h * (v.mirror ? 0.98 : 1) * (v.grade === "n" ? 1 : 0.97);
      const cur = best.get(v.photo);
      if (!cur || area > cur.area) best.set(v.photo, { n, area, crop: v.crop });
    });
    // living rooms and bedrooms first: furniture gives the print a sense of scale. A crop that leaves out the photo's
    // scale reference (the chair, sofa or door) is mostly bare wall, so those only count when there are too few others.
    const rank = (room?: string | null) => (room === "living" ? 0 : room === "bedroom" ? 1 : 2);
    const inCrop = (pt: number[] | undefined, c: { x: number; y: number; w: number; h: number }) => !!pt && pt[0] >= c.x && pt[0] <= c.x + c.w && pt[1] >= c.y && pt[1] <= c.y + c.h;
    const all = Array.from(best.entries())
      .map(([pi, b]) => {
        const photo = cat.photos[pi];
        const ref = photo.ann?.ref;
        return { pi, ...b, photo, context: !ref || inCrop(ref.a, b.crop) || inCrop(ref.b, b.crop) || picks.has(b.n) };
      })
      .sort((a, b) => rank(roomOf(a.photo.ann?.tags || [])) - rank(roomOf(b.photo.ann?.tags || [])) || b.area - a.area);
    const withContext = all.filter((p) => p.context);
    const photos = withContext.length >= 2 ? withContext : all;
    for (const p of photos.slice(0, ROOMS - 1)) {
      const room = roomOf(p.photo.ann?.tags || []);
      if (room) usedTypes.add(room);
      out.push({ n: p.n, kind: "photo", label: room ? labelFor(room) : "Room", credit: p.photo.credit ? creditLine(p.photo.credit) : null, url: p.photo.credit?.url ?? null });
    }
  }
  // fill with drawn rooms: the artist's picks when there are no photos, else daylight rooms of types not shown yet
  const drawnPicks = cat ? [] : scenesFor(art).filter((n) => !sceneInfo(n).evening);
  const seed = hashString(`gallery:${art.slug}`);
  const order: RoomType[] = ["living", "bedroom", "dining", "office", "nook", "kitchen"];
  const pool = [...drawnPicks];
  order.forEach((t, i) => {
    const list = scenesOfType(t).filter((n) => !sceneInfo(n).evening);
    pool.push(list[(seed + i * 7919) % list.length]);
  });
  const seen = new Set<number>();
  for (const n of pool) {
    if (out.length >= ROOMS) break;
    const info = sceneInfo(n);
    if (seen.has(n) || (usedTypes.has(info.type) && !drawnPicks.includes(n))) continue;
    seen.add(n);
    usedTypes.add(info.type);
    out.push({ n, kind: "drawn", label: info.room });
  }
  return out;
}

const labelFor = (room: string) => ({ living: "Living room", bedroom: "Bedroom", kitchen: "Kitchen", office: "Office", dining: "Dining room", hallway: "Entry", cafe: "Café" } as Record<string, string>)[room] || "Room";

// ---------- close-ups ----------

export type ImageFacts = { aspect: number | null; details: Detail[] };
const factsCache = new Map<string, ImageFacts>();

/** Rule-of-thirds fallback: the upper-left and lower-right thirds. */
const THIRDS: Detail[] = [{ cx: 1 / 3, cy: 1 / 3 }, { cx: 2 / 3, cy: 2 / 3 }];

/** A 3× crop in the gallery's 5:4 frame, as fractions of an image of this aspect (width / height). ArtGallery mirrors it. */
function cropSize(aspect: number) {
  // the crop is a third of the image's width (or of its height, for very tall images), shaped 5:4
  let w = 1 / 3;
  let h = (w * aspect) / 1.25;
  if (h > 0.6) {
    h = 0.6;
    w = (h * 1.25) / aspect;
  }
  return { w, h };
}

/**
 * The image's aspect, and two close-up regions with the most going on (brushwork, edges): local contrast on a small
 * greyscale copy, then the best two windows that barely overlap. Cached per image; if the image can't be read in time,
 * no aspect (the browser measures it) and rule-of-thirds crops.
 */
export async function imageFacts(imageUrl: string, budgetMs = 600): Promise<ImageFacts> {
  const hit = factsCache.get(imageUrl);
  if (hit) return hit;
  const work = (async (): Promise<ImageFacts | null> => {
    const buf = await readArtImage(imageUrl);
    if (!buf) return null;
    const G = 48;
    const { data, info } = await sharp(buf).rotate().greyscale().resize(G, G, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
    const meta = await sharp(buf).metadata();
    const swap = (meta.orientation || 0) >= 5;
    const aspect = ((swap ? meta.height : meta.width) || 1) / ((swap ? meta.width : meta.height) || 1);
    const W = info.width;
    const H = info.height;
    // gradient energy per pixel
    const e = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        e[i] = Math.abs(data[i + 1] - data[i - 1]) + Math.abs(data[i + W] - data[i - W]);
      }
    // summed-area table for fast window sums
    const S = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) S[(y + 1) * (W + 1) + x + 1] = e[y * W + x] + S[y * (W + 1) + x + 1] + S[(y + 1) * (W + 1) + x] - S[y * (W + 1) + x];
    const sum = (x0: number, y0: number, x1: number, y1: number) => S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0];
    const { w, h } = cropSize(aspect);
    const cw = Math.max(2, Math.round(w * W));
    const ch = Math.max(2, Math.round(h * H));
    const cands: { x: number; y: number; s: number }[] = [];
    for (let y = 0; y + ch <= H; y += 2)
      for (let x = 0; x + cw <= W; x += 2) {
        // a slight pull toward the thirds keeps crops off the very edges
        const cx = (x + cw / 2) / W;
        const cy = (y + ch / 2) / H;
        const pull = 1 - 0.25 * Math.min(Math.hypot(cx - 1 / 3, cy - 1 / 3), Math.hypot(cx - 2 / 3, cy - 2 / 3), Math.hypot(cx - 2 / 3, cy - 1 / 3), Math.hypot(cx - 1 / 3, cy - 2 / 3));
        cands.push({ x, y, s: sum(x, y, x + cw, y + ch) * pull });
      }
    cands.sort((a, b) => b.s - a.s);
    if (!cands.length || cands[0].s <= 0) return { aspect, details: THIRDS };
    const first = cands[0];
    const overlap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      (Math.max(0, Math.min(a.x + cw, b.x + cw) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + ch, b.y + ch) - Math.max(a.y, b.y))) / (cw * ch);
    // the second close-up shows a different part of the painting: no overlap, and well away from the first
    const far = (c: { x: number; y: number }) => Math.hypot((c.x - first.x) / W, (c.y - first.y) / H) >= 0.38;
    const second = cands.find((c) => overlap(c, first) === 0 && far(c)) ?? cands.find((c) => overlap(c, first) < 0.15) ?? cands[Math.floor(cands.length / 2)];
    const toFrac = (c: { x: number; y: number }): Detail => ({ cx: (c.x + cw / 2) / W, cy: (c.y + ch / 2) / H });
    return { aspect, details: [toFrac(first), toFrac(second)] };
  })().catch(() => null);
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), budgetMs));
  const res = await Promise.race([work, timeout]);
  if (res) {
    if (factsCache.size > 500) factsCache.delete(factsCache.keys().next().value as string);
    factsCache.set(imageUrl, res);
    return res;
  }
  // too slow this time: thirds now, and keep the real answer for next time
  work.then((r) => r && factsCache.set(imageUrl, r));
  return { aspect: null, details: THIRDS };
}
