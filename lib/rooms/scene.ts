// Room scenes 0–999: deterministic, layered SVG, with the print hung at true size.
import { COMPS, type Hang, type Kit } from "./compositions";
import { FLOOR, ID, K, Y, f, fx, line, op, poly, rect, type Ctx } from "./draw";
import { BRICKS, CARPETS, CERAMICS, CONCRETES, FLOOR_WOODS, METALS, PALETTES, TILES, WOODS, lum, mix, shade, type Palette } from "./palettes";
import { hashString, rng, shuffled, type Rng } from "./rng";

export const SCENE_COUNT = 1000;
export const ROOM_TYPES = ["living", "kitchen", "office", "bedroom", "dining", "hallway", "cafe", "nook"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const ROOM_LABEL: Record<RoomType, string> = {
  living: "Living room",
  kitchen: "Kitchen",
  office: "Office",
  bedroom: "Bedroom",
  dining: "Dining room",
  hallway: "Entry",
  cafe: "Café wall",
  nook: "Reading nook",
};

export type RoomSize = "small" | "medium" | "large" | "xl";
export type RoomFrame = "black" | "white" | "natural";
/** Print sizes in inches, short side × long side. */
export const ROOM_SIZE_IN: Record<RoomSize, [number, number]> = { small: [5, 7], medium: [8, 12], large: [11, 17], xl: [18, 24] };
const MAT: Record<RoomSize, number> = { small: 1.5, medium: 2, large: 2.5, xl: 3 };
const MOLD: Record<RoomSize, number> = { small: 0.9, medium: 1, large: 1.1, xl: 1.25 };
export const FRAME_HEX: Record<RoomFrame, string> = { black: "#1a1b1f", white: "#f7f6f2", natural: "#c49a68" };

type Finish = "paint" | "plaster" | "panel" | "brick" | "wallpaper";
type FloorKind = "wood" | "tile" | "concrete" | "carpet";
type Crop = "close" | "standard" | "wide";

const FINISH_W: Record<RoomType, [Finish, number][]> = {
  living: [["paint", 4], ["plaster", 3], ["panel", 2], ["brick", 1], ["wallpaper", 2]],
  kitchen: [["paint", 4], ["plaster", 3], ["panel", 2], ["brick", 2], ["wallpaper", 1]],
  office: [["paint", 4], ["plaster", 2], ["panel", 3], ["brick", 1], ["wallpaper", 1]],
  bedroom: [["paint", 4], ["plaster", 3], ["panel", 2], ["brick", 0.5], ["wallpaper", 3]],
  dining: [["paint", 3], ["plaster", 3], ["panel", 3], ["brick", 1], ["wallpaper", 2]],
  hallway: [["paint", 3], ["plaster", 2], ["panel", 4], ["brick", 1], ["wallpaper", 2]],
  cafe: [["paint", 2], ["plaster", 2], ["panel", 3], ["brick", 4], ["wallpaper", 1]],
  nook: [["paint", 3], ["plaster", 3], ["panel", 3], ["brick", 1], ["wallpaper", 3]],
};
const FLOOR_W: Record<RoomType, [FloorKind, number][]> = {
  living: [["wood", 6], ["concrete", 2], ["carpet", 1]],
  kitchen: [["wood", 3], ["tile", 5], ["concrete", 2]],
  office: [["wood", 5], ["concrete", 2], ["carpet", 2]],
  bedroom: [["wood", 5], ["carpet", 4]],
  dining: [["wood", 5], ["tile", 2], ["concrete", 2]],
  hallway: [["wood", 4], ["tile", 4], ["concrete", 1]],
  cafe: [["tile", 5], ["concrete", 3], ["wood", 2]],
  nook: [["wood", 5], ["carpet", 3]],
};
const TIME_DAY = ["morning", "afternoon", "daylight"] as const;
const CROP_WEIGHT: Record<RoomType, [Crop, number][]> = {
  living: [["close", 3], ["standard", 4], ["wide", 3]],
  kitchen: [["close", 3], ["standard", 4], ["wide", 3]],
  office: [["close", 3], ["standard", 4], ["wide", 3]],
  bedroom: [["close", 1], ["standard", 4], ["wide", 4]],
  dining: [["close", 2], ["standard", 4], ["wide", 3]],
  hallway: [["close", 4], ["standard", 4], ["wide", 2]],
  cafe: [["close", 2], ["standard", 4], ["wide", 4]],
  nook: [["close", 2], ["standard", 4], ["wide", 3]],
};

export type SceneInfo = {
  n: number;
  type: RoomType;
  label: string; // "Living room · evening"
  room: string;
  time: string;
  evening: boolean;
  comp: number;
  palette: string;
  finish: Finish;
  floor: FloorKind;
  crop: Crop;
};

type Roll = SceneInfo & { pal: Palette; side: -1 | 1; seed: number };

function roll(n: number): Roll {
  const i = ((Math.floor(n) % SCENE_COUNT) + SCENE_COUNT) % SCENE_COUNT;
  const r = rng(hashString(`artfinity-room-${i}`));
  const type = ROOM_TYPES[i % ROOM_TYPES.length];
  const comp = r.int(0, COMPS[type].length - 1);
  const pal = r.pick(PALETTES);
  const finish = r.weighted(FINISH_W[type]);
  const floor = r.weighted(FLOOR_W[type]);
  const evening = r.chance(0.34);
  const time = evening ? "evening" : r.pick(TIME_DAY);
  const crop = r.weighted<Crop>(CROP_WEIGHT[type]);
  const side = r.chance(0.5) ? -1 : 1;
  const seed = r.int(1, 2 ** 31 - 2);
  return { n: i, type, comp, pal, palette: pal.key, finish, floor, evening, time, crop, side, seed, room: ROOM_LABEL[type], label: `${ROOM_LABEL[type]} · ${time}` };
}

/** Cheap facts about a scene (no drawing). */
export function sceneInfo(n: number): SceneInfo {
  const { pal: _p, side: _s, seed: _d, ...info } = roll(n);
  return info;
}

function makeKit(r: Rng, pal: Palette, type: RoomType): Kit {
  const fabrics = shuffled(pal.fabrics, r);
  const woodKeys = Object.keys(WOODS) as (keyof typeof WOODS)[];
  const wood = WOODS[r.pick(woodKeys)];
  const wood2 = WOODS[r.pick(woodKeys)];
  const accent = pal.accent;
  const pillowPool = [accent, fabrics[1], fabrics[2], mix(accent, "#ffffff", 0.35), fabrics[3]];
  const nP = r.int(1, 3);
  const caseColor = r.weighted<string>([[wood, 5], [shade(pal.wall, -0.18), 1], [fabrics[3], 1], ["#2d2c2b", 1], ["#ece6da", 1]]);
  const kitchenPaints = ["#ece6da", "#d9d1c3", "#8e9b7c", "#3c4a5a", "#5b6b5a", "#c8b9a3", "#2d2c2b", WOODS.oak, "#b9c3c0"];
  return {
    fabric: fabrics[0],
    fabric2: fabrics[1],
    wood,
    wood2,
    metal: r.pick(METALS),
    ceramic: r.pick(CERAMICS),
    plant: r.weighted([["fig", 3], ["snake", 2], ["olive", 3], ["palm", 2], ["monstera", 2], ["bird", 2]] as const),
    pot: r.pick(["terracotta", "white", "black", "basket", "stone"] as const),
    floorLamp: r.pick(["arc", "tripod", "globe", "cone"] as const),
    tableLamp: r.pick(["gourd", "mushroom", "drum", "globe", "pleat"] as const),
    pendant: r.pick(["dome", "globe", "lantern", "cone"] as const),
    shadeC: r.pick(["#f1ebdf", "#e9dfcc", "#f6f3ec", "#e3d6bf"]),
    rugStyle: r.pick(["border", "stripe", "diamond", "jute", "plain"] as const),
    rugBase: r.pick(["#e7dfd1", "#d8cbb5", "#cbbfa9", mix(pal.wall, "#efe9df", 0.6), "#c2b49c"]),
    rugAccent: r.pick([accent, shade(fabrics[2], -0.1), "#3b3a38", "#8a6a4c"]),
    pillows: Array.from({ length: nP }, (_, i) => pillowPool[(i + r.int(0, 4)) % pillowPool.length]),
    throwColor: r.chance(0.45) ? r.pick([accent, fabrics[2], "#e9e1d0", "#b9714a"]) : null,
    sofaStyle: r.pick(["track", "round", "low", "camel", "tufted"] as const),
    caseStyle: r.pick(["legs", "plinth", "fluted", "cane", "drawers"] as const),
    caseColor,
    chairKind: r.pick(["bentwood", "spindle", "cane", "molded"] as const),
    chairColor: r.pick([WOODS.walnut, WOODS.oak, "#2b2b2b", WOODS.honey, accent]),
    kitchen: r.pick(kitchenPaints),
    worktop: r.pick(["#ece8e1", "#e3ddd2", "#2f2f31", WOODS.oak, "#d9d3c9", "#cfc6b6"]),
    splash: r.pick(["tile", "zellige", "slab", "none"] as const),
    linen: r.pick(["#f5f2ec", "#ece5d9", "#e3ddd2"]),
    duvet: r.pick(["#f3efe8", "#e7e0d4", mix(fabrics[1], "#ffffff", 0.6), "#d8d2c6"]),
    head: r.pick(["round", "channel", "slat", "cane", "wing"] as const),
    curtains: r.chance(0.6) ? r.pick(["#efe9df", "#e3d6bf", mix(pal.wall, "#ffffff", 0.5), fabrics[1]]) : null,
    plantH: type === "hallway" ? r.range(44, 58) : r.range(50, 66),
  };
}

// ---------- shared defs ----------
function baseDefs(r: Rng, roll: Roll, crop: { x: number; y: number; w: number; h: number }) {
  const fr = `filterUnits="userSpaceOnUse" x="${f(crop.x - 4)}" y="${f(crop.y - 4)}" width="${f(crop.w + 8)}" height="${f(crop.h + 8)}"`;
  const d = [
    `<radialGradient id="${ID}cs"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".55" stop-color="#000" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="${ID}gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>`,
    `<linearGradient id="${ID}gh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>`,
    `<linearGradient id="${ID}rugsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`,
    `<filter id="${ID}soft" ${fr}><feGaussianBlur stdDeviation="1.2"/></filter>`,
    `<filter id="${ID}soft3" ${fr}><feGaussianBlur stdDeviation="3"/></filter>`,
    `<pattern id="${ID}cane" width="1.6" height="1.6" patternUnits="userSpaceOnUse"><rect width="1.6" height="1.6" fill="#d9c49c"/><path d="M0 0L1.6 1.6M1.6 0L0 1.6M.8 0V1.6M0 .8H1.6" stroke="#a88a5a" stroke-width=".22"/></pattern>`,
    `<pattern id="${ID}weave" width="2" height="1.6" patternUnits="userSpaceOnUse"><path d="M0 .4H2M0 1.2H2" stroke="#8d6c43" stroke-width=".3" opacity=".6"/><path d="M1 0V.8M0 .8V1.6M2 .8V1.6" stroke="#8d6c43" stroke-width=".25" opacity=".5"/></pattern>`,
    `<pattern id="${ID}tile" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f4f1ea"/><path d="M0 .1H6M0 3.1H6M3 0V3M0 3V6M6 3V6" stroke="#d6d0c4" stroke-width=".22"/></pattern>`,
  ];
  // zellige: squares with a little color wobble
  const zc = r.pick(["#e9e4da", "#a9b8ae", "#6f8a8a", "#d9b9a0", "#2f4a52"]);
  let z = `<pattern id="${ID}zellige" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="#cfc8bb"/>`;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) z += rect(i * 4 + 0.15, j * 4 + 0.15, 3.7, 3.7, shade(zc, r.range(-0.08, 0.1)));
  d.push(z + `</pattern>`);
  return d;
}

