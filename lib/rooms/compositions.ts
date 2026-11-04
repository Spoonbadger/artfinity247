// Hand-laid room compositions. Each places furniture around a wall spot where the print hangs.
// x runs in inches across the wall; the art usually hangs near x = 100.

import {
  armchair, banquette, bed, bench, bookshelf, cabinet, chair, counter, decor, floorLamp, floorPlant, hooks, pendant, roundTable, rug, sconce, sofa, table, tableLamp, wallShelf, windowOpening,
  type CaseStyle, type Ctx, type FloorLampKind, type PendantKind, type PotKind, type SofaStyle, type TableLampKind,
} from "./draw";

export type Kit = {
  fabric: string;
  fabric2: string;
  wood: string;
  wood2: string;
  metal: string;
  ceramic: string;
  plant: "fig" | "snake" | "olive" | "palm" | "monstera" | "bird";
  pot: PotKind;
  floorLamp: FloorLampKind;
  tableLamp: TableLampKind;
  pendant: PendantKind;
  shadeC: string;
  rugStyle: "border" | "stripe" | "diamond" | "jute" | "plain";
  rugBase: string;
  rugAccent: string;
  pillows: string[];
  throwColor: string | null;
  sofaStyle: SofaStyle;
  caseStyle: CaseStyle;
  caseColor: string;
  chairKind: "bentwood" | "spindle" | "cane" | "molded";
  chairColor: string;
  kitchen: string; // cabinet paint
  worktop: string;
  splash: "tile" | "zellige" | "slab" | "none";
  linen: string;
  duvet: string;
  head: "round" | "channel" | "slat" | "cane" | "wing";
  curtains: string | null;
  plantH: number;
};

export type Hang = { cx: number; base?: number; center?: number };
export type Comp = (c: Ctx, k: Kit) => { hang: Hang; focus: number; window?: boolean };

const plant = (c: Ctx, k: Kit, x: number, d = 10, h?: number) => floorPlant(c, { x, d, kind: k.plant, h: h ?? k.plantH, pot: k.pot });

// ---------- living room ----------
const living: Comp[] = [
  // sofa, side table with lamp, plant, coffee table on a rug
  (c, k) => {
    rug(c, { x0: 38, x1: 162, d0: 26, d1: 74, base: k.rugBase, accent: k.rugAccent, style: k.rugStyle });
    plant(c, k, 46, 8);
    const s = sofa(c, { x0: 58, w: 84, color: k.fabric, style: k.sofaStyle, legs: k.wood, pillows: k.pillows, throwColor: k.throwColor });
    const t = table(c, { x0: 146, w: 20, h: 22, d0: 2, d1: 20, top: k.wood, legs: k.wood, style: "slab" });
    tableLamp(c, { x: 156, s: t, kind: k.tableLamp, base: k.ceramic, shadeC: k.shadeC, scale: 0.95 });
    const ct = roundTable(c, 100, 34, 16, 58, k.wood2, k.wood2);
    decor(c, c.r.pick(["books", "bowl", "vase", "tray"] as const), 94, ct, 0.9);
    return { hang: { cx: 100, base: s.back + 9 }, focus: 104 };
  },
  // sofa under a window-side arc lamp
  (c, k) => {
    windowOpening(c, { x0: 18, w: 30, sill: 30, top: 86, trim: c.pal.trim, panes: 4, curtains: k.curtains });
    rug(c, { x0: 52, x1: 160, d0: 24, d1: 72, base: k.rugBase, accent: k.rugAccent, style: k.rugStyle });
    const s = sofa(c, { x0: 64, w: 80, color: k.fabric, style: k.sofaStyle, legs: k.wood, pillows: k.pillows.slice(0, 2), throwColor: k.throwColor });
    floorLamp(c, { x: 168, d: 10, kind: k.floorLamp === "arc" ? "cone" : k.floorLamp, metal: k.metal, shadeC: k.shadeC });
    return { hang: { cx: 104, base: s.back + 9 }, focus: 96, window: true };
  },
  // low console with a lamp, armchair, tall plant
  (c, k) => {
    plant(c, k, 42, 8);
    const s = cabinet(c, { x0: 62, w: 76, h: 26, d: 18, color: k.caseColor, style: k.caseStyle });
    tableLamp(c, { x: 72, s, kind: k.tableLamp, base: k.ceramic, shadeC: k.shadeC, scale: 0.9 });
    decor(c, c.r.pick(["vase", "branches", "books", "sphere"] as const), 128, s);
    rug(c, { x0: 70, x1: 180, d0: 30, d1: 70, base: k.rugBase, accent: k.rugAccent, style: k.rugStyle });
    armchair(c, { x0: 146, color: k.fabric2, kind: c.r.pick(["lounge", "frame", "boucle"] as const), wood: k.wood, d: 8 });
    return { hang: { cx: 100, base: 38 }, focus: 106 };
  },
  // symmetrical sofa with two lamps
  (c, k) => {
    rug(c, { x0: 44, x1: 156, d0: 26, d1: 72, base: k.rugBase, accent: k.rugAccent, style: k.rugStyle });
    const s = sofa(c, { x0: 62, w: 76, color: k.fabric, style: k.sofaStyle, legs: k.wood, pillows: k.pillows, throwColor: null });
    for (const x0 of [40, 142]) {
      const t = table(c, { x0, w: 18, h: 23, d0: 2, d1: 18, top: k.wood2, legs: k.wood2, style: "apron" });
      tableLamp(c, { x: x0 + 9, s: t, kind: k.tableLamp, base: k.ceramic, shadeC: k.shadeC, scale: 0.9 });
    }
    return { hang: { cx: 100, base: s.back + 9 }, focus: 100 };
  },
];

