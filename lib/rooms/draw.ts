// Drawing kit for the room generator: furniture, plants, lamps and small things, as SVG strings.
// Everything is measured in inches. The wall is the picture plane; the floor runs toward you.
// A point h inches above the floor and d inches in front of the wall is drawn at Y(h, d).

import type { Rng } from "./rng";
import { BOOKS, CERAMICS, METALS, WOODS, lum, mix, shade, type Palette } from "./palettes";

export const FLOOR = 108; // floor line (9 ft walls, ceiling at y = 0)
export const K = 0.28; // how much 1 inch of depth drops on screen (a slightly raised camera)
const PW = 0.0035; // floor perspective: things on the floor widen as they come forward
export const Y = (h: number, d = 0) => FLOOR - h + d * K;
/** Token replaced by a per-instance prefix so several scenes can share a page. */
export const ID = "__R__";

export const f = (n: number) => Math.round(n * 100) / 100;

export type Light = { x: number; y: number; r: number; a: number };

export type Ctx = {
  r: Rng;
  pal: Palette;
  evening: boolean;
  /** -1: daylight comes from the left, 1: from the right. */
  side: -1 | 1;
  vpx: number;
  defs: string[];
  wall: string[]; // on the wall plane, behind the art (windows, panels, shelves, sconces)
  floor: string[]; // flat on the floor (rugs, light pools)
  front: string[]; // furniture, in paint order
  glow: string[]; // lit lamp shades: drawn after the evening dimming
  lights: Light[];
  n: number; // def counter
};

export const uid = (c: Ctx, p = "d") => `${ID}${p}${c.n++}`;

// ---------- primitives ----------
export const rect = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0, w))}" height="${f(Math.max(0, h))}" fill="${fill}"${extra}/>`;
export const rr = (x: number, y: number, w: number, h: number, r: number, fill: string, extra = "") =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0, w))}" height="${f(Math.max(0, h))}" rx="${f(Math.min(r, w / 2, h / 2))}" fill="${fill}"${extra}/>`;
export const path = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}"${extra}/>`;
export const ell = (cx: number, cy: number, rx: number, ry: number, fill: string, extra = "") =>
  `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${extra}/>`;
export const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, extra = "") =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${f(w)}"${extra}/>`;
export const poly = (pts: [number, number][], fill: string, extra = "") =>
  `<polygon points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}" fill="${fill}"${extra}/>`;
export const op = (a: number) => ` opacity="${f(a)}"`;
/** Soft top-light / bottom-shade overlay for a front face. */
export const sheen = (x: number, y: number, w: number, h: number, r = 0) => rr(x, y, w, h, r, `url(#${ID}gv)`);

/** Floor x at depth d (perspective widening from the vanishing point). */
export const fx = (c: Ctx, x: number, d: number) => c.vpx + (x - c.vpx) * (1 + d * PW);

/** Soft shadow pooled on the floor under something. */
export function contact(c: Ctx, x0: number, x1: number, d0: number, d1: number, a = 0.5) {
  const cx = (x0 + x1) / 2;
  const cy = (Y(0, d0) + Y(0, d1)) / 2;
  c.front.push(ell(cx, cy, (x1 - x0) / 2 + 3, Math.max(1.5, (Y(0, d1) - Y(0, d0)) / 2 + 1.5), `url(#${ID}cs)`, op(a)));
}
/** Soft shadow on the wall behind a piece standing against it. */
export function wallShadow(c: Ctx, x0: number, x1: number, h: number, a = 0.35) {
  c.front.push(ell((x0 + x1) / 2 - c.side * 2, Y(h * 0.55), (x1 - x0) / 2 + 5, h * 0.6, `url(#${ID}cs)`, op(a)));
}

function lit(c: Ctx, shadeColor: string) {
  return c.evening ? mix(shadeColor, "#ffe6b3", 0.75) : shadeColor;
}
/** Register a warm light (evening only). */
export function addLight(c: Ctx, x: number, y: number, r: number, a = 0.55) {
  if (c.evening) c.lights.push({ x, y, r, a });
}

// ---------- seating ----------
export type SofaStyle = "track" | "round" | "low" | "camel" | "tufted";
export function sofa(
  c: Ctx,
  o: { x0: number; w: number; color: string; style: SofaStyle; legs?: string | null; cushions?: number; pillows?: string[]; throwColor?: string | null; depth?: number },
) {
  const { x0, w, color, style } = o;
  const x1 = x0 + w;
  const D = o.depth ?? 36;
  const back = style === "low" ? 27 : style === "camel" ? 33 : 31;
  const armH = style === "low" ? 22 : style === "round" ? 24 : 25;
  const seat = style === "low" ? 15 : 17;
  const aw = style === "round" ? 9 : style === "low" ? 6 : 7;
  const rx = style === "round" ? 4.5 : style === "tufted" ? 3 : 1.6;
  const dark = shade(color, -0.12);
  const darker = shade(color, -0.24);
  const light = shade(color, 0.1);
  const legH = o.legs === null ? 1 : style === "low" ? 3 : 5;
  const legC = o.legs || WOODS.walnut;

  wallShadow(c, x0, x1, back, 0.3);
  contact(c, x0, x1, 4, D, 0.55);
  // legs
  if (o.legs !== null) {
    for (const lx of [x0 + 3, x1 - 4.2]) c.front.push(path(`M${f(lx)} ${f(Y(legH, D - 1))} h1.2 l-0.25 ${f(legH + 0.5)} h-0.7 z`, legC));
  }
  // back
  const bTop = Y(back, 3);
  const bBot = Y(seat, 13);
  if (style === "camel") {
    const mid = (x0 + x1) / 2;
    c.front.push(path(`M${f(x0 + aw - 2)} ${f(bBot)} V${f(bTop + 5)} Q${f(mid)} ${f(bTop - 5)} ${f(x1 - aw + 2)} ${f(bTop + 5)} V${f(bBot)} Z`, dark));
    c.front.push(path(`M${f(x0 + aw)} ${f(bTop + 7)} Q${f(mid)} ${f(bTop - 2)} ${f(x1 - aw)} ${f(bTop + 7)}`, "none", ` stroke="${light}" stroke-width="0.6" opacity=".6"`));
  } else {
    c.front.push(rr(x0 + aw - 2, bTop, w - 2 * aw + 4, bBot - bTop + 2, rx, dark));
  }
  // back cushions
  const n = o.cushions ?? (w > 70 ? 3 : w > 40 ? 2 : 1);
  const cw = (w - 2 * aw) / n;
  if (style !== "camel" && style !== "tufted") {
    for (let i = 0; i < n; i++) {
      const cx = x0 + aw + i * cw;
      c.front.push(rr(cx + 0.4, bTop + 1.5, cw - 0.8, bBot - bTop - 0.5, rx + 1, color));
      c.front.push(rr(cx + 1.2, bTop + 2, cw - 2.4, 3, 1.5, light, op(0.7)));
    }
  } else if (style === "tufted") {
    // channel tufting: vertical pleats
    c.front.push(rr(x0 + aw, bTop + 1, w - 2 * aw, bBot - bTop, rx, color));
    const ch = Math.max(4, Math.round((w - 2 * aw) / 9));
    for (let i = 1; i < ch; i++) {
      const lx = x0 + aw + (i * (w - 2 * aw)) / ch;
      c.front.push(line(lx, bTop + 2, lx, bBot - 1, darker, 0.45, op(0.55)));
    }
    c.front.push(rr(x0 + aw + 1, bTop + 1.5, w - 2 * aw - 2, 2.5, 1.2, light, op(0.6)));
  }
  // seat
  const sTop = Y(seat, 13);
  const sFront = Y(seat, 34);
  for (let i = 0; i < n; i++) {
    const cx = x0 + aw + i * cw;
    c.front.push(rr(cx + 0.3, sTop, cw - 0.6, sFront - sTop + 4.5, 2, light));
    c.front.push(rr(cx + 0.3, sFront, cw - 0.6, 4.5, 1.8, color));
  }
  // base
  const baseTop = sFront + 4.2;
  c.front.push(rr(x0 + aw - 1, baseTop, w - 2 * aw + 2, Y(legH, D) - baseTop, 1.2, dark));
  // arms
  for (const ax of [x0, x1 - aw]) {
    const top = Y(armH, 3);
    c.front.push(rr(ax, top, aw, Y(legH, D) - top, rx, color));
    c.front.push(rr(ax, top, aw, (D - 3) * K + 2.5, rx, light));
    c.front.push(sheen(ax, top, aw, Y(legH, D) - top, rx));
  }
  // pillows lean on the back cushions
  const pillows = o.pillows || [];
  const slots = pillows.length;
  pillows.forEach((pc, i) => {
    const s = 14 + c.r.range(-1, 1.5);
    const inner = w - 2 * aw - 6;
    let px: number;
    if (slots === 1) px = x0 + aw + 3 + (c.r.chance(0.5) ? 0 : inner - s);
    else if (slots === 2) px = i === 0 ? x0 + aw + 2 : x1 - aw - 2 - s;
    else px = i < slots / 2 ? x0 + aw + 2 + i * (s * 0.7) : x1 - aw - 2 - s - (slots - 1 - i) * (s * 0.7);
    const py = sTop - s + 2.4;
    const rot = (i < slots / 2 ? -1 : 1) * c.r.range(4, 9);
    const cxp = px + s / 2;
    const cyp = py + s / 2;
    c.front.push(
      `<g transform="rotate(${f(rot)} ${f(cxp)} ${f(cyp)})">${rr(px, py, s, s, 3, pc)}${rr(px + 1.5, py + 1, s - 3, 2.2, 1.1, shade(pc, 0.1), op(0.6))}${line(px + 3, cyp + 1, px + s - 3, cyp + 1, shade(pc, -0.18), 0.35, op(0.5))}</g>`,
    );
  });
  // throw over one arm
  if (o.throwColor) {
    const right = c.r.chance(0.5);
    const ax = right ? x1 - aw - 2 : x0 - 1;
    const top = Y(armH, 3) - 0.6;
    const tw = aw + 3;
    const bot = Y(legH + 4, D);
    const tc = o.throwColor;
    c.front.push(path(`M${f(ax)} ${f(top + 2)} q${f(tw / 2)} -2.6 ${f(tw)} 0 V${f(bot - 1)} q-${f(tw / 4)} 2 -${f(tw / 2)} 0 q-${f(tw / 4)} 2 -${f(tw / 2)} 0 Z`, tc));
    for (let i = 1; i < 3; i++) c.front.push(line(ax + (tw * i) / 3, top + 3, ax + (tw * i) / 3 + 0.3, bot - 1.5, shade(tc, -0.15), 0.4, op(0.6)));
  }
  return { seat, back, top: Y(back, 3) };
}

