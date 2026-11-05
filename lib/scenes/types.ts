// Photo scenes: shared types and vocabularies (client- and server-safe, no Node imports).
import type { P } from "./geometry";

export type PrintSizeKey = "small" | "medium" | "large" | "xl";
export type FrameKey = "none" | "black" | "white" | "natural";
export const PRINT_SIZE_KEYS: PrintSizeKey[] = ["small", "medium", "large", "xl"];
export const FRAME_KEYS: FrameKey[] = ["none", "black", "white", "natural"];

/** Reference objects with a known height, in inches. Draw the line on the object, ideally against the wall. */
export const REF_KINDS = [
  { key: "adult", label: "Standing adult", inches: 66 },
  { key: "seated", label: "Seated adult, head from floor", inches: 50 },
  { key: "door", label: "Interior door", inches: 80 },
  { key: "sofa", label: "Sofa back", inches: 32 },
  { key: "table", label: "Dining table", inches: 30 },
  { key: "counter", label: "Kitchen counter", inches: 36 },
  { key: "chair", label: "Chair seat", inches: 18 },
  { key: "custom", label: "Custom", inches: 0 },
] as const;
export type RefKind = (typeof REF_KINDS)[number]["key"];
export const REF2_KINDS = [
  { key: "doorw", label: "Interior door width", inches: 32 },
  { key: "doorframe", label: "Door with trim, width", inches: 39 },
  { key: "outlet", label: "Outlet plate width", inches: 2.75 },
  { key: "custom", label: "Custom", inches: 0 },
] as const;
export type Ref2Kind = (typeof REF2_KINDS)[number]["key"];

export const ROOM_TAGS = ["living", "cafe", "bedroom", "office", "gallery", "kitchen"] as const;
export type RoomTag = (typeof ROOM_TAGS)[number];
export const ROOM_TAG_LABEL: Record<RoomTag, string> = {
  living: "Living room",
  cafe: "Café",
  bedroom: "Bedroom",
  office: "Office",
  gallery: "Gallery",
  kitchen: "Kitchen",
};
/** Flags besides the room. `no-mirror` keeps text/signage from being flipped in variants. */
export const FLAG_TAGS = ["person", "warm", "cool", "no-mirror"] as const;
export type FlagTag = (typeof FLAG_TAGS)[number];

export type Grade = "n" | "w" | "c" | "e"; // neutral, warm, cool, evening
export const GRADE_LABEL: Record<Grade, string> = { n: "", w: "warm light", c: "cool light", e: "evening" };

/** One annotated photo: scenes/annotations/<id>.json. All points are in pixels of the upright image. */
export type SceneAnnotation = {
  id: string;
  version: 1;
  /** Upright image size the points refer to. */
  image: { w: number; h: number };
  status?: "ok" | "rejected";
  /** Usable wall region: a real-world rectangle on the wall, as TL, TR, BR, BL in the image. */
  quad: [P, P, P, P];
  /** Where the artwork's center goes. anchors[0] is primary; up to 2 more (left/right) feed variants. */
  anchors: P[];
  /** A line on an object of known height, as close to the wall's depth as possible. */
  ref: { a: P; b: P; kind: RefKind; inches: number };
  /**
   * Optional second reference running across the wall (e.g. a door's width), for oblique walls shot with a level
   * camera, where the photo alone can't tell how wide the wall is. Fixes the horizontal scale.
   */
  ref2?: { a: P; b: P; kind: Ref2Kind; inches: number } | null;
  /** Optional 35mm-equivalent focal length (mm). Only used when the quad has too little perspective to tell. */
  lens?: number | null;
  /** Average wall color under the light (auto-sampled from the quad, editable). */
  tint: string;
  /** Direction the shadow falls in the image (degrees, 0 = right, 90 = down) and its strength 0–1. */
  shadow: { angle: number; strength: number };
  /** Room tag plus flags. */
  tags: string[];
  /** Extra brightness for the art (1 = auto from the tint). Lower in dim rooms, higher on dark-painted walls. */
  exposure?: number;
  /** Photo softness to match, in px of a 1600px-wide output (0–2). Default 0.4. */
  softness?: number;
  /** Filled in on save/build. */
  computed?: { ppi: number; wallIn: { w: number; h: number }; focal: number; focalSource: string; usableSizes: PrintSizeKey[] };
  updatedAt?: string;
};

/** Credit info saved next to a photo (scenes/photos/<id>.json). */
export type PhotoCredit = {
  photographer?: string;
  photographerUrl?: string;
  url?: string;
  pexelsId?: number;
  source?: string; // "Pexels", or your own
  license?: string;
  query?: string;
  alt?: string;
  fixture?: boolean;
  note?: string;
};

/** The small manifest the browser imports (data/scenes-client.json). */
export type ClientManifest = {
  v: 1;
  rev: string;
  /** Distinct photo variants behind the 1,000 numbers (0 = photo scenes off). */
  count: number;
  photos: { id: string; room: RoomTag | null; label: string; credit: string | null; url: string | null; fixture?: boolean }[];
  /** Photo index per scene number 0–999. */
  p: number[];
  /** Grade letter per scene number (a 1,000-char string). */
  g: string;
  /** "1" where the number repeats an earlier variant (a 1,000-char string). */
  r: string;
};

export function creditLine(c: PhotoCredit | null | undefined): string | null {
  if (!c) return null;
  if (c.fixture) return "Synthetic test fixture, not a photo";
  if (!c.photographer) return c.source ? `Photo: ${c.source}` : null;
  return `Photo: ${c.photographer}${c.source ? ` / ${c.source}` : ""}`;
}

export function roomOf(tags: string[]): RoomTag | null {
  return (ROOM_TAGS as readonly string[]).find((t) => tags.includes(t)) as RoomTag | undefined ?? null;
}