// ---------- kitchen ----------
const kitchen: Comp[] = [
  // counter run with sink, shelf of dishes
  (c, k) => {
    counter(c, { x0: 22, w: 156, color: k.kitchen, top: k.worktop, splash: k.splash, pull: k.metal, sinkAt: 52 });
    wallShelf(c, 132, 40, 64, k.wood, "kitchen");
    const s = { x0: 22, x1: 178, h: 36, d: 10 };
    decor(c, "kettle", 150, s);
    decor(c, "boards", 134, s);
    decor(c, c.r.pick(["fruit", "jars", "bowl"] as const), 78, s);
    if (c.r.chance(0.5)) pendant(c, { x: 50, h: 74, d: 30, kind: k.pendant, color: k.metal });
    return { hang: { cx: 100, base: 36 + (k.splash === "slab" ? 5 : k.splash === "none" ? 0 : 12) + 5 }, focus: 104 };
  },
  // breakfast table under the art
  (c, k) => {
    windowOpening(c, { x0: 140, w: 30, sill: 36, top: 84, trim: c.pal.trim, panes: c.r.pick([2, 4] as const), curtains: null });
    plant(c, k, 46, 8, k.plantH * 0.85);
    chair(c, { x: 80, d: 30, kind: k.chairKind, color: k.chairColor, view: "profile" });
    chair(c, { x: 120, d: 30, kind: k.chairKind, color: k.chairColor, view: "profile", flip: true });
    const t = roundTable(c, 100, 32, 29, 30, k.wood2, k.metal);
    decor(c, c.r.pick(["fruit", "branches", "vase"] as const), 100, t);
    return { hang: { cx: 100, center: 61 }, focus: 108, window: true };
  },
  // open shelves on the left, art over the worktop on the right
  (c, k) => {
    counter(c, { x0: 30, w: 132, color: k.kitchen, top: k.worktop, splash: k.splash === "tile" ? "slab" : k.splash, pull: k.metal, sinkAt: null });
    wallShelf(c, 30, 40, 56, k.wood, "kitchen");
    wallShelf(c, 30, 40, 72, k.wood, "kitchen");
    const s = { x0: 30, x1: 162, h: 36, d: 10 };
    decor(c, "jars", 44, s);
    decor(c, "kettle", 140, s);
    decor(c, c.r.pick(["trailing", "succulent", "fruit"] as const), 152, s);
    return { hang: { cx: 112, base: 47 }, focus: 100 };
  },
  // tall pantry, short counter, plant
  (c, k) => {
    cabinet(c, { x0: 20, w: 30, h: 86, d: 24, color: k.kitchen, style: "plinth", pull: k.metal });
    counter(c, { x0: 52, w: 96, color: k.kitchen, top: k.worktop, splash: "slab", pull: k.metal, sinkAt: null });
    const s = { x0: 52, x1: 148, h: 36, d: 10 };
    decor(c, "jars", 62, s);
    decor(c, c.r.pick(["cakestand", "fruit", "bowl"] as const), 134, s);
    decor(c, "boards", 74, s);
    plant(c, k, 164, 10);
    return { hang: { cx: 100, base: 50 }, focus: 96 };
  },
];