/** Lounge chair: a one-seater, optionally on a wooden frame. */
export function armchair(c: Ctx, o: { x0: number; color: string; kind: "lounge" | "wing" | "frame" | "boucle"; wood: string; d?: number }) {
  const { x0, color, kind, wood } = o;
  const d0 = o.d ?? 0;
  if (kind === "frame") {
    // wooden frame chair with loose cushions
    const w = 30;
    contact(c, x0, x0 + w, d0 + 4, d0 + 32, 0.5);
    const top = Y(30, d0 + 5);
    c.front.push(rr(x0 + 3, top, w - 6, Y(15, d0 + 13) - top, 3, shade(color, -0.08)));
    c.front.push(rr(x0 + 3.5, top + 1, w - 7, 3, 1.5, shade(color, 0.08), op(0.7)));
    c.front.push(rr(x0 + 3, Y(15, d0 + 12), w - 6, Y(15, d0 + 30) - Y(15, d0 + 12) + 4, 2, shade(color, 0.08)));
    c.front.push(rr(x0 + 3, Y(15, d0 + 30), w - 6, 4, 1.8, color));
    // frame: arms + legs
    for (const ax of [x0, x0 + w - 2]) {
      c.front.push(rect(ax, Y(22, d0 + 4), 2, Y(0, d0 + 30) - Y(22, d0 + 4), wood));
      c.front.push(rect(ax, Y(22, d0 + 4), 2, 0.8, shade(wood, 0.15)));
    }
    c.front.push(rect(x0, Y(9, d0 + 30), w, 1.3, shade(wood, -0.1)));
    return { w, seat: 15 };
  }
  const w = kind === "wing" ? 32 : 34;
  if (kind === "wing") {
    contact(c, x0, x0 + w, d0 + 4, d0 + 32, 0.5);
    wallShadow(c, x0, x0 + w, 42, 0.25);
    const top = Y(42, d0 + 3);
    c.front.push(path(`M${f(x0 + 3)} ${f(Y(18, d0 + 12))} V${f(top + 6)} Q${f(x0 + 3)} ${f(top)} ${f(x0 + 9)} ${f(top)} H${f(x0 + w - 9)} Q${f(x0 + w - 3)} ${f(top)} ${f(x0 + w - 3)} ${f(top + 6)} V${f(Y(18, d0 + 12))} Z`, shade(color, -0.1)));
    c.front.push(rr(x0 + 7, top + 2, w - 14, 3, 1.5, shade(color, 0.08), op(0.6)));
    c.front.push(rr(x0 + 6, Y(17, d0 + 12), w - 12, Y(17, d0 + 30) - Y(17, d0 + 12) + 4.5, 2, shade(color, 0.08)));
    c.front.push(rr(x0 + 6, Y(17, d0 + 30), w - 12, 5, 2, color));
    for (const ax of [x0, x0 + w - 6.5]) {
      c.front.push(rr(ax, Y(26, d0 + 5), 6.5, Y(5, d0 + 30) - Y(26, d0 + 5), 3, color));
      c.front.push(rr(ax, Y(26, d0 + 5), 6.5, 7, 3, shade(color, 0.1)));
    }
    for (const lx of [x0 + 2, x0 + w - 3.2]) c.front.push(path(`M${f(lx)} ${f(Y(5, d0 + 30))} h1.2 l-0.2 ${f(5)} h-0.8 z`, wood));
    return { w, seat: 17 };
  }
  // lounge / boucle: a soft round chair
  const r = sofa(c, { x0, w, color, style: "round", legs: kind === "boucle" ? null : wood, cushions: 1, depth: 32 });
  if (kind === "boucle") {
    // nubby texture dots
    const dots: string[] = [];
    for (let i = 0; i < 26; i++) dots.push(ell(x0 + c.r.range(2, w - 2), Y(c.r.range(4, 28), c.r.range(4, 26)), 0.35, 0.3, shade(color, -0.12), op(0.6)));
    c.front.push(dots.join(""));
  }
  return { w, seat: r.seat };
}

/** Upholstered wall bench for a café or breakfast nook. */
export function banquette(c: Ctx, x0: number, w: number, color: string, wood: string) {
  const x1 = x0 + w;
  wallShadow(c, x0, x1, 36, 0.25);
  contact(c, x0, x1, 2, 22, 0.5);
  const top = Y(36, 2);
  c.front.push(rr(x0, top, w, Y(18, 8) - top + 1, 2, color));
  const ch = Math.round(w / 8);
  for (let i = 1; i < ch; i++) {
    const lx = x0 + (i * w) / ch;
    c.front.push(line(lx, top + 1.5, lx, Y(18, 8) - 1, shade(color, -0.2), 0.45, op(0.6)));
  }
  c.front.push(rr(x0 + 0.5, top + 0.5, w - 1, 2.4, 1.2, shade(color, 0.12), op(0.7)));
  c.front.push(rect(x0, Y(18, 8), w, Y(18, 21) - Y(18, 8), shade(color, 0.1)));
  c.front.push(rr(x0, Y(18, 21), w, 3.6, 1.2, color));
  c.front.push(rect(x0, Y(18, 21) + 3.4, w, Y(0, 22) - Y(18, 21) - 3.4, wood));
  c.front.push(rect(x0, Y(18, 21) + 3.4, w, 1, shade(wood, -0.2)));
  c.front.push(rect(x0, Y(3, 22), w, Y(0, 22) - Y(3, 22), shade(wood, -0.3)));
  return { seat: 18 };
}

/** Bench against the wall (hallway, foot of bed). */
export function bench(c: Ctx, x0: number, w: number, wood: string, cushion: string | null, d0 = 0) {
  contact(c, x0, x0 + w, d0 + 2, d0 + 16, 0.45);
  const h = 18;
  c.front.push(rect(x0, Y(h, d0), w, Y(h, d0 + 15) - Y(h, d0), shade(wood, 0.12)));
  c.front.push(rect(x0, Y(h, d0 + 15), w, 1.8, wood));
  for (const lx of [x0 + 1.5, x0 + w - 3.3]) c.front.push(rect(lx, Y(h, d0 + 15) + 1.8, 1.8, Y(0, d0 + 15) - Y(h, d0 + 15) - 1.8, shade(wood, -0.08)));
  c.front.push(rect(x0 + 1.5, Y(6, d0 + 15), w - 3, 1, shade(wood, -0.15)));
  if (cushion) {
    c.front.push(rr(x0 + 1, Y(h + 3, d0 + 1), w - 2, Y(h, d0 + 14) - Y(h + 3, d0 + 1) + 1, 1.6, cushion));
    c.front.push(rr(x0 + 1.5, Y(h + 3, d0 + 1), w - 3, 1.5, 0.8, shade(cushion, 0.12)));
  }
  return { h: cushion ? h + 3 : h, d: d0 + 8 };
}

/** Dining or bistro chair. view: "back" faces the wall (we see its back), "profile" seen from the side, "front" faces us. */
export function chair(c: Ctx, o: { x: number; d: number; kind: "bentwood" | "spindle" | "cane" | "molded" | "task"; color: string; view: "back" | "profile" | "front"; flip?: boolean }) {
  const { x, d, kind, color, view } = o;
  const seat = 18;
  const top = kind === "task" ? 38 : 33;
  const w = kind === "task" ? 20 : 17;
  contact(c, x - w / 2, x + w / 2, d - 6, d + 8, 0.4);
  if (view === "profile") {
    const s = o.flip ? -1 : 1;
    const bx = x - (s * w) / 2; // back side
    const fxx = x + (s * w) / 2;
    const parts: string[] = [];
    parts.push(line(bx, Y(top, d), bx + s * 0.8, Y(0, d), color, 1.2)); // back leg + back post
    parts.push(line(fxx, Y(seat, d), fxx - s * 0.6, Y(0, d), color, 1.1));
    parts.push(line(bx, Y(seat, d), fxx, Y(seat, d), color, 1.6));
    if (kind === "molded") parts.push(path(`M${f(bx)} ${f(Y(seat, d))} q${f(-s * 1.5)} -8 ${f(s * 0.5)} -${f(top - seat)} h${f(s * 3)} q${f(-s * 2)} 8 ${f(s * 0.5)} ${f(top - seat - 2)} Z`, color));
    else if (kind === "cane") parts.push(rect(Math.min(bx, bx + s * 1.8), Y(top - 2, d), 1.8, top - seat - 5, shade(color, 0.35)));
    else parts.push(line(bx + s * 0.4, Y(top - 6, d), bx + s * 0.4, Y(top - 1, d), color, 2.2));
    if (kind === "bentwood") parts.push(path(`M${f(bx)} ${f(Y(top, d))} q${f(s * 4)} 3 ${f(s * 1)} 11`, "none", ` stroke="${color}" stroke-width="0.8"`));
    c.front.push(parts.join(""));
    return;
  }
  const x0 = x - w / 2;
  const parts: string[] = [];
  if (kind === "task") {
    // office chair: star base, gas lift, seat, backrest
    const cy = Y(0, d + 4);
    parts.push(line(x - 10, cy, x + 10, cy, "#2a2b2f", 1.2), ell(x - 10, cy + 0.5, 1.1, 0.8, "#1d1e21"), ell(x + 10, cy + 0.5, 1.1, 0.8, "#1d1e21"), ell(x, cy + 1, 1.1, 0.8, "#1d1e21"));
    parts.push(rect(x - 0.8, Y(17, d + 2), 1.6, cy - Y(17, d + 2), "#5a5b60"));
    parts.push(rr(x - 10, Y(19, d), 20, 3.5, 1.6, shade(color, -0.1)));
    parts.push(rr(x - 9, Y(top, d + 6), 18, top - 22, 4, color), rr(x - 8, Y(top, d + 6) + 1, 16, 2.5, 1.2, shade(color, 0.12), op(0.7)));
    c.front.push(parts.join(""));
    return;
  }
  // legs
  for (const lx of [x0 + 1.2, x0 + w - 2.4]) parts.push(rect(lx, Y(seat, d) + 1, 1.2, Y(0, d + 3) - Y(seat, d) - 1, shade(color, -0.12)));
  if (view === "back") {
    // seat edge peeks under the back
    parts.push(rr(x0, Y(seat, d - 4), w, 2.4, 1, shade(color, 0.08)));
  } else {
    parts.push(rr(x0, Y(seat, d - 8), w, Y(seat, d + 6) - Y(seat, d - 8), 1.5, shade(color, 0.1)));
    parts.push(rect(x0, Y(seat, d + 6), w, 1.6, color));
  }
  const by = Y(top, d - (view === "back" ? 1 : 7));
  const bh = top - seat - 1;
  if (kind === "bentwood") {
    parts.push(path(`M${f(x0 + 1)} ${f(by + bh)} V${f(by + 4)} Q${f(x0 + 1)} ${f(by)} ${f(x)} ${f(by)} Q${f(x0 + w - 1)} ${f(by)} ${f(x0 + w - 1)} ${f(by + 4)} V${f(by + bh)}`, "none", ` stroke="${color}" stroke-width="1.4"`));
    parts.push(path(`M${f(x0 + 3)} ${f(by + bh)} V${f(by + 7)} Q${f(x)} ${f(by + 3.5)} ${f(x0 + w - 3)} ${f(by + 7)} V${f(by + bh)}`, "none", ` stroke="${color}" stroke-width="0.8"`));
  } else if (kind === "spindle") {
    parts.push(rr(x0 + 0.5, by, w - 1, 2.2, 1, color));
    for (let i = 0; i < 5; i++) parts.push(rect(x0 + 2 + i * ((w - 5) / 4), by + 2, 0.7, bh - 2, color));
    parts.push(rect(x0 + 0.5, by, 1.1, bh, color), rect(x0 + w - 1.6, by, 1.1, bh, color));
  } else if (kind === "cane") {
    parts.push(rr(x0 + 0.5, by, w - 1, bh * 0.6, 2, color));
    parts.push(rr(x0 + 2, by + 1.5, w - 4, bh * 0.6 - 3, 1, `url(#${ID}cane)`));
    parts.push(rect(x0 + 0.5, by, 1.1, bh, color), rect(x0 + w - 1.6, by, 1.1, bh, color));
  } else {
    parts.push(path(`M${f(x0)} ${f(by + 3)} Q${f(x)} ${f(by - 1.5)} ${f(x0 + w)} ${f(by + 3)} L${f(x0 + w - 1.5)} ${f(by + bh)} H${f(x0 + 1.5)} Z`, color));
    parts.push(path(`M${f(x0 + 2)} ${f(by + 2.6)} Q${f(x)} ${f(by - 0.2)} ${f(x0 + w - 2)} ${f(by + 2.6)}`, "none", ` stroke="${shade(color, 0.18)}" stroke-width=".7"`));
  }
  c.front.push(parts.join(""));
}

