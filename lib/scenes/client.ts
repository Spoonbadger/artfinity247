// Photo scenes in the browser: the small manifest built by `npm run scenes:build` (data/scenes-client.json).
// When it lists no photos, everything here falls back to the procedural rooms, so nothing changes until photos exist.
import manifest from "@/data/scenes-client.json";
import { autoScenes, sceneInfo, scenesFor } from "@/lib/rooms/scene";
import { hash32, SCENE_SLOTS } from "./variants";
import { GRADE_LABEL, type ClientManifest, type FrameKey, type Grade, type PrintSizeKey, type RoomTag } from "./types";

const M = manifest as unknown as ClientManifest;

/** True when photo scenes are built: scene numbers then show photos instead of drawn rooms. */
export const photoScenesOn = M.count > 0 && M.p?.length === SCENE_SLOTS;
export const photoSceneCount = photoScenesOn ? M.count : 0;

const norm = (n: number) => ((Math.round(n) % SCENE_SLOTS) + SCENE_SLOTS) % SCENE_SLOTS;

export function photoScene(n: number) {
  if (!photoScenesOn) return null;
  const i = norm(n);
  const p = M.photos[M.p[i]];
  if (!p) return null;
  const grade = (M.g[i] || "n") as Grade;
  return { ...p, grade, label: grade === "e" ? `${p.label} · ${GRADE_LABEL.e}` : p.label };
}

/** Caption for a scene number: the photo's room, or the procedural room's label. */
export function sceneLabel(n: number) {
  return photoScene(n)?.label ?? sceneInfo(n).label;
}

const WIDTHS = [480, 800, 1200, 1600];
export function photoSrc(n: number, slug: string, size: PrintSizeKey, frame: FrameKey | null | undefined, w = 1200, o: { mat?: boolean; blur?: boolean } = {}) {
  const q = new URLSearchParams({ scene: String(norm(n)), art: slug, size, frame: frame || "none", w: String(w), v: M.rev });
  if (o.mat === false) q.set("mat", "0");
  if (o.blur) q.set("blur", "1");
  return `/api/scenes/render?${q}`;
}
export function photoSrcSet(n: number, slug: string, size: PrintSizeKey, frame: FrameKey | null | undefined, o: { mat?: boolean; blur?: boolean } = {}) {
  return WIDTHS.map((w) => `${photoSrc(n, slug, size, frame, w, o)} ${w}w`).join(", ");
}

/** Rooms present among the photos, for the picker's filter. */
export const photoRooms: RoomTag[] = photoScenesOn ? (Array.from(new Set(M.photos.map((p) => p.room).filter(Boolean))) as RoomTag[]) : [];

/** Numbers holding distinct variants, optionally of one room. */
function distinctNumbers(room?: RoomTag | null) {
  const out: number[] = [];
  for (let i = 0; i < SCENE_SLOTS; i++) if (M.r?.[i] !== "1" && (!room || M.photos[M.p[i]]?.room === room)) out.push(i);
  return out;
}

function shuffle<T>(arr: T[], seed: number) {
  const a = arr.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Up to `count` numbers, one per photo first, so a page shows different rooms rather than crops of one. */
function spread(nums: number[], count: number) {
  const seen = new Set<number>();
  const first: number[] = [], rest: number[] = [];
  for (const n of nums) (seen.has(M.p[n]) ? rest : (seen.add(M.p[n]), first)).push(n);
  return [...first, ...rest].slice(0, count);
}

/** Picker suggestions in photo mode. */
export function photoSuggest(key: string, round = 0, room?: RoomTag | null, count = 24) {
  return spread(shuffle(distinctNumbers(room), hash32(`suggest:${key}:${round}:${room || "all"}`)), count);
}

/** The scenes a buyer sees: the artist's picks, else five auto-picked (different photos when photo scenes exist). */
export function scenesForArt(art: { slug: string; roomScenes?: number[] | null }) {
  if (!photoScenesOn) return scenesFor(art);
  const picks = (art.roomScenes || []).filter((n) => Number.isInteger(n) && n >= 0 && n < SCENE_SLOTS).slice(0, 5);
  return picks.length ? picks : autoPhotoScenes(art.slug);
}

export function autoPhotoScenes(key: string, count = 5) {
  if (!photoScenesOn) return autoScenes(key, count);
  // daylight first: skip evening grades for the opening slide
  const nums = shuffle(distinctNumbers(), hash32(`auto:${key}`));
  const day = nums.filter((n) => M.g[n] !== "e");
  return spread(Array.from(new Set([...day, ...nums])), count);
}