// ---------- office ----------
const office: Comp[] = [
  // desk with lamp and laptop, chair tucked in
  (c, k) => {
    plant(c, k, 42, 8);
    const d = table(c, { x0: 64, w: 72, h: 29.5, d0: 0, d1: 24, top: k.wood, legs: c.r.pick([k.wood, k.metal]), style: c.r.pick(["trestle", "hairpin", "apron"] as const) });
    decor(c, "tasklamp", 72, d);
    decor(c, "laptop", 102, d);
    decor(c, c.r.pick(["books", "succulent", "mug"] as const), 126, d);
    chair(c, { x: 100, d: 36, kind: c.r.chance(0.5) ? "task" : k.chairKind, color: k.chairColor, view: "back" });
    return { hang: { cx: 100, base: 48 }, focus: 96 };
  },
  // bookshelf, desk, globe lamp
  (c, k) => {
    bookshelf(c, 16, 38, 80, k.wood2);
    const d = table(c, { x0: 70, w: 70, h: 29.5, d0: 0, d1: 24, top: k.wood, legs: k.wood, style: "apron" });
    decor(c, "books", 128, d);
    decor(c, c.r.pick(["mug", "succulent", "clock"] as const), 80, d);
    decor(c, "laptop", 104, d);
    chair(c, { x: 104, d: 36, kind: k.chairKind, color: k.chairColor, view: "back" });
    floorLamp(c, { x: 160, d: 8, kind: c.r.pick(["globe", "cone"] as const), metal: k.metal, shadeC: k.shadeC });
    return { hang: { cx: 105, base: 49 }, focus: 96 };
  },
  // credenza with a lounge chair
  (c, k) => {
    armchair(c, { x0: 16, color: k.fabric, kind: "frame", wood: k.wood, d: 6 });
    floorLamp(c, { x: 54, d: 6, kind: "cone", metal: k.metal, shadeC: k.shadeC });
    const s = cabinet(c, { x0: 64, w: 76, h: 28, d: 18, color: k.caseColor, style: c.r.pick(["drawers", "plinth", "fluted"] as const) });
    decor(c, "books", 128, s);
    decor(c, c.r.pick(["sphere", "vase", "clock"] as const), 76, s);
    floorPlant(c, { x: 160, d: 8, kind: "snake", h: 34, pot: k.pot });
    return { hang: { cx: 102, base: 40 }, focus: 92 };
  },
  // desk with floating shelves beside
  (c, k) => {
    const d = table(c, { x0: 56, w: 72, h: 29.5, d0: 0, d1: 24, top: k.wood, legs: k.metal, style: "hairpin" });
    wallShelf(c, 136, 38, 52, k.wood, "mixed");
    wallShelf(c, 136, 38, 68, k.wood, "books");
    decor(c, "tasklamp", 64, d);
    decor(c, c.r.pick(["trailing", "succulent", "books"] as const), 118, d);
    chair(c, { x: 92, d: 36, kind: c.r.chance(0.6) ? "task" : k.chairKind, color: k.chairColor, view: "back" });
    if (c.r.chance(0.6)) floorPlant(c, { x: 158, d: 10, kind: k.plant === "olive" ? "olive" : "snake", h: 32, pot: k.pot });
    return { hang: { cx: 92, base: 48 }, focus: 108 };
  },
];