// ---------- case goods ----------
export type CaseStyle = "legs" | "plinth" | "fluted" | "cane" | "drawers";
export type Surface = { x0: number; x1: number; h: number; d: number };

export function cabinet(c: Ctx, o: { x0: number; w: number; h: number; d: number; color: string; style: CaseStyle; pull?: string; top?: string }): Surface {
  const { x0, w, h, d, color, style } = o;
  const x1 = x0 + w;
  const raised = style === "legs" || style === "cane";
  const hb = raised ? 7 : 3;
  const pull = o.pull || shade(color, -0.35);
  wallShadow(c, x0, x1, h, 0.3);
  contact(c, x0, x1, 2, d, 0.5);
  const parts: string[] = [];
  if (raised) {
    for (const lx of [x0 + 1.5, x1 - 3]) parts.push(path(`M${f(lx)} ${f(Y(hb, d - 1))} h1.5 l-0.35 ${f(hb + 0.4)} h-0.8 z`, shade(color, -0.2)));
  } else {
    parts.push(rect(x0 + 1.2, Y(hb, d - 1), w - 2.4, Y(0, d - 1) - Y(hb, d - 1), shade(color, -0.35)));
  }
  // top
  const topC = o.top || shade(color, 0.1);
  parts.push(rect(x0 - 0.3, Y(h, 0), w + 0.6, Y(h, d) - Y(h, 0), topC));
  parts.push(rect(x0 - 0.3, Y(h, d), w + 0.6, 1, shade(o.top || color, -0.05)));
  // body
  const fy = Y(h, d) + 1;
  const fh = Y(hb, d) - fy;
  parts.push(rect(x0, fy, w, fh, color));
  const n = Math.max(2, Math.round(w / 18));
  const dw = w / n;
  if (style === "drawers") {
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const ry = fy + (r * fh) / rows;
      parts.push(rect(x0 + 0.6, ry + 0.4, w - 1.2, fh / rows - 0.8, shade(color, 0.03)));
      parts.push(line(x0, ry, x1, ry, shade(color, -0.25), 0.3));
      for (let i = 0; i < 2; i++) parts.push(rr(x0 + (w * (i + 0.5)) / 2 - 2.5, ry + fh / rows / 2 - 0.4, 5, 0.8, 0.4, pull));
    }
  } else {
    for (let i = 0; i < n; i++) {
      const dx = x0 + i * dw;
      if (i > 0) parts.push(line(dx, fy, dx, fy + fh, shade(color, -0.28), 0.3));
      if (style === "fluted") {
        for (let k = 1.2; k < dw - 0.6; k += 1.4) parts.push(rect(dx + k, fy + 1, 0.55, fh - 2, shade(color, k % 2.8 < 1.4 ? 0.08 : -0.1)));
      } else if (style === "cane") {
        parts.push(rect(dx + 1.4, fy + 1.4, dw - 2.8, fh - 2.8, `url(#${ID}cane)`));
        parts.push(rect(dx + 1.4, fy + 1.4, dw - 2.8, fh - 2.8, "none", ` stroke="${shade(color, -0.2)}" stroke-width=".4"`));
      } else {
        parts.push(rect(dx + 1.2, fy + 1.2, dw - 2.4, fh - 2.4, "none", ` stroke="${shade(color, -0.12)}" stroke-width=".3"`));
      }
      const px = i % 2 === 0 ? dx + dw - 2.4 : dx + 1.6;
      parts.push(rr(px, fy + fh * 0.22, 0.8, 4, 0.4, pull));
    }
  }
  parts.push(rect(x0, fy, w, fh, `url(#${ID}gv)`));
  c.front.push(parts.join(""));
  return { x0, x1, h, d: d * 0.5 };
}

/** Table or desk on legs. */
export function table(
  c: Ctx,
  o: { x0: number; w: number; h: number; d0: number; d1: number; top: string; legs: string; style: "trestle" | "hairpin" | "slab" | "apron" | "pedestal"; shelf?: boolean },
): Surface {
  const { x0, w, h, d0, d1, top, legs, style } = o;
  const x1 = x0 + w;
  contact(c, x0, x1, d0, d1, 0.45);
  const parts: string[] = [];
  const legBot = Y(0, d1 - 2);
  const th = style === "slab" ? 2.2 : 1.4;
  const under = Y(h, d1) + th;
  if (style === "pedestal") {
    const cx = (x0 + x1) / 2;
    parts.push(path(`M${f(cx - 1.4)} ${f(under)} h2.8 l1.2 ${f(legBot - under - 1)} h-5.2 z`, legs));
    parts.push(ell(cx, legBot - 0.3, w * 0.28, 1.1, shade(legs, -0.1)));
  } else if (style === "trestle") {
    for (const lx of [x0 + 5, x1 - 7]) parts.push(rect(lx, under, 2, legBot - under, legs), rect(lx - 2, legBot - 1.2, 6, 1.2, shade(legs, -0.1)));
    parts.push(rect(x0 + 6, under + (legBot - under) * 0.6, w - 12, 1.2, shade(legs, -0.1)));
  } else if (style === "hairpin") {
    for (const lx of [x0 + 2.5, x1 - 4]) parts.push(path(`M${f(lx)} ${f(under)} L${f(lx + 0.75)} ${f(legBot)} L${f(lx + 1.5)} ${f(under)}`, "none", ` stroke="${legs}" stroke-width=".45"`));
  } else {
    for (const lx of [x0 + 1, x1 - 2.6]) parts.push(rect(lx, under, 1.6, legBot - under, legs));
    if (style === "apron") parts.push(rect(x0 + 1, under, w - 2, 3.2, shade(legs, 0.05)));
    else parts.push(rect(x0 + 1, under, w - 2, 1.4, shade(legs, -0.05)));
  }
  if (o.shelf) parts.push(rect(x0 + 1, Y(9, d1 - 1), w - 2, 1.4, shade(legs, 0.05)));
  parts.push(rect(x0, Y(h, d0), w, Y(h, d1) - Y(h, d0), shade(top, 0.08)));
  parts.push(rect(x0, Y(h, d1), w, th, shade(top, -0.08)));
  c.front.push(parts.join(""));
  return { x0, x1, h, d: (d0 + d1) / 2 };
}

/** Round café table on a pedestal (seen as an ellipse). */
export function roundTable(c: Ctx, cx: number, dia: number, h: number, dc: number, top: string, base: string) {
  const ty = Y(h, dc);
  const ry = (dia / 2) * K;
  contact(c, cx - dia / 2, cx + dia / 2, dc - dia / 2, dc + dia / 2, 0.4);
  const parts: string[] = [];
  parts.push(rect(cx - 0.8, ty, 1.6, Y(0, dc) - ty, base));
  parts.push(ell(cx, Y(0, dc), dia * 0.22, 1.1, shade(base, -0.1)));
  parts.push(ell(cx, ty + 1.1, dia / 2, ry, shade(top, -0.12)));
  parts.push(ell(cx, ty, dia / 2, ry, top));
  parts.push(ell(cx - dia * 0.12, ty - ry * 0.25, dia * 0.28, ry * 0.45, "#ffffff", op(0.18)));
  c.front.push(parts.join(""));
  return { x0: cx - dia / 2, x1: cx + dia / 2, h, d: dc };
}