// ---------- the wall ----------
function drawWall(c: Ctx, r: Rng, roll: Roll, crop: { x: number; y: number; w: number; h: number }) {
  const { pal, finish } = roll;
  const X0 = crop.x - 10;
  const W = crop.w + 20;
  const out: string[] = [];
  let wallColor = pal.wall;
  const fr = `filterUnits="userSpaceOnUse" x="${f(X0)}" y="${f(crop.y - 4)}" width="${f(W)}" height="${f(FLOOR - crop.y + 8)}"`;
  out.push(rect(X0, crop.y - 10, W, FLOOR - crop.y + 10, wallColor));

  if (finish === "plaster") {
    const id = `${ID}mot`;
    c.defs.push(
      `<filter id="${id}" ${fr}><feTurbulence type="fractalNoise" baseFrequency="${f(r.range(0.06, 0.1))}" numOctaves="4" seed="${r.int(1, 999)}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  2.2 0 0 0 -1.05"/></filter>`,
      `<filter id="${id}b" ${fr}><feTurbulence type="fractalNoise" baseFrequency="${f(r.range(0.08, 0.14))}" numOctaves="4" seed="${r.int(1, 999)}"/><feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.08  0 0 0 0 0.05  2.4 0 0 0 -1.25"/></filter>`,
    );
    out.push(rect(X0, crop.y - 4, W, FLOOR - crop.y + 4, "#fff", ` filter="url(#${id})" opacity="${pal.dark ? 0.1 : 0.22}"`));
    out.push(rect(X0, crop.y - 4, W, FLOOR - crop.y + 4, "#000", ` filter="url(#${id}b)" opacity="${pal.dark ? 0.18 : 0.1}"`));
  } else if (finish === "panel") {
    const kind = r.pick(["wainscot", "boards", "slats"] as const);
    if (kind === "wainscot") {
      const h = r.pick([36, 40, 44]);
      const pc = r.chance(0.5) ? wallColor : r.chance(0.5) ? pal.trim : shade(wallColor, -0.12);
      const top = Y(h);
      out.push(rect(X0, top, W, FLOOR - top, pc));
      const pw = r.pick([18, 22, 26]);
      for (let x = Math.floor(X0 / pw) * pw; x < X0 + W; x += pw) {
        out.push(rect(x + 2.5, top + 4, pw - 5, FLOOR - top - 10, "none", ` stroke="${shade(pc, -0.14)}" stroke-width=".35"`));
        out.push(rect(x + 2.9, top + 4.4, pw - 5.8, 0.25, shade(pc, 0.12)));
      }
      out.push(rect(X0, top - 1.6, W, 2, shade(pc, 0.06)), rect(X0, top + 0.4, W, 0.4, "#000", op(0.12)));
    } else if (kind === "boards") {
      for (let x = Math.floor(X0 / 5) * 5; x < X0 + W; x += 5) out.push(rect(x, crop.y - 10, 0.25, FLOOR - crop.y + 10, shade(wallColor, -0.14)), rect(x + 0.25, crop.y - 10, 0.25, FLOOR - crop.y + 10, shade(wallColor, 0.08)));
    } else {
      wallColor = r.pick([WOODS.oak, WOODS.honey, WOODS.walnut, shade(WOODS.oak, 0.15)]);
      out.push(rect(X0, crop.y - 10, W, FLOOR - crop.y + 10, wallColor));
      for (let x = Math.floor(X0 / 2.5) * 2.5; x < X0 + W; x += 2.5) out.push(rect(x, crop.y - 10, 0.55, FLOOR - crop.y + 10, shade(wallColor, -0.35)), rect(x + 0.55, crop.y - 10, 0.35, FLOOR - crop.y + 10, shade(wallColor, 0.1), op(0.5)));
    }
  } else if (finish === "brick") {
    const b = pal.dark ? r.pick([BRICKS[0], BRICKS[3], BRICKS[2]]) : r.pick([BRICKS[0], BRICKS[1], BRICKS[1], BRICKS[2]]);
    wallColor = b.base;
    const id = `${ID}brick`;
    const bw = 8.375;
    const bh = 2.625;
    const cols = 7;
    const rows = 12;
    let p = `<pattern id="${id}" width="${f(bw * cols)}" height="${f(bh * rows)}" patternUnits="userSpaceOnUse"><rect width="${f(bw * cols)}" height="${f(bh * rows)}" fill="${b.mortar}"/>`;
    for (let row = 0; row < rows; row++) {
      const off = row % 2 ? bw / 2 : 0;
      const first: string = r.pick(b.vary);
      for (let k = -1; k < cols; k++) {
        // the wrapped brick must match its twin on the other edge
        const col = k === -1 || k === cols - 1 ? first : r.pick(b.vary);
        p += rect(k * bw + off + 0.19, row * bh + 0.19, bw - 0.38, bh - 0.38, shade(col, r.range(-0.04, 0.04)));
      }
    }
    p += `</pattern>`;
    c.defs.push(
      p,
      `<filter id="${id}n" ${fr}><feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves="2" seed="${r.int(1, 999)}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 -0.75"/></filter>`,
      `<filter id="${id}m" ${fr}><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="${r.int(1, 999)}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2 -0.9"/></filter>`,
    );
    out.push(rect(X0, crop.y - 10, W, FLOOR - crop.y + 10, `url(#${id})`));
    out.push(rect(X0, crop.y - 4, W, FLOOR - crop.y + 4, "#000", ` filter="url(#${id}m)" opacity=".16"`));
    out.push(rect(X0, crop.y - 4, W, FLOOR - crop.y + 4, "#000", ` filter="url(#${id}n)" opacity=".12"`));
  } else if (finish === "wallpaper") {
    const kind = r.pick(["stripe", "sprig", "grid", "scallop", "leaf"] as const);
    const ink = lum(wallColor) > 0.55 ? mix(wallColor, pal.accent, 0.3) : shade(wallColor, 0.12);
    const id = `${ID}wp`;
    let p = "";
    if (kind === "stripe") {
      const s = r.pick([3, 4, 6]);
      p = `<pattern id="${id}" width="${s}" height="10" patternUnits="userSpaceOnUse"><rect width="${f(s * 0.45)}" height="10" fill="${ink}" opacity=".55"/></pattern>`;
    } else if (kind === "grid") {
      p = `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 .1H6M.1 0V6" stroke="${ink}" stroke-width=".3"/></pattern>`;
    } else if (kind === "scallop") {
      p = `<pattern id="${id}" width="6" height="4" patternUnits="userSpaceOnUse"><path d="M0 4 A3 3 0 0 1 6 4 M-3 2 A3 3 0 0 1 3 2 M3 2 A3 3 0 0 1 9 2" fill="none" stroke="${ink}" stroke-width=".35"/></pattern>`;
    } else if (kind === "sprig") {
      p = `<pattern id="${id}" width="9" height="10" patternUnits="userSpaceOnUse"><g fill="${ink}"><path d="M2 3 q1.2 -2 2.4 0 q-1.2 1 -2.4 0z"/><path d="M3.2 3 v2.2" stroke="${ink}" stroke-width=".2"/><path d="M6.5 8 q1.2 -2 2.4 0 q-1.2 1 -2.4 0z" transform="rotate(30 7.7 8)"/></g></pattern>`;
    } else {
      p = `<pattern id="${id}" width="24" height="28" patternUnits="userSpaceOnUse"><g fill="${ink}" opacity=".7"><path d="M4 22 Q2 12 10 6 Q12 14 4 22Z"/><path d="M16 12 Q22 6 22 0 Q14 4 16 12Z"/><path d="M14 28 Q20 20 18 14 Q12 20 14 28Z"/></g></pattern>`;
    }
    c.defs.push(p);
    out.push(rect(X0, crop.y - 10, W, FLOOR - crop.y + 10, `url(#${id})`));
  }
  // paint gets a soft vertical breath
  out.push(rect(X0, crop.y - 10, W, FLOOR - crop.y + 10, `url(#${ID}wallv)`));
  c.defs.push(`<linearGradient id="${ID}wallv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="${roll.evening ? 0.12 : 0.05}"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset=".92" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>`);
  return { svg: out.join(""), wallColor };
}