// ---------- bedroom ----------
const bedroom: Comp[] = [
  (c, k) => {
    const b = bed(c, { x0: 70, w: 60, head: k.head, headColor: k.fabric, wood: k.wood, linen: k.linen, duvet: k.duvet, throwColor: k.fabric2, pillows: k.pillows.slice(0, 1) });
    for (const x0 of [46, 134]) {
      const s = cabinet(c, { x0, w: 20, h: 23, d: 16, color: k.caseColor, style: c.r.chance(0.5) ? "drawers" : "legs" });
      tableLamp(c, { x: x0 + 10, s, kind: k.tableLamp, base: k.ceramic, shadeC: k.shadeC, scale: 0.85 });
    }
    return { hang: { cx: 100, base: b.head + 8 }, focus: 100 };
  },
  // sconces and one nightstand
  (c, k) => {
    const b = bed(c, { x0: 66, w: 68, head: k.head === "round" ? "channel" : k.head, headColor: k.fabric, wood: k.wood, linen: k.linen, duvet: k.duvet, throwColor: k.fabric2, pillows: k.pillows.slice(0, 2) });
    sconce(c, 56, 54, k.metal, k.shadeC, c.r.pick(["arm", "globe", "cone"] as const));
    sconce(c, 144, 54, k.metal, k.shadeC, c.r.pick(["globe", "cone"] as const));
    const s = cabinet(c, { x0: 40, w: 20, h: 22, d: 16, color: k.caseColor, style: "legs" });
    decor(c, "books", 50, s, 0.8);
    plant(c, k, 160, 10);
    return { hang: { cx: 100, base: b.head + 8 }, focus: 100 };
  },
  // dresser with lamp and chair
  (c, k) => {
    plant(c, k, 40, 8);
    const s = cabinet(c, { x0: 62, w: 76, h: 34, d: 18, color: k.caseColor, style: "drawers" });
    tableLamp(c, { x: 72, s, kind: k.tableLamp, base: k.ceramic, shadeC: k.shadeC, scale: 0.85 });
    decor(c, c.r.pick(["tray", "vase", "branches"] as const), 128, s);
    chair(c, { x: 154, d: 14, kind: k.chairKind, color: k.chairColor, view: "front" });
    return { hang: { cx: 100, base: 46 }, focus: 104 };
  },
  // bed off-center with a window
  (c, k) => {
    windowOpening(c, { x0: 18, w: 32, sill: 30, top: 86, trim: c.pal.trim, panes: 2, curtains: k.curtains });
    const b = bed(c, { x0: 76, w: 60, head: k.head, headColor: k.fabric, wood: k.wood, linen: k.linen, duvet: k.duvet, throwColor: k.fabric2, pillows: k.pillows.slice(0, 1) });
    const s = cabinet(c, { x0: 142, w: 20, h: 23, d: 16, color: k.caseColor, style: "legs" });
    tableLamp(c, { x: 152, s, kind: k.tableLamp, base: k.ceramic, shadeC: k.shadeC, scale: 0.85 });
    return { hang: { cx: 106, base: b.head + 8 }, focus: 96, window: true };
  },
];

// ---------- dining ----------
const dining: Comp[] = [
  // sideboard behind a dining table
  (c, k) => {
    const s = cabinet(c, { x0: 62, w: 76, h: 32, d: 18, color: k.caseColor, style: k.caseStyle });
    decor(c, "candles", 72, s);
    decor(c, c.r.pick(["vase", "branches", "bowl"] as const), 128, s);
    chair(c, { x: 80, d: 26, kind: k.chairKind, color: k.chairColor, view: "front" });
    chair(c, { x: 120, d: 26, kind: k.chairKind, color: k.chairColor, view: "front" });
    const t = table(c, { x0: 58, w: 84, h: 30, d0: 40, d1: 74, top: k.wood, legs: k.wood, style: c.r.pick(["trestle", "apron", "slab"] as const) });
    decor(c, c.r.pick(["fruit", "bowl", "branches"] as const), 100, t, 0.9);
    chair(c, { x: 52, d: 58, kind: k.chairKind, color: k.chairColor, view: "profile" });
    chair(c, { x: 148, d: 58, kind: k.chairKind, color: k.chairColor, view: "profile", flip: true });
    return { hang: { cx: 100, base: 44 }, focus: 100 };
  },
  // bench and table, palm in the corner
  (c, k) => {
    plant(c, k, 34, 8);
    bench(c, 66, 68, k.wood, c.r.chance(0.5) ? k.fabric : null, 6);
    const t = table(c, { x0: 58, w: 84, h: 30, d0: 26, d1: 60, top: k.wood, legs: k.wood, style: "trestle" });
    decor(c, c.r.pick(["branches", "candles", "fruit"] as const), 104, t);
    chair(c, { x: 50, d: 44, kind: k.chairKind, color: k.chairColor, view: "profile" });
    chair(c, { x: 150, d: 44, kind: k.chairKind, color: k.chairColor, view: "profile", flip: true });
    return { hang: { cx: 100, center: 62 }, focus: 96 };
  },
  // sideboard still life with a tree
  (c, k) => {
    floorPlant(c, { x: 46, d: 8, kind: "olive", h: 64, pot: k.pot });
    const s = cabinet(c, { x0: 70, w: 80, h: 30, d: 18, color: k.caseColor, style: k.caseStyle });
    decor(c, "branches", 80, s);
    decor(c, c.r.pick(["fruit", "bowl", "candles"] as const), 140, s);
    return { hang: { cx: 110, base: 42 }, focus: 100 };
  },
  // round table by a window
  (c, k) => {
    windowOpening(c, { x0: 142, w: 30, sill: 32, top: 86, trim: c.pal.trim, panes: 4, curtains: k.curtains });
    chair(c, { x: 70, d: 40, kind: k.chairKind, color: k.chairColor, view: "profile" });
    chair(c, { x: 122, d: 40, kind: k.chairKind, color: k.chairColor, view: "profile", flip: true });
    const t = roundTable(c, 96, 42, 30, 40, k.wood, k.wood);
    decor(c, c.r.pick(["branches", "vase", "fruit"] as const), 96, t);
    return { hang: { cx: 96, center: 60 }, focus: 110, window: true };
  },
];