export function bed(c: Ctx, o: { x0: number; w: number; head: "round" | "channel" | "slat" | "cane" | "wing"; headColor: string; wood: string; linen: string; duvet: string; throwColor: string; pillows: string[] }) {
  const { x0, w, head, wood, linen } = o;
  const x1 = x0 + w;
  // keep the bed readable against the wall: pale bedding on a pale wall (or a headboard the wall's color) washes out
  const wl = lum(c.pal.wall);
  const away = (col: string, from: number, min: number) => (Math.abs(lum(col) - from) >= min ? col : shade(col, from > 0.5 ? -min * 1.6 : min * 1.4));
  const headColor = away(away(o.headColor, wl, 0.12), lum(linen), 0.1);
  const duvet = away(o.duvet, wl, 0.06);
  const hh = head === "wing" ? 54 : head === "slat" ? 44 : 50;
  const L = 80;
  wallShadow(c, x0, x1, hh, 0.3);
  contact(c, x0, x1, 8, L, 0.5);
  const parts: string[] = [];
  const top = Y(hh, 1);
  const hb = Y(10, 3);
  if (head === "round") parts.push(path(`M${f(x0)} ${f(hb)} V${f(top + 10)} Q${f(x0)} ${f(top)} ${f(x0 + 12)} ${f(top)} H${f(x1 - 12)} Q${f(x1)} ${f(top)} ${f(x1)} ${f(top + 10)} V${f(hb)} Z`, headColor));
  else if (head === "wing") parts.push(path(`M${f(x0 - 4)} ${f(hb)} V${f(top + 4)} Q${f(x0 - 4)} ${f(top)} ${f(x0)} ${f(top)} H${f(x1)} Q${f(x1 + 4)} ${f(top)} ${f(x1 + 4)} ${f(top + 4)} V${f(hb)} Z`, headColor));
  else parts.push(rr(x0, top, w, hb - top, head === "channel" ? 3 : 0.8, head === "slat" || head === "cane" ? wood : headColor));
  if (head === "channel" || head === "wing") {
    const n = Math.round(w / 7);
    for (let i = 1; i < n; i++) parts.push(line(x0 + (i * w) / n, top + 2, x0 + (i * w) / n, hb - 1, shade(headColor, -0.18), 0.45, op(0.6)));
  }
  if (head === "slat") for (let x = x0 + 2.5; x < x1 - 1; x += 3.2) parts.push(rect(x, top + 1.5, 1.6, hb - top - 3, shade(wood, -0.12)));
  if (head === "cane") parts.push(rr(x0 + 2, top + 2, w - 4, hb - top - 8, 0.6, `url(#${ID}cane)`));
  parts.push(rr(x0 + 1, top + 1, w - 2, 2, 1, "#ffffff", op(0.18)));
  // pillows (two sleeping + accents)
  const mY = Y(24, 8);
  const pw = (w - 6) / 2;
  // headboard shade behind the pillows
  parts.push(rect(x0 + 1, mY - 16, w - 2, 8, "#1d150e", ` opacity=".12" filter="url(#${ID}soft)"`));
  for (let i = 0; i < 2; i++) parts.push(rr(x0 + 3 + i * pw, mY - 10, pw - 1, 12, 4, linen), rr(x0 + 4 + i * pw, mY - 9.5, pw - 3, 2.6, 1.3, "#ffffff", op(0.45)), rr(x0 + 3 + i * pw, mY - 10, pw - 1, 12, 4, "none", ` stroke="#1d150e" stroke-opacity=".14" stroke-width=".35"`));
  o.pillows.forEach((pc, i) => {
    const s = 15;
    const px = x0 + w / 2 - (o.pillows.length * (s - 2)) / 2 + i * (s - 2);
    parts.push(`<g transform="rotate(${f((i - (o.pillows.length - 1) / 2) * 5)} ${f(px + s / 2)} ${f(mY - 6)})">${rr(px, mY - 13, s, s - 2, 3.5, pc)}${rr(px + 1.5, mY - 12, s - 3, 2.4, 1.2, shade(pc, 0.14), op(0.8))}</g>`);
  });
  // mattress top: duvet surface
  const dTop = Y(24, 14);
  const front = Y(24, L);
  parts.push(rr(x0 - 1, dTop - 1, w + 2, front - dTop + 2, 3, duvet));
  // pillows shade the duvet where they rest on it
  parts.push(rect(x0 + 2, dTop - 1, w - 4, 3.2, "#1d150e", ` opacity=".16" filter="url(#${ID}soft)"`));
  // folded duvet edge + throw at foot
  parts.push(rect(x0 - 1, dTop + 2.5, w + 2, 1.6, shade(duvet, 0.12)));
  const tY = Y(24, L - 22);
  parts.push(rect(x0 - 1.5, tY, w + 3, front - tY + 1, o.throwColor));
  parts.push(rect(x0 - 1.5, tY, w + 3, 1, shade(o.throwColor, 0.15)));
  // front of bed: duvet drop + frame
  parts.push(rr(x0 - 1.5, front, w + 3, 7, 2, shade(o.throwColor, -0.08)));
  parts.push(rect(x0, front + 6, w, Y(4, L) - front - 6, wood));
  parts.push(rect(x0, front + 6, w, 0.8, shade(wood, 0.15)));
  for (const lx of [x0 + 1, x1 - 3]) parts.push(rect(lx, Y(4, L), 2, 4, shade(wood, -0.2)));
  parts.push(sheen(x0 - 1, dTop - 1, w + 2, front - dTop + 8, 3));
  parts.push(rr(x0 - 1.5, dTop - 1, w + 3, front - dTop + 8, 3, "none", ` stroke="#1d150e" stroke-opacity=".12" stroke-width=".4"`));
  c.front.push(parts.join(""));
  return { head: hh };
}

/** Floor-standing bookshelf filled with books and a few objects. */
export function bookshelf(c: Ctx, x0: number, w: number, h: number, wood: string) {
  const d = 14;
  wallShadow(c, x0, x0 + w, h, 0.25);
  contact(c, x0, x0 + w, 2, d, 0.45);
  const parts: string[] = [];
  const top = Y(h, d);
  const bot = Y(0, d);
  parts.push(rect(x0, Y(h, 0), w, top - Y(h, 0), shade(wood, 0.1)));
  parts.push(rect(x0, top, w, bot - top, wood));
  const inner = shade(wood, -0.32);
  const rows = Math.max(3, Math.round(h / 14));
  const rh = (h - 4) / rows;
  for (let r = 0; r < rows; r++) {
    const sy = top + 1.2 + r * rh;
    parts.push(rect(x0 + 1.2, sy, w - 2.4, rh - 1.2, inner));
    parts.push(rect(x0 + 1.2, sy, w - 2.4, rh * 0.25, "#000000", op(0.12)));
    parts.push(shelfFill(c, x0 + 1.6, x0 + w - 1.6, sy + rh - 1.2, rh - 2.5));
  }
  c.front.push(parts.join(""));
}

/** Books, vases and plants on one shelf between x0 and x1, standing on baseline y. */
export function shelfFill(c: Ctx, x0: number, x1: number, y: number, maxH: number, sparse = false) {
  const parts: string[] = [];
  let x = x0 + c.r.range(0, 2);
  while (x < x1 - 2) {
    const roll = c.r.next();
    if (roll < (sparse ? 0.3 : 0.62)) {
      // a run of books
      const n = c.r.int(3, 8);
      for (let i = 0; i < n && x < x1 - 1.2; i++) {
        const bw = c.r.range(0.9, 1.8);
        const bh = Math.min(maxH, c.r.range(maxH * 0.62, maxH * 0.95));
        const col = c.r.pick(BOOKS);
        parts.push(rect(x, y - bh, bw, bh, col), rect(x + bw * 0.2, y - bh * 0.82, bw * 0.6, 0.35, shade(col, 0.25), op(0.7)));
        x += bw + 0.08;
      }
      if (c.r.chance(0.3) && x < x1 - 7) {
        // books lying flat
        let sy = y;
        const sw = c.r.range(5, 7);
        for (let i = 0; i < c.r.int(2, 4); i++) {
          const bh = c.r.range(0.9, 1.4);
          parts.push(rect(x + 0.5 + c.r.range(-0.3, 0.3), sy - bh, sw, bh, c.r.pick(BOOKS)));
          sy -= bh;
        }
        x += sw + 1.5;
      }
    } else if (roll < 0.8) {
      const vh = Math.min(maxH * 0.8, c.r.range(4, 8));
      const vw = c.r.range(2.5, 4.2);
      const col = c.r.pick(CERAMICS);
      parts.push(path(`M${f(x + vw * 0.3)} ${f(y - vh)} h${f(vw * 0.4)} q${f(vw * 0.6)} ${f(vh * 0.3)} ${f(vw * 0.3)} ${f(vh)} h-${f(vw)} q-${f(vw * 0.3)} -${f(vh * 0.7)} ${f(vw * 0.3)} -${f(vh)} z`, col));
      x += vw + 2.5;
    } else if (roll < 0.9) {
      // trailing plant in a small pot
      const pw = 4;
      parts.push(trailing(c, x + pw / 2, y - 3.5, c.r.range(6, 14)));
      parts.push(path(`M${f(x)} ${f(y - 3.6)} h${pw} l-0.5 3.6 h-${pw - 1} z`, c.r.pick(["#c27753", "#efe9df", "#2b2d31"])));
      x += pw + 2.5;
    } else {
      x += c.r.range(3, 7);
    }
  }
  return parts.join("");
}

/** Floating wall shelf (wall layer) with things on it. */
export function wallShelf(c: Ctx, x0: number, w: number, h: number, wood: string, fill: "books" | "kitchen" | "cafe" | "mixed") {
  const parts: string[] = [];
  const y = Y(h);
  parts.push(rect(x0, y + 1.4, w, 2.4, "#000000", ` opacity=".1" filter="url(#${ID}soft)"`));
  if (fill === "kitchen" || fill === "cafe") parts.push(kitchenShelf(c, x0 + 1, x0 + w - 1, y, fill === "cafe"));
  else parts.push(shelfFill(c, x0 + 1, x0 + w - 1, y, 10, fill === "mixed"));
  parts.push(rect(x0, y, w, 1.5, wood), rect(x0, y, w, 0.4, shade(wood, 0.15)));
  c.wall.push(parts.join(""));
}

function kitchenShelf(c: Ctx, x0: number, x1: number, y: number, cafe: boolean) {
  const parts: string[] = [];
  let x = x0 + 1;
  while (x < x1 - 3) {
    const roll = c.r.next();
    const col = c.r.pick(CERAMICS);
    if (roll < 0.3) {
      // stack of plates seen edge-on
      const pw = c.r.range(7, 9);
      const n = c.r.int(3, 6);
      for (let i = 0; i < n; i++) parts.push(rr(x, y - (i + 1) * 0.75, pw, 0.7, 0.3, shade(col, i % 2 ? 0.05 : -0.04)));
      x += pw + 1.5;
    } else if (roll < 0.55) {
      // cups / mugs
      const n = c.r.int(2, 4);
      for (let i = 0; i < n; i++) {
        parts.push(rr(x, y - 3.2, 2.6, 3.2, 0.5, col), path(`M${f(x + 2.6)} ${f(y - 2.6)} q1.3 0.3 0 1.8`, "none", ` stroke="${col}" stroke-width=".4"`));
        x += 3.8;
      }
      x += 0.8;
    } else if (roll < 0.75) {
      // glass jars
      const jh = c.r.range(5, 8);
      const fill = c.r.pick(["#d8b77a", "#e9e1d0", "#8a5a36", "#c9a36a", "#efe8da"]);
      parts.push(rr(x, y - jh, 3.6, jh, 0.6, "#dfe6e6", op(0.55)), rect(x + 0.3, y - jh * 0.7, 3, jh * 0.7 - 0.3, fill, op(0.85)), rect(x - 0.1, y - jh - 0.8, 3.8, 0.9, shade(WOODS.oak, -0.1)));
      x += 5;
    } else if (roll < 0.88) {
      // bowl
      parts.push(path(`M${f(x)} ${f(y - 2.6)} h7 q-0.6 2.6 -3.5 2.6 q-2.9 0 -3.5 -2.6 z`, col));
      x += 8.5;
    } else if (!cafe) {
      // small herb pot
      parts.push(trailing(c, x + 2, y - 3.5, 3), path(`M${f(x)} ${f(y - 3.6)} h4 l-0.5 3.6 h-3 z`, "#c27753"));
      x += 6;
    } else x += 3;
  }
  return parts.join("");
}