/** Ambient occlusion: the wall darkens a little toward the floor and the corner where they meet. */
function drawAO(c: Ctx, X0: number, W: number) {
  c.defs.push(`<linearGradient id="${ID}ao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a130d" stop-opacity="0"/><stop offset=".7" stop-color="#1a130d" stop-opacity=".07"/><stop offset="1" stop-color="#1a130d" stop-opacity=".2"/></linearGradient>`);
  return rect(X0, Y(16), W, 16, `url(#${ID}ao)`);
}

function drawBaseboard(roll: Roll, X0: number, W: number, wallColor: string) {
  const bb = roll.finish === "brick" ? 0 : 5;
  if (!bb) return rect(X0, FLOOR - 0.6, W, 0.6, "#000", op(0.25));
  const col = roll.finish === "panel" && roll.pal.dark ? wallColor : roll.pal.trim;
  return rect(X0, Y(bb), W, bb, col) + rect(X0, Y(bb), W, 0.5, shade(col, 0.08)) + rect(X0, FLOOR - 0.4, W, 0.4, "#000", op(0.2));
}

// ---------- the floor ----------
function drawFloor(c: Ctx, r: Rng, roll: Roll, crop: { x: number; y: number; w: number; h: number }) {
  const out: string[] = [];
  const X0 = crop.x - 10;
  const W = crop.w + 20;
  const bottom = crop.y + crop.h + 2;
  if (bottom <= FLOOR) return "";
  const dMax = (bottom - FLOOR) / K + 4;
  const fr = `filterUnits="userSpaceOnUse" x="${f(X0)}" y="${f(FLOOR)}" width="${f(W)}" height="${f(bottom - FLOOR + 2)}"`;
  const rad = (x: number, stroke: string, w: number) => line(x, FLOOR, fx(c, x, dMax), Y(0, dMax), stroke, w);
  if (roll.floor === "wood") {
    const fw = r.pick(FLOOR_WOODS);
    out.push(rect(X0, FLOOR, W, bottom - FLOOR, fw.base));
    const pw = r.pick([5, 6, 7.5]);
    const across = r.chance(0.3);
    if (!across) {
      for (let x = Math.floor((X0 - 60) / pw) * pw; x < X0 + W + 60; x += pw) {
        out.push(rad(x, fw.line, 0.22));
        // a few joints along each plank
        let d = r.range(4, 40);
        while (d < dMax) {
          const a: [number, number] = [fx(c, x, d), Y(0, d)];
          const b: [number, number] = [fx(c, x + pw, d), Y(0, d)];
          out.push(line(a[0], a[1], b[0], b[1], fw.line, 0.2));
          d += r.range(30, 60);
        }
        if (r.chance(0.35)) out.push(poly([[x, FLOOR], [x + pw, FLOOR], [fx(c, x + pw, dMax), Y(0, dMax)], [fx(c, x, dMax), Y(0, dMax)]], shade(fw.base, r.range(-0.06, 0.05)), op(0.6)));
      }
    } else {
      for (let d = 0; d < dMax; d += pw) {
        out.push(line(X0, Y(0, d), X0 + W, Y(0, d), fw.line, 0.2));
        let x = X0 + r.range(-30, 0);
        while (x < X0 + W) {
          out.push(line(fx(c, x, d), Y(0, d), fx(c, x, d + pw), Y(0, d + pw), fw.line, 0.2));
          x += r.range(30, 55);
        }
      }
    }
  } else if (roll.floor === "tile") {
    const t = r.pick(TILES);
    out.push(rect(X0, FLOOR, W, bottom - FLOOR, t.grout));
    const s = t.checker ? 12 : r.pick([8, 12]);
    for (let d = 0; d < dMax; d += s) {
      for (let x = Math.floor((X0 - 80) / s) * s; x < X0 + W + 80; x += s) {
        const odd = (Math.round(x / s) + Math.round(d / s)) % 2 !== 0;
        const fill = t.checker ? (odd ? t.b : t.a) : shade(odd ? t.a : t.b, r.range(-0.03, 0.03));
        const g = 0.15;
        out.push(poly([[fx(c, x + g, d + g), Y(0, d + g)], [fx(c, x + s - g, d + g), Y(0, d + g)], [fx(c, x + s - g, d + s - g), Y(0, d + s - g)], [fx(c, x + g, d + s - g), Y(0, d + s - g)]], fill));
      }
    }
  } else if (roll.floor === "concrete") {
    const cc = r.pick(CONCRETES);
    out.push(rect(X0, FLOOR, W, bottom - FLOOR, cc));
    const id = `${ID}conc`;
    c.defs.push(`<filter id="${id}" ${fr}><feTurbulence type="fractalNoise" baseFrequency=".06 .22" numOctaves="3" seed="${r.int(1, 999)}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 -0.7"/></filter>`);
    out.push(rect(X0, FLOOR, W, bottom - FLOOR, "#000", ` filter="url(#${id})" opacity=".18"`));
    out.push(rad(c.vpx + r.range(-50, 50), shade(cc, -0.12), 0.18));
  } else {
    const cc = r.pick(CARPETS);
    out.push(rect(X0, FLOOR, W, bottom - FLOOR, cc));
    const id = `${ID}carp`;
    c.defs.push(`<filter id="${id}" ${fr}><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="${r.int(1, 999)}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.2 -0.45"/></filter>`);
    out.push(rect(X0, FLOOR, W, bottom - FLOOR, "#000", ` filter="url(#${id})" opacity=".12"`));
  }
  // where wall meets floor, and the foreground falls off
  c.defs.push(`<linearGradient id="${ID}flo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".12" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient>`);
  out.push(rect(X0, FLOOR, W, bottom - FLOOR, `url(#${ID}flo)`));
  return out.join("");
}