// ---------- entry / hallway ----------
const hallway: Comp[] = [
  (c, k) => {
    const t = table(c, { x0: 70, w: 60, h: 31, d0: 0, d1: 13, top: k.wood, legs: c.r.pick([k.wood, k.metal]), style: c.r.pick(["apron", "hairpin", "slab"] as const), shelf: true });
    tableLamp(c, { x: 78, s: t, kind: k.tableLamp, base: k.ceramic, shadeC: k.shadeC, scale: 0.85 });
    decor(c, c.r.pick(["bowl", "tray", "books"] as const), 120, t);
    decor(c, "basket", 100, { x0: 70, x1: 130, h: 0, d: 6 });
    floorPlant(c, { x: 150, d: 8, kind: k.plant === "fig" ? "snake" : k.plant, h: 40, pot: k.pot });
    return { hang: { cx: 100, base: 44 }, focus: 106 };
  },
  // bench with hooks
  (c, k) => {
    hooks(c, 26, 32, 62, k.wood);
    bench(c, 66, 68, k.wood, c.r.chance(0.6) ? k.fabric : null);
    decor(c, "basket", 80, { x0: 66, x1: 134, h: 0, d: 8 });
    plant(c, k, 154, 8, k.plantH * 0.9);
    return { hang: { cx: 100, base: 44 }, focus: 94 };
  },
  // the art alone, eye level, runner rug
  (c, k) => {
    rug(c, { x0: 62, x1: 138, d0: 8, d1: 70, base: k.rugBase, accent: k.rugAccent, style: k.rugStyle === "plain" ? "stripe" : k.rugStyle });
    plant(c, k, 50, 8);
    const t = roundTable(c, 150, 16, 24, 10, k.wood2, k.wood2);
    decor(c, c.r.pick(["vase", "succulent", "books"] as const), 150, t, 0.8);
    return { hang: { cx: 100, center: 58 }, focus: 104 };
  },
  // shoe cabinet between two sconces
  (c, k) => {
    const s = cabinet(c, { x0: 62, w: 76, h: 18, d: 14, color: k.caseColor, style: "plinth" });
    decor(c, c.r.pick(["bowl", "tray", "trailing"] as const), 76, s);
    sconce(c, 68, 66, k.metal, k.shadeC, "globe");
    sconce(c, 132, 66, k.metal, k.shadeC, "globe");
    floorPlant(c, { x: 154, d: 8, kind: "snake", h: 34, pot: k.pot });
    return { hang: { cx: 100, center: 58 }, focus: 104 };
  },
];