/** Kitchen counter run: base cabinets, worktop and an optional low backsplash. */
export function counter(c: Ctx, o: { x0: number; w: number; color: string; top: string; splash: "tile" | "zellige" | "slab" | "none"; pull: string; sinkAt?: number | null }) {
  const { x0, w, color, top, splash } = o;
  const h = 36;
  const d = 24;
  const x1 = x0 + w;
  if (splash !== "none") {
    const sh = splash === "slab" ? 5 : 12;
    const sy = Y(h + sh);
    if (splash === "tile" || splash === "zellige") {
      c.wall.push(rect(x0, sy, w, sh, `url(#${ID}${splash})`), line(x0, sy, x1, sy, shade(top, -0.2), 0.3));
    } else c.wall.push(rect(x0, sy, w, sh, top), rect(x0, sy, w, 0.6, shade(top, 0.08)));
  }
  contact(c, x0, x1, 2, d, 0.4);
  const parts: string[] = [];
  parts.push(rect(x0, Y(h, 0), w, Y(h, d) - Y(h, 0), shade(top, 0.04)));
  parts.push(rect(x0 - 0.5, Y(h, d), w + 1, 1.5, shade(top, -0.06)));
  const fy = Y(h, d) + 1.5;
  const fb = Y(4, d - 1.5);
  parts.push(rect(x0, fy, w, fb - fy, color));
  parts.push(rect(x0 + 0.5, fb, w - 1, Y(0, d - 2) - fb, shade(color, -0.4)));
  const n = Math.max(1, Math.round(w / 18));
  const dw = w / n;
  for (let i = 0; i < n; i++) {
    const dx = x0 + i * dw;
    parts.push(rect(dx + 0.25, fy + 0.25, dw - 0.5, 5.2, shade(color, 0.03)));
    parts.push(rect(dx + 0.25, fy + 5.9, dw - 0.5, fb - fy - 6.2, shade(color, 0.03)));
    parts.push(rect(dx + 1.6, fy + 7.3, dw - 3.2, fb - fy - 9.2, "none", ` stroke="${shade(color, -0.12)}" stroke-width=".3"`));
    parts.push(rr(dx + dw / 2 - 2.2, fy + 2.4, 4.4, 0.7, 0.35, o.pull));
  }
  parts.push(rect(x0, fy, w, fb - fy, `url(#${ID}gv)`));
  if (o.sinkAt != null) {
    // faucet: arc spout behind the sink
    const sx = o.sinkAt;
    parts.push(rect(sx - 0.6, Y(h + 9, 3), 1.2, 9, o.pull), path(`M${f(sx)} ${f(Y(h + 9, 3))} q0 -4 4 -4 q4 0 4 4 v1.5`, "none", ` stroke="${o.pull}" stroke-width="1.1" stroke-linecap="round"`));
    parts.push(rect(sx - 6, Y(h, 6), 18, 1.2, shade(top, -0.25), op(0.6)));
  }
  c.front.push(parts.join(""));
  return { x0, x1, h, d: 10 };
}

// ---------- plants ----------
export type PotKind = "terracotta" | "white" | "black" | "basket" | "stone";
const LEAF = ["#4d6a45", "#5b7a4e", "#6c8a5a", "#3f5a3b", "#7a9665"];

export function pot(c: Ctx, cx: number, d: number, w: number, h: number, kind: PotKind) {
  const y1 = Y(0, d);
  const y0 = y1 - h;
  const col = kind === "terracotta" ? "#bf7550" : kind === "white" ? "#ece7de" : kind === "black" ? "#2b2c30" : kind === "stone" ? "#b9b2a6" : "#c4a172";
  const parts: string[] = [];
  parts.push(ell(cx, y1, w * 0.62, 1.4, `url(#${ID}cs)`, op(0.6)));
  parts.push(path(`M${f(cx - w / 2)} ${f(y0)} h${f(w)} l-${f(w * 0.1)} ${f(h)} h-${f(w * 0.8)} z`, col));
  if (kind === "basket") parts.push(path(`M${f(cx - w / 2)} ${f(y0)} h${f(w)} l-${f(w * 0.1)} ${f(h)} h-${f(w * 0.8)} z`, `url(#${ID}weave)`));
  if (kind === "terracotta") parts.push(rect(cx - w / 2 - 0.3, y0, w + 0.6, h * 0.16, shade(col, 0.06)));
  parts.push(path(`M${f(cx - w / 2)} ${f(y0)} h${f(w)} l-${f(w * 0.1)} ${f(h)} h-${f(w * 0.8)} z`, `url(#${ID}gh)`));
  c.front.push(parts.join(""));
  return y0;
}

function leafPath(x: number, y: number, len: number, wid: number, ang: number) {
  // pointed oval leaf from (x,y) along angle (deg)
  return `<path d="M0 0 Q${f(len * 0.5)} ${f(-wid)} ${f(len)} 0 Q${f(len * 0.5)} ${f(wid)} 0 0Z" transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})"`;
}

export function floorPlant(c: Ctx, o: { x: number; d: number; kind: "fig" | "snake" | "olive" | "palm" | "monstera" | "bird"; h: number; pot: PotKind }) {
  const { x, d, kind, h } = o;
  const potW = kind === "snake" ? 11 : 14;
  const potH = kind === "snake" ? 11 : 13;
  // foliage first (pot sits in front of the stems)
  const base = Y(potH - 1, d);
  const parts: string[] = [];
  if (kind === "fig") {
    parts.push(path(`M${f(x)} ${f(base)} Q${f(x - 1)} ${f(base - h * 0.5)} ${f(x + 1)} ${f(base - h + 6)}`, "none", ` stroke="#6b5440" stroke-width="1"`));
    const n = Math.round(h / 2.4);
    for (let i = 0; i < n; i++) {
      const t = 0.25 + (0.75 * i) / n;
      const ly = base - h * t + c.r.range(-2, 2);
      const spread = 3 + 8 * Math.sin(t * Math.PI);
      const lx = x + c.r.range(-spread, spread);
      const ang = lx < x ? c.r.range(190, 250) : c.r.range(-70, -10);
      const col = c.r.pick(LEAF);
      parts.push(`${leafPath(lx, ly, c.r.range(6, 8), c.r.range(2.6, 3.4), ang)} fill="${col}"/>`);
    }
  } else if (kind === "snake") {
    for (let i = 0; i < 9; i++) {
      const lx = x + (i - 4) * 1.1 + c.r.range(-0.4, 0.4);
      const lh = h * c.r.range(0.55, 1);
      const lean = (i - 4) * c.r.range(0.4, 1.2);
      const col = c.r.pick(["#3f5a3b", "#4a6a45", "#56744a"]);
      parts.push(path(`M${f(lx - 1.2)} ${f(base)} Q${f(lx - 1.4 + lean * 0.5)} ${f(base - lh * 0.6)} ${f(lx + lean)} ${f(base - lh)} Q${f(lx + 1.6 + lean * 0.5)} ${f(base - lh * 0.6)} ${f(lx + 1.2)} ${f(base)} Z`, col, ` stroke="#c9c47e" stroke-width=".25"`));
    }
  } else if (kind === "olive") {
    parts.push(path(`M${f(x)} ${f(base)} C${f(x + 2)} ${f(base - h * 0.3)} ${f(x - 2)} ${f(base - h * 0.5)} ${f(x + 0.5)} ${f(base - h * 0.62)}`, "none", ` stroke="#7a6550" stroke-width="1.1"`));
    for (let i = 0; i < 70; i++) {
      const a = c.r.range(0, Math.PI * 2);
      const rad = Math.sqrt(c.r.next()) * h * 0.25;
      const lx = x + Math.cos(a) * rad * 1.1;
      const ly = base - h * 0.72 + Math.sin(a) * rad * 0.9;
      parts.push(`${leafPath(lx, ly, c.r.range(2.6, 3.6), 0.55, c.r.range(0, 360))} fill="${c.r.pick(["#8f9a7a", "#a3ab8c", "#75825f", "#9aa483"])}"/>`);
    }
  } else if (kind === "palm") {
    for (let i = 0; i < 7; i++) {
      const ang = -90 + (i - 3) * 22 + c.r.range(-6, 6);
      const len = h * c.r.range(0.7, 0.95);
      const rad = (ang * Math.PI) / 180;
      const ex = x + Math.cos(rad) * len * 0.8;
      const ey = base + Math.sin(rad) * len * 0.75 + Math.abs(i - 3) * 3;
      const mx = x + Math.cos(rad) * len * 0.4;
      const my = base + Math.sin(rad) * len * 0.75;
      parts.push(path(`M${f(x)} ${f(base)} Q${f(mx)} ${f(my - 6)} ${f(ex)} ${f(ey)}`, "none", ` stroke="#5b7349" stroke-width=".5"`));
      for (let k = 2; k <= 12; k++) {
        const t = k / 13;
        const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex;
        const py = (1 - t) * (1 - t) * base + 2 * (1 - t) * t * (my - 6) + t * t * ey;
        const la = ang + (k % 2 ? 60 : -60) + 30;
        parts.push(`${leafPath(px, py, 5.5 * (1 - t * 0.5), 0.7, la)} fill="${LEAF[(i + k) % LEAF.length]}"/>`);
      }
    }
  } else if (kind === "bird") {
    for (let i = 0; i < 6; i++) {
      const lean = (i - 2.5) * 3.2;
      const lh = h * c.r.range(0.6, 1);
      const tx = x + lean * 1.8;
      const ty = base - lh;
      parts.push(path(`M${f(x + (i - 2.5) * 0.6)} ${f(base)} L${f(tx)} ${f(ty + lh * 0.45)}`, "none", ` stroke="#55704a" stroke-width=".6"`));
      parts.push(`<path d="M0 0 Q4 -${f(lh * 0.32)} 0 -${f(lh * 0.55)} Q-4 -${f(lh * 0.32)} 0 0Z" transform="translate(${f(tx)} ${f(ty + lh * 0.45)}) rotate(${f(lean * 2.5)})" fill="${c.r.pick(LEAF)}"/>`);
    }
  } else {
    // monstera
    for (let i = 0; i < 7; i++) {
      const ang = -90 + (i - 3) * 24 + c.r.range(-8, 8);
      const rad = (ang * Math.PI) / 180;
      const len = h * c.r.range(0.45, 0.8);
      const ex = x + Math.cos(rad) * len;
      const ey = base + Math.sin(rad) * len;
      parts.push(path(`M${f(x)} ${f(base)} Q${f(x + Math.cos(rad) * len * 0.3)} ${f(ey + 4)} ${f(ex)} ${f(ey)}`, "none", ` stroke="#55704a" stroke-width=".5"`));
      const s = c.r.range(6, 8.5);
      const col = c.r.pick(LEAF);
      parts.push(
        `<g transform="translate(${f(ex)} ${f(ey)}) rotate(${f(ang + 90)})"><path d="M0 0 C${f(-s * 1.3)} -${f(s * 0.2)} -${f(s)} -${f(s * 1.6)} 0 -${f(s * 1.3)} C${f(s)} -${f(s * 1.6)} ${f(s * 1.3)} -${f(s * 0.2)} 0 0Z" fill="${col}"/><path d="M0 -0.3 V-${f(s * 1.2)} M0 -${f(s * 0.5)} L-${f(s * 0.8)} -${f(s * 0.7)} M0 -${f(s * 0.8)} L${f(s * 0.8)} -${f(s * 1)} M0 -${f(s * 0.3)} L${f(s * 0.9)} -${f(s * 0.3)}" stroke="${shade(col, -0.25)}" stroke-width=".35" fill="none"/></g>`,
      );
    }
  }
  c.front.push(parts.join(""));
  pot(c, x, d, potW, potH, o.pot);
}