// ---------- light ----------
function drawLight(c: Ctx, r: Rng, roll: Roll, crop: { x: number; y: number; w: number; h: number }, hang: Hang, hasWindow: boolean) {
  const out: string[] = [];
  const X0 = crop.x - 10;
  const W = crop.w + 20;
  const top = crop.y - 10;
  const H = crop.h + 20;
  if (!roll.evening) {
    // sun patches from a window just out of frame (or the one in frame)
    if (!hasWindow || r.chance(0.5)) {
      const s = roll.side;
      const baseX = hang.cx - s * r.range(30, 60);
      const pw = r.range(11, 15);
      const ph = r.range(16, 22);
      const skew = s * r.range(10, 22);
      const y0 = Y(r.range(70, 92));
      const panes: string[] = [];
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const x = baseX + i * (pw + 1.4) + j * skew * 0.5;
          const y = y0 + j * (ph + 1.4);
          panes.push(poly([[x, y], [x + pw, y], [x + pw + skew * 0.5, y + ph], [x + skew * 0.5, y + ph]], "#fff7e2"));
        }
      out.push(`<g opacity="${f(r.range(0.16, 0.26))}" filter="url(#${ID}soft)">${panes.join("")}</g>`);
      if (r.chance(0.4)) {
        // a few leaf shadows drift through the light
        const leaves: string[] = [];
        for (let i = 0; i < 9; i++) leaves.push(`<ellipse cx="${f(baseX + r.range(0, pw * 2 + skew))}" cy="${f(y0 + r.range(0, ph * 2))}" rx="${f(r.range(1, 2.4))}" ry="${f(r.range(3, 5))}" transform="rotate(${f(r.range(-50, 50))} ${f(baseX + pw)} ${f(y0 + ph)})" fill="#2b2a24"/>`);
        out.push(`<g opacity=".08" filter="url(#${ID}soft)">${leaves.join("")}</g>`);
      }
    }
    // soft window light: a broad warm wash from the window side, falling off across the room
    const sx = roll.side < 0 ? 0 : 1;
    c.defs.push(
      `<linearGradient id="${ID}side" x1="${sx}" y1="0" x2="${1 - sx}" y2="0"><stop offset="0" stop-color="#fff6e4" stop-opacity=".2"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#1c1610" stop-opacity=".12"/></linearGradient>`,
      `<radialGradient id="${ID}win" cx="${sx}" cy=".18" r=".85"><stop offset="0" stop-color="#fffaf0" stop-opacity=".22"/><stop offset=".5" stop-color="#fff8ec" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
    );
    out.push(rect(X0, top, W, H, `url(#${ID}side)`), rect(X0, top, W, H, `url(#${ID}win)`));
  } else {
    // evening: a warm dusk grade, lightest around the print (as if a lamp or picture light falls on it), darker toward
    // the ceiling and the corners. Warm rather than grey-violet so pale fabrics and walls don't go lilac.
    const ay = hang.base != null ? Y(hang.base + 12) : Y(hang.center ?? 58);
    c.defs.push(
      `<radialGradient id="${ID}eve" gradientUnits="userSpaceOnUse" cx="${f(hang.cx)}" cy="${f(ay)}" r="${f(crop.w * 0.85)}"><stop offset="0" stop-color="#f6ecdc"/><stop offset=".35" stop-color="#e3d2bd"/><stop offset=".75" stop-color="#c2ae9b"/><stop offset="1" stop-color="#a59383"/></radialGradient>`,
      `<linearGradient id="${ID}evc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a130d" stop-opacity=".22"/><stop offset=".4" stop-color="#1a130d" stop-opacity="0"/></linearGradient>`,
    );
    out.push(rect(X0, top, W, H, `url(#${ID}eve)`, ` style="mix-blend-mode:multiply"`), rect(X0, top, W, H, `url(#${ID}evc)`));
  }
  return out.join("");
}

function drawGlow(c: Ctx) {
  if (!c.evening) return "";
  c.defs.push(`<radialGradient id="${ID}warm"><stop offset="0" stop-color="#ffd8a0" stop-opacity=".85"/><stop offset=".22" stop-color="#ffc67a" stop-opacity=".38"/><stop offset=".55" stop-color="#e8a060" stop-opacity=".1"/><stop offset="1" stop-color="#ffb860" stop-opacity="0"/></radialGradient>`);
  // the glow stays a halo around the bulb: big soft discs screened over pale bedding read as fog
  return c.lights.map((l) => `<circle cx="${f(l.x)}" cy="${f(l.y)}" r="${f(l.r * 0.85)}" fill="url(#${ID}warm)" opacity="${f(Math.min(0.9, l.a * 1.05))}" style="mix-blend-mode:screen"/>`).join("");
}

// ---------- crop ----------
const CROP_W: Record<Crop, number> = { close: 96, standard: 118, wide: 144 };
export const ASPECT = 5 / 4;
/** Largest framed outline (XL, framed, with mat) so every size fits every crop. */
const XL_MAX = 24 + 2 * (MAT.xl + MOLD.xl);

function cropFor(roll: Roll, hang: Hang, focus: number, r: Rng) {
  const w = CROP_W[roll.crop];
  const h = w / ASPECT;
  const artBottom = hang.base ?? (hang.center ?? 58) - XL_MAX / 2;
  const artTop = artBottom + XL_MAX;
  const fb = roll.crop === "wide" ? 24 : roll.crop === "standard" ? 15 : 6;
  let y = FLOOR + fb - h;
  y = Math.min(y, Y(artTop + 6));
  let cx = hang.cx + (focus - hang.cx) * 0.5 + r.range(-0.06, 0.06) * w;
  const half = w / 2;
  const margin = XL_MAX / 2 + 5;
  cx = Math.min(Math.max(cx, hang.cx + margin - half), hang.cx - margin + half);
  return { x: cx - half, y, w, h };
}

// ---------- build + cache ----------
type Built = { info: SceneInfo; viewBox: string; defs: string; under: string; over: string; hang: Hang; side: -1 | 1; evening: boolean; camX: number; cropW: number };
const cache = new Map<number, Built>();

export function buildScene(n: number): Built {
  const ro = roll(n);
  const hit = cache.get(ro.n);
  if (hit) return hit;
  const r = rng(ro.seed);
  const kit = makeKit(r, ro.pal, ro.type);
  const comps = COMPS[ro.type];
  const comp = comps[ro.comp % comps.length];

  // first pass decides the hang spot and focus; the crop depends on them, and the floor perspective on the crop.
  const probe = (vpx: number): Ctx => ({ r: rng(ro.seed ^ 0x5bd1e995), pal: ro.pal, evening: ro.evening, side: ro.side, vpx, defs: [], wall: [], floor: [], front: [], glow: [], lights: [], n: 0 });
  const dry = comp(probe(100), kit);
  const crop = cropFor(ro, dry.hang, dry.focus, r);
  const c = probe(crop.x + crop.w / 2);
  const res = comp(c, kit);

  const defs = baseDefs(r, ro, crop);
  const wall = drawWall(c, r, ro, crop);
  const floor = drawFloor(c, r, ro, crop);
  const base = drawBaseboard(ro, crop.x - 10, crop.w + 20, wall.wallColor) + drawAO(c, crop.x - 10, crop.w + 20);
  const light = drawLight(c, r, ro, crop, res.hang, !!res.window);
  const glow = drawGlow(c);
  // a soft vignette, like a lens
  defs.push(`<radialGradient id="${ID}vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${ro.evening ? 0.3 : 0.14}"/></radialGradient>`);
  const vig = rect(crop.x, crop.y, crop.w, crop.h, `url(#${ID}vig)`);

  const built: Built = {
    info: sceneInfo(ro.n),
    viewBox: `${f(crop.x)} ${f(crop.y)} ${f(crop.w)} ${f(crop.h)}`,
    defs: defs.concat(c.defs).join(""),
    under: wall.svg + c.wall.join("") + floor + base + c.floor.join(""),
    over: c.front.join("") + light + c.glow.join("") + glow + vig,
    hang: res.hang,
    side: ro.side,
    evening: ro.evening,
    camX: crop.x + crop.w / 2,
    cropW: crop.w,
  };
  if (cache.size > 400) cache.delete(cache.keys().next().value as number);
  cache.set(ro.n, built);
  return built;
}

// ---------- the print ----------
export type ArtOpts = {
  href: string;
  /** Image width / height. Landscape prints when > 1.05. */
  aspect?: number;
  size: RoomSize;
  frame?: RoomFrame | null;
  mat?: boolean;
  blur?: boolean;
};

/** Outline of the print on the wall, in inches. */
export function printBox(size: RoomSize, aspect = 0.8, frame?: RoomFrame | null, mat = true) {
  const [a, b] = ROOM_SIZE_IN[size];
  const land = aspect > 1.05;
  const w = land ? b : a;
  const h = land ? a : b;
  const m = frame && mat ? MAT[size] : 0;
  const mo = frame ? MOLD[size] : 0;
  return { w, h, mat: m, mold: mo, W: w + 2 * (m + mo), H: h + 2 * (m + mo), land };
}

function artSVG(b: Built, o: ArtOpts) {
  const box = printBox(o.size, o.aspect, o.frame, o.mat ?? true);
  const { hang } = b;
  const bottom = hang.base != null ? hang.base : (hang.center ?? 58) - box.H / 2;
  const x0 = hang.cx - box.W / 2;
  const y0 = Y(bottom + box.H);
  const x1 = x0 + box.W;
  const y1 = y0 + box.H;
  const out: string[] = [];
  const framed = !!o.frame;
  // How far it stands off the wall (in): a frame about an inch, a bare print on its backing a hair.
  const depth = framed ? 0.9 + box.mold * 0.35 : 0.12;
  // Daylight comes from the window side and above; evening lamps are lower and closer, so shadows fall nearly straight down.
  const lx = b.evening ? -b.side * 0.25 : -b.side;
  const dx = lx * depth * 0.6;
  const dy = depth * (b.evening ? 0.95 : 0.8);
  const fr = (id: string, sd: number) =>
    `<filter id="${ID}${id}" filterUnits="userSpaceOnUse" x="${f(x0 - 8)}" y="${f(y0 - 8)}" width="${f(box.W + 16)}" height="${f(box.H + 16)}"><feGaussianBlur stdDeviation="${f(sd)}"/></filter>`;
  out.push(fr("ash", depth * 0.95 + 0.25), fr("ash2", 0.12 + depth * 0.12));
  // cast shadow: wide and soft, pushed away from the light; then a tight contact shadow hugging the edges
  out.push(rect(x0 + dx * 1.5, y0 + dy * 1.5, box.W, box.H, "#1d150e", ` opacity="${framed ? 0.3 : 0.16}" filter="url(#${ID}ash)"`));
  out.push(rect(x0 + dx * 0.3, y0 + dy * 0.35, box.W, box.H, "#120c07", ` opacity="${framed ? 0.42 : 0.26}" filter="url(#${ID}ash2)"`));
  // light falloff across the piece (lit side a touch brighter)
  const ls = b.side < 0 ? 0 : 1;
  out.push(`<linearGradient id="${ID}afall" x1="${ls}" y1="0" x2="${1 - ls}" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".07"/></linearGradient>`);
  let ix = x0;
  let iy = y0;
  if (framed) {
    const fc = FRAME_HEX[o.frame!];
    const mo = box.mold;
    // the frame's side face, seen when the piece hangs off to one side of the camera
    const off = Math.max(-1, Math.min(1, (hang.cx - b.camX) / (b.cropW / 2)));
    const sw = Math.min(0.55, Math.abs(off) * depth * 0.5);
    if (sw > 0.05) {
      const sxe = off < 0 ? x1 : x0;
      const s = off < 0 ? 1 : -1;
      out.push(poly([[sxe, y0], [sxe + s * sw, y0 + sw * 0.4], [sxe + s * sw, y1 - sw * 0.2], [sxe, y1]], shade(fc, o.frame === "white" ? -0.16 : -0.32)));
    }
    out.push(rect(x0, y0, box.W, box.H, fc));
    if (o.frame === "natural") out.push(rect(x0, y0, box.W, box.H, `url(#${ID}grain)`));
    // molding: light catches the top and the window-side edge, the other two fall into shade
    const hiA = o.frame === "black" ? 0.14 : 0.3;
    const top = poly([[x0, y0], [x1, y0], [x1 - mo, y0 + mo], [x0 + mo, y0 + mo]], "#fff", op(hiA));
    const bot = poly([[x0, y1], [x1, y1], [x1 - mo, y1 - mo], [x0 + mo, y1 - mo]], "#000", op(0.2));
    const left = poly([[x0, y0], [x0 + mo, y0 + mo], [x0 + mo, y1 - mo], [x0, y1]], b.side < 0 ? "#fff" : "#000", op(b.side < 0 ? hiA * 0.7 : 0.12));
    const right = poly([[x1, y0], [x1 - mo, y0 + mo], [x1 - mo, y1 - mo], [x1, y1]], b.side < 0 ? "#000" : "#fff", op(b.side < 0 ? 0.12 : hiA * 0.7));
    out.push(top, bot, left, right);
    // a crisp outer edge and the rabbet where the frame meets the mat
    out.push(rect(x0, y0, box.W, box.H, "none", ` stroke="#000" stroke-opacity="${o.frame === "white" ? 0.16 : 0.22}" stroke-width=".1"`));
    ix += mo;
    iy += mo;
    const iw = box.W - 2 * mo;
    const ih = box.H - 2 * mo;
    out.push(rect(ix, iy, iw, ih, box.mat ? "#f6f3ec" : "#ffffff"));
    // the frame lip shades the mat along the top and the side away from the light
    out.push(`<linearGradient id="${ID}lipt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d150e" stop-opacity=".28"/><stop offset="1" stop-color="#1d150e" stop-opacity="0"/></linearGradient>`);
    out.push(`<linearGradient id="${ID}lips" x1="${1 - ls}" y1="0" x2="${ls}" y2="0"><stop offset="0" stop-color="#1d150e" stop-opacity=".18"/><stop offset="1" stop-color="#1d150e" stop-opacity="0"/></linearGradient>`);
    out.push(rect(ix, iy, iw, Math.min(0.55, ih * 0.08), `url(#${ID}lipt)`));
    out.push(rect(b.side < 0 ? ix + iw - Math.min(0.45, iw * 0.06) : ix, iy, Math.min(0.45, iw * 0.06), ih, `url(#${ID}lips)`));
    ix += box.mat;
    iy += box.mat;
    if (box.mat) {
      // bevel-cut opening: a bright core on the lit edges, a hairline of shade on the others
      const bv = 0.16;
      out.push(rect(ix - bv, iy - bv, box.w + 2 * bv, box.h + 2 * bv, "#fffdf7"));
      out.push(rect(ix - bv, iy - bv, box.w + 2 * bv, 0.07, "#000", op(0.16)));
      out.push(rect(b.side < 0 ? ix + box.w + bv - 0.07 : ix - bv, iy - bv, 0.07, box.h + 2 * bv, "#000", op(0.1)));
    }
  }
  const imgFilter = o.blur ? ` filter="url(#${ID}sblur)"` : "";
  if (o.blur) out.push(`<filter id="${ID}sblur" filterUnits="userSpaceOnUse" x="${f(ix)}" y="${f(iy)}" width="${f(box.w)}" height="${f(box.h)}"><feGaussianBlur stdDeviation="${f(Math.max(box.w, box.h) / 14)}"/></filter>`);
  out.push(`<clipPath id="${ID}aclip"><rect x="${f(ix)}" y="${f(iy)}" width="${f(box.w)}" height="${f(box.h)}"/></clipPath>`);
  out.push(`<g clip-path="url(#${ID}aclip)"><image href="${esc(o.href)}" x="${f(ix)}" y="${f(iy)}" width="${f(box.w)}" height="${f(box.h)}" preserveAspectRatio="xMidYMid slice"${imgFilter}/></g>`);
  if (framed) {
    const gx = x0 + box.mold;
    const gy = y0 + box.mold;
    const gw = box.W - 2 * box.mold;
    const gh = box.H - 2 * box.mold;
    // glass: a soft diagonal reflection band from the window side, and the overall light falloff
    out.push(`<linearGradient id="${ID}glass" x1="${ls}" y1="0" x2="${1 - ls}" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".22" stop-color="#fff" stop-opacity=".04"/><stop offset=".34" stop-color="#fff" stop-opacity="0"/><stop offset=".52" stop-color="#fff" stop-opacity=".06"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
    out.push(rect(gx, gy, gw, gh, `url(#${ID}glass)`), rect(gx, gy, gw, gh, `url(#${ID}afall)`));
  } else {
    // matte paper: just the falloff and a hairline edge
    out.push(rect(ix, iy, box.w, box.h, `url(#${ID}afall)`));
    out.push(rect(ix, iy, box.w, box.h, "none", ` stroke="#000" stroke-opacity=".12" stroke-width=".1"`));
  }
  return out.join("");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Full scene SVG. `idp` keeps def ids unique when several scenes share a page. */
export function renderScene(n: number, art?: ArtOpts | null, o: { idp?: string; title?: string; width?: number; height?: number } = {}) {
  const b = buildScene(n);
  const idp = (o.idp || `r${b.info.n}`).replace(/[^a-zA-Z0-9_-]/g, "");
  const grain = `<linearGradient id="${ID}grain" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".5" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient>`;
  const size = o.width ? ` width="${o.width}" height="${o.height ?? Math.round(o.width / ASPECT)}"` : "";
  const title = o.title ? `<title>${esc(o.title)}</title>` : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${b.viewBox}"${size} preserveAspectRatio="xMidYMid slice" role="img"${o.title ? "" : ' aria-hidden="true"'}>${title}` +
    `<defs>${b.defs}${grain}</defs>${b.under}${art ? artSVG(b, art) : ""}${b.over}</svg>`;
  return svg.split(ID).join(`${idp}_`);
}

// ---------- choosing scenes ----------
const norm = (n: number) => ((Math.round(n) % SCENE_COUNT) + SCENE_COUNT) % SCENE_COUNT;
export const isScene = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < SCENE_COUNT;

/** Scenes of one room type (125 each). */
export function scenesOfType(t: RoomType) {
  const k = ROOM_TYPES.indexOf(t);
  const out: number[] = [];
  for (let n = k; n < SCENE_COUNT; n += ROOM_TYPES.length) out.push(n);
  return out;
}

/**
 * Five scenes picked for an artwork when the artist hasn't chosen: a living room, a kitchen,
 * an office, then two more rooms. Stable for the same key.
 */
export function autoScenes(key: string, count = 5): number[] {
  const r = rng(hashString(`auto:${key}`));
  const order: RoomType[] = ["living", "kitchen", "office", ...shuffled(["bedroom", "dining", "hallway", "cafe", "nook"] as RoomType[], r)];
  return order.slice(0, count).map((t) => {
    const pool = scenesOfType(t);
    // lean toward daylight for the first one: the opening look should be bright
    for (let i = 0; i < 6; i++) {
      const n = r.pick(pool);
      if (t !== "living" || !sceneInfo(n).evening) return n;
    }
    return r.pick(pool);
  });
}

/** The scenes a buyer sees: the artist's picks, else the auto set. */
export function scenesFor(art: { slug: string; roomScenes?: number[] | null }) {
  const picks = (art.roomScenes || []).filter(isScene).slice(0, 5);
  return picks.length ? picks : autoScenes(art.slug);
}

/** A page of suggestions for the picker: varied rooms, seeded by artwork and shuffle round. */
export function suggestScenes(key: string, round = 0, type?: RoomType | null, count = 24): number[] {
  const r = rng(hashString(`suggest:${key}:${round}:${type || "all"}`));
  if (type) return shuffled(scenesOfType(type), r).slice(0, count);
  // interleave room types so a page always shows a mix
  const pools = ROOM_TYPES.map((t) => shuffled(scenesOfType(t), r));
  const off = r.int(0, 100);
  const out: number[] = [];
  for (let i = 0; out.length < count; i++) {
    const t = (i + off) % ROOM_TYPES.length;
    out.push(pools[t][Math.floor(i / ROOM_TYPES.length) % 125]);
  }
  return out.map(norm);
}