// ---------- café wall ----------
const cafe: Comp[] = [
  // banquette, two tables, pendants
  (c, k) => {
    banquette(c, 36, 128, k.fabric, k.wood);
    for (const x of [68, 132]) {
      const t = roundTable(c, x, 24, 29, 32, c.r.pick(["#ece8e1", "#e3ddd2", k.wood2]), "#2a2b2f");
      decor(c, "cups", x, t);
      chair(c, { x, d: 50, kind: c.r.pick(["bentwood", "cane"] as const), color: k.chairColor, view: "back" });
      pendant(c, { x, h: 74, d: 32, kind: k.pendant === "lantern" ? "dome" : k.pendant, color: k.metal });
    }
    return { hang: { cx: 100, base: 46 }, focus: 100 };
  },
  // service counter with a cup shelf
  (c, k) => {
    counter(c, { x0: 36, w: 128, color: k.wood, top: "#e8e3db", splash: "none", pull: k.metal, sinkAt: null });
    wallShelf(c, 128, 40, 66, k.wood2, "cafe");
    const s = { x0: 36, x1: 164, h: 36, d: 10 };
    decor(c, "cakestand", 52, s);
    decor(c, "jars", 146, s);
    decor(c, "cups", 74, s);
    pendant(c, { x: 50, h: 76, d: 30, kind: "globe", color: k.metal });
    return { hang: { cx: 94, base: 50 }, focus: 102 };
  },
  // little table by a bench, palm, cup shelf
  (c, k) => {
    wallShelf(c, 20, 32, 64, k.wood2, "cafe");
    bench(c, 52, 66, k.wood, k.fabric, 2);
    const t = roundTable(c, 86, 24, 29, 30, "#ece8e1", "#2a2b2f");
    decor(c, "cups", 86, t);
    chair(c, { x: 86, d: 50, kind: "bentwood", color: k.chairColor, view: "back" });
    floorPlant(c, { x: 150, d: 8, kind: "palm", h: 56, pot: k.pot });
    return { hang: { cx: 86, base: 44 }, focus: 96 };
  },
];

// ---------- reading nook ----------
const nook: Comp[] = [
  (c, k) => {
    rug(c, { x0: 62, x1: 140, d0: 28, d1: 64, base: k.rugBase, accent: k.rugAccent, style: k.rugStyle });
    plant(c, k, 40, 8);
    const t = table(c, { x0: 58, w: 16, h: 22, d0: 4, d1: 18, top: k.wood2, legs: k.wood2, style: "slab" });
    decor(c, "books", 66, t, 0.8);
    armchair(c, { x0: 82, color: k.fabric, kind: c.r.pick(["wing", "lounge", "boucle"] as const), wood: k.wood, d: 6 });
    floorLamp(c, { x: 134, d: 8, kind: k.floorLamp === "arc" ? "tripod" : k.floorLamp, metal: k.metal, shadeC: k.shadeC });
    return { hang: { cx: 99, base: 50 }, focus: 96 };
  },
  // between two bookshelves
  (c, k) => {
    bookshelf(c, 28, 36, 84, k.wood2);
    bookshelf(c, 136, 36, 84, k.wood2);
    armchair(c, { x0: 83, color: k.fabric, kind: c.r.pick(["wing", "lounge", "frame"] as const), wood: k.wood, d: 8 });
    decor(c, "books", 74, { x0: 70, x1: 80, h: 0, d: 24 }, 0.9);
    return { hang: { cx: 100, base: 50 }, focus: 100 };
  },
  // loveseat with a cone lamp
  (c, k) => {
    rug(c, { x0: 56, x1: 146, d0: 26, d1: 70, base: k.rugBase, accent: k.rugAccent, style: k.rugStyle });
    plant(c, k, 48, 8);
    const s = sofa(c, { x0: 70, w: 60, color: k.fabric, style: c.r.pick(["round", "camel", "tufted"] as const), legs: k.wood, pillows: k.pillows.slice(0, 2), throwColor: k.throwColor });
    floorLamp(c, { x: 146, d: 8, kind: "cone", metal: k.metal, shadeC: k.shadeC });
    return { hang: { cx: 100, base: s.back + 9 }, focus: 100 };
  },
  // chair by a window
  (c, k) => {
    windowOpening(c, { x0: 126, w: 32, sill: 34, top: 84, trim: c.pal.trim, panes: c.r.pick([2, 4] as const), curtains: k.curtains });
    floorLamp(c, { x: 58, d: 8, kind: c.r.pick(["cone", "globe"] as const), metal: k.metal, shadeC: k.shadeC });
    armchair(c, { x0: 70, color: k.fabric, kind: c.r.pick(["frame", "boucle", "lounge"] as const), wood: k.wood, d: 8 });
    decor(c, "books", 114, { x0: 108, x1: 120, h: 0, d: 18 }, 0.9);
    return { hang: { cx: 87, base: 46 }, focus: 104, window: true };
  },
];

export const COMPS = { living, kitchen, office, bedroom, dining, hallway, cafe, nook } as const;