/** Vine spilling down from a shelf or pot. */
export function trailing(c: Ctx, x: number, y: number, len: number) {
  const parts: string[] = [];
  for (let v = 0; v < 3; v++) {
    const dx = (v - 1) * c.r.range(1.5, 3);
    const l = len * c.r.range(0.5, 1);
    parts.push(path(`M${f(x)} ${f(y)} q${f(dx)} ${f(l * 0.4)} ${f(dx * 0.6)} ${f(l)}`, "none", ` stroke="#55704a" stroke-width=".3"`));
    for (let k = 0; k < l; k += 2.2) {
      const t = k / l;
      parts.push(ell(x + dx * (t * 1.2) + (k % 4.4 < 2.2 ? -0.8 : 0.8), y + k + 0.5, 1.1, 0.8, c.r.pick(LEAF)));
    }
  }
  for (let i = 0; i < 5; i++) parts.push(ell(x + c.r.range(-2.5, 2.5), y - c.r.range(0, 2), 1.3, 0.9, c.r.pick(LEAF)));
  return parts.join("");
}

// ---------- lamps ----------
export type FloorLampKind = "arc" | "tripod" | "globe" | "cone";
export function floorLamp(c: Ctx, o: { x: number; d: number; kind: FloorLampKind; metal: string; shadeC: string; toward?: -1 | 1 }) {
  const { x, d, kind, metal } = o;
  const by = Y(0, d);
  const parts: string[] = [];
  parts.push(ell(x, by, 6, 1.4, `url(#${ID}cs)`, op(0.6)));
  const sh = lit(c, o.shadeC);
  if (kind === "arc") {
    const t = o.toward ?? 1;
    const ex = x + t * 34;
    const ey = Y(66, d);
    parts.push(ell(x, by - 0.8, 5, 1.6, "#d9d4cc"), rect(x - 5, by - 1.8, 10, 1.2, "#cfc9bf"));
    parts.push(path(`M${f(x)} ${f(by - 1.8)} V${f(Y(60, d))} Q${f(x)} ${f(Y(84, d))} ${f(ex)} ${f(ey - 3)}`, "none", ` stroke="${metal}" stroke-width=".6"`));
    c.front.push(parts.join(""));
    c.glow.push(path(`M${f(ex - 7)} ${f(ey + 3)} Q${f(ex - 7)} ${f(ey - 4)} ${f(ex)} ${f(ey - 4)} Q${f(ex + 7)} ${f(ey - 4)} ${f(ex + 7)} ${f(ey + 3)} Z`, c.evening ? sh : metal));
    if (c.evening) c.glow.push(ell(ex, ey + 3, 6, 0.9, "#fff6dc"));
    addLight(c, ex, ey + 6, 46, 0.6);
    return;
  }
  if (kind === "tripod") {
    const sy = Y(52, d);
    for (const s of [-1, 0, 1]) parts.push(line(x, sy + 8, x + s * 8, by + (s === 0 ? 1.5 : 0), WOODS.walnut, 0.9));
    parts.push(line(x, sy + 8, x, sy + 2, metal, 0.6));
    c.front.push(parts.join(""));
    c.glow.push(path(`M${f(x - 6)} ${f(sy - 10)} h12 l2 12 h-16 z`, sh), rect(x - 8, sy + 1.6, 16, 0.6, shade(sh, -0.1)));
    addLight(c, x, sy - 4, 42);
    return;
  }
  if (kind === "globe") {
    const gy = Y(58, d);
    parts.push(rect(x - 0.3, gy, 0.6, by - gy - 1, metal), ell(x, by - 0.6, 4.2, 1.1, metal));
    c.front.push(parts.join(""));
    c.glow.push(`<circle cx="${f(x)}" cy="${f(gy - 4.5)}" r="5.5" fill="${c.evening ? "#fff1cf" : "#f3f1ec"}"/>`, `<circle cx="${f(x - 1.6)}" cy="${f(gy - 6.3)}" r="1.9" fill="#ffffff" opacity=".5"/>`);
    addLight(c, x, gy - 4.5, 40, 0.65);
    return;
  }
  // cone: stem + cone shade
  const sy = Y(60, d);
  parts.push(rect(x - 0.35, sy, 0.7, by - sy - 1, metal), ell(x, by - 0.6, 4.5, 1.1, metal));
  c.front.push(parts.join(""));
  c.glow.push(path(`M${f(x - 2)} ${f(sy - 9)} h4 l4.5 9 h-13 z`, c.evening ? sh : o.shadeC));
  addLight(c, x, sy - 2, 40);
}

export type TableLampKind = "gourd" | "mushroom" | "drum" | "globe" | "pleat";
export function tableLamp(c: Ctx, o: { x: number; s: Surface; kind: TableLampKind; base: string; shadeC: string; scale?: number }) {
  const { x, s, kind, base } = o;
  const k = o.scale ?? 1;
  const y = Y(s.h, s.d);
  const parts: string[] = [];
  const sh = lit(c, o.shadeC);
  parts.push(ell(x, y, 5 * k, 0.9, "#000", op(0.18)));
  if (kind === "mushroom") {
    parts.push(path(`M${f(x - 2.2 * k)} ${f(y)} h${f(4.4 * k)} l-${f(0.9 * k)} -${f(11 * k)} h-${f(2.6 * k)} z`, base));
    c.front.push(parts.join(""));
    c.glow.push(path(`M${f(x - 8 * k)} ${f(y - 10 * k)} Q${f(x - 7 * k)} ${f(y - 18 * k)} ${f(x)} ${f(y - 18 * k)} Q${f(x + 7 * k)} ${f(y - 18 * k)} ${f(x + 8 * k)} ${f(y - 10 * k)} Z`, c.evening ? mix(base, "#ffe2a6", 0.55) : base));
    addLight(c, x, y - 10 * k, 30 * k, 0.55);
    return;
  }
  if (kind === "globe") {
    parts.push(rr(x - 3 * k, y - 3 * k, 6 * k, 3 * k, 1, base));
    c.front.push(parts.join(""));
    c.glow.push(`<circle cx="${f(x)}" cy="${f(y - 8.5 * k)}" r="${f(5.5 * k)}" fill="${c.evening ? "#fff0cc" : "#f1eee8"}"/>`, `<circle cx="${f(x - 1.7 * k)}" cy="${f(y - 10.3 * k)}" r="${f(1.8 * k)}" fill="#fff" opacity=".55"/>`);
    addLight(c, x, y - 8.5 * k, 32 * k, 0.6);
    return;
  }
  // gourd / drum / pleat: ceramic base + fabric shade
  const bh = 12 * k;
  parts.push(ell(x, y - bh * 0.42, 4.2 * k, bh * 0.42, base), ell(x, y - bh * 0.85, 2.4 * k, bh * 0.22, base), rect(x - 0.5, y - bh - 3 * k, 1, 3 * k, "#b8955a"));
  parts.push(ell(x - 1.4 * k, y - bh * 0.55, 1.2 * k, bh * 0.18, "#fff", op(0.22)));
  c.front.push(parts.join(""));
  const sy = y - bh - 2.5 * k;
  const top = kind === "drum" ? 7 : 4.5;
  const bot = kind === "drum" ? 7 : 8;
  c.glow.push(path(`M${f(x - top * k)} ${f(sy - 9 * k)} h${f(2 * top * k)} L${f(x + bot * k)} ${f(sy)} h-${f(2 * bot * k)} z`, sh));
  if (kind === "pleat") for (let i = -3; i <= 3; i++) c.glow.push(line(x + i * 0.62 * top * k, sy - 9 * k, x + i * 0.62 * bot * k, sy, shade(sh, -0.12), 0.25));
  addLight(c, x, sy - 4 * k, 34 * k);
}

export type PendantKind = "dome" | "globe" | "lantern" | "cone";
export function pendant(c: Ctx, o: { x: number; h: number; d: number; kind: PendantKind; color: string; big?: boolean }) {
  const { x, h, d, kind, color } = o;
  const y = Y(h, d);
  const s = o.big ? 1.5 : 1;
  c.front.push(line(x, -60, x, y - 8 * s, "#2a2a2a", 0.25));
  if (kind === "dome") {
    c.glow.push(path(`M${f(x - 8 * s)} ${f(y)} Q${f(x - 8 * s)} ${f(y - 8 * s)} ${f(x)} ${f(y - 8 * s)} Q${f(x + 8 * s)} ${f(y - 8 * s)} ${f(x + 8 * s)} ${f(y)} Z`, color));
    c.glow.push(ell(x, y, 7.6 * s, 1.2, c.evening ? "#fff3d6" : shade(color, -0.2)));
    addLight(c, x, y + 4, 40, 0.6);
  } else if (kind === "globe") {
    c.glow.push(`<circle cx="${f(x)}" cy="${f(y - 5 * s)}" r="${f(6 * s)}" fill="${c.evening ? "#fff0cc" : "#eeebe4"}"/>`, `<circle cx="${f(x - 2 * s)}" cy="${f(y - 7 * s)}" r="${f(2 * s)}" fill="#fff" opacity=".5"/>`);
    addLight(c, x, y - 5 * s, 38, 0.6);
  } else if (kind === "lantern") {
    const r = 9 * s;
    c.glow.push(ell(x, y - r, r, r * 0.9, c.evening ? "#fff1d2" : "#f4f1ea"));
    for (let i = -3; i <= 3; i++) c.glow.push(line(x - Math.sqrt(1 - (i / 3.6) ** 2) * r, y - r + (i * r * 0.9) / 3.6, x + Math.sqrt(1 - (i / 3.6) ** 2) * r, y - r + (i * r * 0.9) / 3.6, "#d8d0c0", 0.18));
    addLight(c, x, y - r, 44, 0.6);
  } else {
    c.glow.push(path(`M${f(x - 1.5)} ${f(y - 10 * s)} h3 l${f(5 * s)} ${f(10 * s)} h-${f(10 * s + 3)} z`, color));
    c.glow.push(ell(x, y, 6.4 * s, 0.9, c.evening ? "#fff3d6" : shade(color, -0.25)));
    addLight(c, x, y + 3, 36, 0.6);
  }
}

/** Wall sconce (wall layer, its shade glows). */
export function sconce(c: Ctx, x: number, h: number, metal: string, shadeC: string, kind: "arm" | "globe" | "cone") {
  const y = Y(h);
  c.wall.push(rr(x - 1.2, y - 2, 2.4, 4.5, 1.2, metal));
  if (kind === "globe") {
    c.wall.push(line(x, y, x, y - 4, metal, 0.5));
    c.glow.push(`<circle cx="${f(x)}" cy="${f(y - 7)}" r="3.6" fill="${c.evening ? "#fff1cf" : "#f3f1ec"}"/>`);
    addLight(c, x, y - 7, 30, 0.6);
  } else {
    const t = kind === "arm" ? 6 : 0;
    c.wall.push(path(`M${f(x)} ${f(y)} h${t} v-3`, "none", ` stroke="${metal}" stroke-width=".55"`));
    const sx = x + t;
    c.glow.push(path(`M${f(sx - 3)} ${f(y - 10)} h6 l1.6 7 h-9.2 z`, lit(c, shadeC)));
    addLight(c, sx, y - 6, 30, 0.6);
  }
}

// ---------- small things on surfaces ----------
export type DecorKind = "vase" | "branches" | "bowl" | "books" | "candles" | "sphere" | "succulent" | "trailing" | "tray" | "kettle" | "boards" | "jars" | "fruit" | "laptop" | "tasklamp" | "mug" | "cups" | "cakestand" | "clock" | "basket";
export function decor(c: Ctx, kind: DecorKind, x: number, s: Surface, scale = 1) {
  const y = Y(s.h, s.d);
  const k = scale;
  const col = c.r.pick(CERAMICS);
  const parts: string[] = [];
  const dropShadow = (w: number) => ell(x, y, w * 0.6, 0.6, "#000", op(0.16));
  switch (kind) {
    case "vase":
    case "branches": {
      const h = c.r.range(8, 12) * k;
      const w = c.r.range(4, 5.5) * k;
      parts.push(dropShadow(w));
      if (kind === "branches") {
        for (let i = 0; i < 5; i++) {
          const ang = -90 + (i - 2) * 14 + c.r.range(-5, 5);
          const len = c.r.range(12, 20) * k;
          const rad = (ang * Math.PI) / 180;
          const ex = x + Math.cos(rad) * len;
          const ey = y - h + Math.sin(rad) * len;
          parts.push(line(x, y - h, ex, ey, "#6b5440", 0.25));
          for (let t = 0.3; t < 1; t += 0.14) {
            const lx = x + (ex - x) * t;
            const ly = y - h + (ey - (y - h)) * t;
            parts.push(ell(lx + c.r.range(-1, 1), ly, 0.9 * k, 0.7 * k, c.r.pick(["#8f9a7a", "#a3ab8c", "#75825f", "#b9a37a"])));
          }
        }
      }
      parts.push(path(`M${f(x - w * 0.22)} ${f(y - h)} h${f(w * 0.44)} q${f(w * 0.8)} ${f(h * 0.35)} ${f(w * 0.3)} ${f(h)} h-${f(w * 1.04)} q-${f(w * 0.5)} -${f(h * 0.65)} ${f(w * 0.3)} -${f(h)} z`, col));
      parts.push(ell(x - w * 0.18, y - h * 0.5, w * 0.12, h * 0.22, "#fff", op(0.2)));
      break;
    }
    case "bowl": {
      parts.push(dropShadow(8 * k), path(`M${f(x - 5 * k)} ${f(y - 3.2 * k)} h${f(10 * k)} q-${f(1 * k)} ${f(3.2 * k)} -${f(5 * k)} ${f(3.2 * k)} q-${f(4 * k)} 0 -${f(5 * k)} -${f(3.2 * k)} z`, col));
      break;
    }
    case "fruit": {
      parts.push(dropShadow(9 * k));
      for (const [dx, dy, cc] of [[-2.4, -4, "#d98c3a"], [0.6, -4.6, "#c9a43a"], [2.8, -3.8, "#b8452f"], [-0.6, -5.8, "#8ba04a"]] as const) parts.push(`<circle cx="${f(x + dx * k)}" cy="${f(y + dy * k)}" r="${f(1.8 * k)}" fill="${cc}"/>`);
      parts.push(path(`M${f(x - 5.5 * k)} ${f(y - 3.4 * k)} h${f(11 * k)} q-${f(1 * k)} ${f(3.4 * k)} -${f(5.5 * k)} ${f(3.4 * k)} q-${f(4.5 * k)} 0 -${f(5.5 * k)} -${f(3.4 * k)} z`, col));
      break;
    }
    case "books": {
      let yy = y;
      const w = c.r.range(7, 9) * k;
      for (let i = 0; i < c.r.int(2, 4); i++) {
        const bh = c.r.range(0.9, 1.5) * k;
        const bc = c.r.pick(BOOKS);
        parts.push(rect(x - w / 2 + c.r.range(-0.6, 0.6), yy - bh, w, bh, bc), rect(x - w / 2 + 0.4, yy - bh * 0.6, w - 0.8, 0.2, "#fff", op(0.5)));
        yy -= bh;
      }
      if (c.r.chance(0.5)) parts.push(`<circle cx="${f(x)}" cy="${f(yy - 2.2 * k)}" r="${f(2.2 * k)}" fill="${c.r.pick(CERAMICS)}"/>`);
      break;
    }
    case "candles": {
      for (const dx of [-1.6, 1.6]) {
        const h = dx < 0 ? 12 : 9;
        parts.push(rect(x + dx * k - 0.9, y - 1, 1.8, 1, "#b8955a"), rect(x + dx * k - 0.25, y - (h + 1) * k, 0.5, h * k, "#b8955a"), rect(x + dx * k - 0.4, y - (h + 6) * k, 0.8, 5 * k, "#f4efe4"));
        if (c.evening) c.glow.push(ell(x + dx * k, y - (h + 7) * k, 0.45, 0.9, "#ffd27a"));
      }
      addLight(c, x, y - 18 * k, 14, 0.4);
      break;
    }
    case "sphere": {
      parts.push(dropShadow(5 * k), rect(x - 2.5 * k, y - 2 * k, 5 * k, 2 * k, shade(col, -0.1)), `<circle cx="${f(x)}" cy="${f(y - 5 * k)}" r="${f(3 * k)}" fill="${col}"/>`);
      break;
    }
    case "succulent": {
      parts.push(dropShadow(4 * k));
      for (let i = 0; i < 6; i++) parts.push(`${leafPath(x, y - 3.2 * k, 3.2 * k, 1, -90 + (i - 2.5) * 28)} fill="${c.r.pick(["#7d9a76", "#8fa98a", "#6b8a66"])}"/>`);
      parts.push(path(`M${f(x - 2.2 * k)} ${f(y - 3.4 * k)} h${f(4.4 * k)} l-${f(0.5 * k)} ${f(3.4 * k)} h-${f(3.4 * k)} z`, col));
      break;
    }
    case "trailing": {
      parts.push(trailing(c, x, y - 4 * k, 10 * k), path(`M${f(x - 2.4 * k)} ${f(y - 4 * k)} h${f(4.8 * k)} l-${f(0.6 * k)} ${f(4 * k)} h-${f(3.6 * k)} z`, col));
      break;
    }
    case "tray": {
      parts.push(rr(x - 6 * k, y - 0.9, 12 * k, 0.9, 0.3, "#b8955a"), rr(x - 3.5 * k, y - 4.5 * k, 2.2, 3.6 * k, 0.6, "#dfe6e6", op(0.7)), rr(x + 0.5 * k, y - 3.4 * k, 2.6, 2.5 * k, 0.6, c.r.pick(CERAMICS)));
      break;
    }
    case "kettle": {
      const kc = c.r.pick(["#e9e4da", "#2b2d31", "#9a9a96", "#c9893f", "#7d8c74"]);
      parts.push(dropShadow(6), path(`M${f(x - 3.6)} ${f(y)} h7.2 q0.4 -5 -1.6 -6.4 h-4 q-2 1.4 -1.6 6.4 z`, kc), path(`M${f(x - 2.4)} ${f(y - 6.4)} q2.4 -4 4.8 0`, "none", ` stroke="#2b2b2b" stroke-width=".55"`), path(`M${f(x + 3.4)} ${f(y - 3.4)} l2.4 -2.2`, "none", ` stroke="${kc}" stroke-width=".9"`));
      break;
    }
    case "boards": {
      const w1 = WOODS.oak;
      parts.push(rr(x - 5, y - 15, 10, 15, 3, shade(w1, 0.05)), `<circle cx="${f(x)}" cy="${f(y - 13.2)}" r=".6" fill="${shade(w1, -0.3)}"/>`, rr(x - 0.5, y - 12, 9, 12, 2, WOODS.walnut));
      break;
    }
    case "jars": {
      for (const [dx, hh, cc] of [[-3, 7, "#d8b77a"], [1, 9, "#e9e1d0"], [4.6, 6, "#8a5a36"]] as const) parts.push(rr(x + dx - 1.6, y - hh, 3.2, hh, 0.6, "#dfe6e6", op(0.55)), rect(x + dx - 1.3, y - hh * 0.7, 2.6, hh * 0.7 - 0.3, cc, op(0.85)), rect(x + dx - 1.7, y - hh - 0.8, 3.4, 0.9, shade(WOODS.oak, -0.1)));
      break;
    }
    case "laptop": {
      parts.push(path(`M${f(x - 7)} ${f(y - 0.6)} h14 l0.8 0.6 h-15.6 z`, "#b9bcc0"), path(`M${f(x - 6.2)} ${f(y - 0.6)} l0.6 -8.8 h11.2 l0.6 8.8 z`, "#c9ccd0"), path(`M${f(x - 5.5)} ${f(y - 1.2)} l0.5 -7.6 h10 l0.5 7.6 z`, c.evening ? "#9fb3c9" : "#2f3237"));
      if (c.evening) addLight(c, x, y - 5, 14, 0.25);
      break;
    }
    case "tasklamp": {
      const m = c.r.pick(METALS);
      parts.push(ell(x, y - 0.4, 3, 0.8, m), line(x, y - 0.6, x - 2.5, y - 10, m, 0.5), line(x - 2.5, y - 10, x + 4, y - 15, m, 0.5));
      c.front.push(parts.join(""));
      c.glow.push(path(`M${f(x + 2.8)} ${f(y - 16.6)} l4.6 1.8 l-1.6 4.2 l-4.6 -1.8 z`, c.evening ? "#ffe9b8" : m));
      addLight(c, x + 6, y - 11, 24, 0.55);
      return;
    }
    case "mug": {
      parts.push(rr(x - 1.3, y - 3, 2.6, 3, 0.5, col), path(`M${f(x + 1.3)} ${f(y - 2.4)} q1.3 0.3 0 1.8`, "none", ` stroke="${col}" stroke-width=".45"`));
      break;
    }
    case "cups": {
      for (const dx of [-3.5, 3.5]) parts.push(ell(x + dx, y - 0.2, 2.6, 0.5, shade(col, -0.05)), rr(x + dx - 1.4, y - 2.5, 2.8, 2.3, 0.6, col));
      if (c.r.chance(0.6)) parts.push(rect(x - 0.3, y - 4.5, 0.6, 4.5, "#e9e1d0"), ell(x, y - 5, 1.4, 1.1, "#c9893f"));
      break;
    }
    case "cakestand": {
      parts.push(rect(x - 0.4, y - 4, 0.8, 4, "#e9e4da"), ell(x, y - 4, 6, 0.8, "#efebe3"), path(`M${f(x - 4.5)} ${f(y - 4.4)} v-3 q4.5 -1.6 9 0 v3 z`, "#d8b77a"), rect(x - 4.5, y - 6.2, 9, 0.8, "#f4efe4"));
      parts.push(path(`M${f(x - 6)} ${f(y - 4.4)} Q${f(x - 6)} ${f(y - 13)} ${f(x)} ${f(y - 13)} Q${f(x + 6)} ${f(y - 13)} ${f(x + 6)} ${f(y - 4.4)}`, "#ffffff", ` opacity=".28" stroke="#cfd6d6" stroke-width=".25"`));
      break;
    }
    case "clock": {
      parts.push(`<circle cx="${f(x)}" cy="${f(y - 3.5)}" r="3.5" fill="#efe9df" stroke="#2b2d31" stroke-width=".4"/>`, line(x, y - 3.5, x, y - 5.8, "#2b2d31", 0.3), line(x, y - 3.5, x + 1.4, y - 3.5, "#2b2d31", 0.3));
      break;
    }
    case "basket": {
      parts.push(dropShadow(8), path(`M${f(x - 5)} ${f(y - 6)} h10 l-1 6 h-8 z`, "#c4a172"), path(`M${f(x - 5)} ${f(y - 6)} h10 l-1 6 h-8 z`, `url(#${ID}weave)`));
      break;
    }
  }
  c.front.push(parts.join(""));
}

// ---------- floor & wall extras ----------
export function rug(c: Ctx, o: { x0: number; x1: number; d0: number; d1: number; base: string; accent: string; style: "border" | "stripe" | "diamond" | "jute" | "plain" }) {
  const { x0, x1, d0, d1, base, accent, style } = o;
  const q = (x: number, d: number): [number, number] => [fx(c, x, d), Y(0, d)];
  const quad = (a: number, b: number, e: number, g: number) => [q(a, e), q(b, e), q(b, g), q(a, g)] as [number, number][];
  const parts: string[] = [];
  parts.push(poly(quad(x0, x1, d0, d1), base));
  if (style === "border") {
    parts.push(poly(quad(x0 + 3, x1 - 3, d0 + 3, d1 - 3), accent), poly(quad(x0 + 4.5, x1 - 4.5, d0 + 4.5, d1 - 4.5), base));
  } else if (style === "stripe") {
    for (let dd = d0 + 4; dd < d1 - 2; dd += 7) parts.push(poly(quad(x0, x1, dd, dd + 1.6), accent));
  } else if (style === "diamond") {
    const step = 9;
    for (let x = x0 + 4; x < x1 - 4; x += step) {
      const md = (d0 + d1) / 2;
      parts.push(`<polyline points="${[q(x, md), q(x + step / 2, md - 6), q(x + step, md), q(x + step / 2, md + 6), q(x, md)].map(([a, b]) => `${f(a)},${f(b)}`).join(" ")}" fill="none" stroke="${accent}" stroke-width=".5"/>`);
    }
    parts.push(poly(quad(x0 + 1.5, x1 - 1.5, d0 + 1.5, d0 + 2.5), accent), poly(quad(x0 + 1.5, x1 - 1.5, d1 - 2.5, d1 - 1.5), accent));
  } else if (style === "jute") {
    for (let dd = d0 + 1; dd < d1; dd += 1.6) parts.push(`<polyline points="${[q(x0, dd), q(x1, dd)].map(([a, b]) => `${f(a)},${f(b)}`).join(" ")}" stroke="${shade(base, -0.12)}" stroke-width=".25"/>`);
  }
  parts.push(poly(quad(x0, x1, d0, d1), `url(#${ID}rugsh)`));
  c.floor.push(parts.join(""));
}

/** Window in the wall, with daylight or evening outside. */
export function windowOpening(c: Ctx, o: { x0: number; w: number; sill: number; top: number; trim: string; panes: 2 | 3 | 4; curtains?: string | null }) {
  const { x0, w, sill, top, trim, panes } = o;
  const y0 = Y(top);
  const y1 = Y(sill);
  const gid = uid(c, "sky");
  c.defs.push(
    c.evening
      ? `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e2840"/><stop offset="1" stop-color="#3b4766"/></linearGradient>`
      : `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0ea"/><stop offset=".7" stop-color="#eef3f2"/><stop offset="1" stop-color="#f6f4ee"/></linearGradient>`,
  );
  const parts: string[] = [];
  parts.push(rect(x0 - 2.5, y0 - 2.5, w + 5, y1 - y0 + 5, trim));
  const cid = uid(c, "win");
  c.defs.push(`<clipPath id="${cid}"><rect x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(y1 - y0)}"/></clipPath>`);
  parts.push(rect(x0, y0, w, y1 - y0, `url(#${gid})`));
  parts.push(`<g clip-path="url(#${cid})">`);
  // a tree outside
  const tcol = c.evening ? "#1b2235" : "#b9c8b0";
  for (let i = 0; i < 7; i++) parts.push(ell(x0 + c.r.range(0, w), y1 - c.r.range(4, (y1 - y0) * 0.55), c.r.range(5, 10), c.r.range(4, 8), tcol, op(c.evening ? 0.8 : 0.6)));
  if (c.evening) for (let i = 0; i < 3; i++) parts.push(rect(x0 + c.r.range(2, w - 4), y0 + c.r.range(4, (y1 - y0) * 0.5), 1.4, 1.8, "#e8c27a", op(0.8)));
  parts.push(`</g>`);
  // mullions
  const cols = panes === 4 ? 2 : panes === 3 ? 3 : 2;
  const rows = panes === 4 ? 2 : 1;
  for (let i = 1; i < cols; i++) parts.push(rect(x0 + (i * w) / cols - 0.6, y0, 1.2, y1 - y0, trim));
  for (let j = 1; j < rows; j++) parts.push(rect(x0, y0 + (j * (y1 - y0)) / rows - 0.6, w, 1.2, trim));
  parts.push(rect(x0, y0, w, 1.4, "#000", op(0.08)));
  // sill
  parts.push(rect(x0 - 4, y1 + 1.5, w + 8, 1.6, shade(trim, -0.03)), rect(x0 - 4, y1 + 3.1, w + 8, 0.8, "#000", op(0.12)));
  if (o.curtains) {
    const cc = o.curtains;
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x0 - 8 : x0 + w + 1;
      const cw = 9;
      parts.push(path(`M${f(cx)} ${f(y0 - 8)} h${cw} q-1 ${f((FLOOR - y0) * 0.5)} ${f(side < 0 ? 1.5 : -1.5)} ${f(FLOOR - y0 + 7.5)} h-${cw - 1} q1 -${f((FLOOR - y0) * 0.5)} -1 -${f(FLOOR - y0 + 7.5)} z`, cc));
      for (let k = 1; k < 4; k++) parts.push(line(cx + (k * cw) / 4, y0 - 7, cx + (k * cw) / 4 + c.r.range(-0.6, 0.6), FLOOR - 1, shade(cc, -0.12), 0.6, op(0.6)));
    }
    parts.push(rect(x0 - 12, y0 - 9, w + 24, 0.9, "#2b2b2b"));
  }
  c.wall.push(parts.join(""));
  if (!c.evening) {
    // daylight pool on the floor in front of the window
    c.floor.push(poly([[fx(c, x0 + c.side * -4, 2), Y(0, 2)], [fx(c, x0 + w + c.side * -4, 2), Y(0, 2)], [fx(c, x0 + w - c.side * 30, 50), Y(0, 50)], [fx(c, x0 - c.side * 30, 50), Y(0, 50)]], "#fff8e6", ` opacity=".22" filter="url(#${ID}soft)"`));
  }
}

/** Coat hooks with a bag or hat (wall layer). */
export function hooks(c: Ctx, x0: number, w: number, h: number, wood: string) {
  const parts: string[] = [];
  const y = Y(h);
  parts.push(rect(x0, y, w, 4, wood), rect(x0, y + 4, w, 0.5, "#000", op(0.12)));
  const n = Math.max(3, Math.round(w / 9));
  for (let i = 0; i < n; i++) {
    const hx = x0 + ((i + 0.5) * w) / n;
    parts.push(`<circle cx="${f(hx)}" cy="${f(y + 2)}" r="1" fill="${shade(wood, -0.3)}"/>`);
  }
  // a tote and a hat hang off two hooks
  const tx = x0 + (0.5 * w) / n;
  const tc = c.r.pick(["#d8c7a8", "#3f5a4c", "#b8673f", "#2f3a4a"]);
  parts.push(path(`M${f(tx - 2.5)} ${f(y + 2)} L${f(tx - 5)} ${f(y + 10)} M${f(tx + 2.5)} ${f(y + 2)} L${f(tx + 5)} ${f(y + 10)}`, "none", ` stroke="${shade(tc, -0.2)}" stroke-width=".5"`));
  parts.push(rr(tx - 6, y + 9.5, 12, 13, 1, tc));
  const hx = x0 + ((n - 0.5) * w) / n;
  parts.push(ell(hx, y + 6.5, 6.5, 1.4, "#8a6a4c"), path(`M${f(hx - 3.6)} ${f(y + 6)} q0 -4.4 3.6 -4.4 q3.6 0 3.6 4.4 z`, "#8a6a4c"), rect(hx - 3.6, y + 4.6, 7.2, 1, "#2b2b2b"));
  c.wall.push(parts.join(""));
}
