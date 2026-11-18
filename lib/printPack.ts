// Lays out QR cards of any mix of sizes on any paper, using as few sheets as possible. Pure and client-safe: the
// Print codes screen draws its preview from it and the PDF route (lib/generateQrPdf.ts generatePackedPdf) prints from
// it, so what you see is exactly what prints.
//
// How it packs (all sizes in inches, origin top-left of the paper):
// - A safe margin all round (printers can't reach the edge). Rectangular cards sit edge to edge, so one cut
//   separates two cards. When a print has round cards, every card keeps a small gap so the scissors have room.
// - Biggest cards first, each into the first sheet with room for it (so small cards fill the gaps left on earlier
//   sheets), at the spot that leaves the least waste (MaxRects, best short side fit). Copies of the same card stay
//   next to each other.
// - Turning cards sideways: tried three ways (as drawn unless only sideways fits, sideways first, whichever fits
//   best at each step) and the layout with the fewest sheets wins.
// - Whole-page cards (the poster) get a sheet each, scaled to fit the paper.
// - A ready-cut label sheet (Avery) has fixed slots: only cards of that exact size go on it, one per slot, in order.

export type PaperSize = {
  w: number;
  h: number;
  /** Fixed label slots (Avery sheets), top-left corners in inches, all `slot.w × slot.h`. */
  slots?: { w: number; h: number; at: { x: number; y: number }[] };
};

export type PackItem<T> = {
  w: number;
  h: number;
  /** Round cards keep a cutting gap around them. */
  round?: boolean;
  /** A whole-page card (the poster): one per sheet, scaled to the paper. */
  page?: boolean;
  ref: T;
};

export type Placed<T> = { x: number; y: number; w: number; h: number; rotated: boolean; scale: number; round: boolean; ref: T };
export type PackResult<T> = { sheets: { cards: Placed<T>[] }[]; unplaced: T[] };

/** Printer-safe edge on plain paper. */
export const PAPER_MARGIN = 0.25;
/** Space around round cards, for scissors. */
export const ROUND_GAP = 0.125;
/** Most cards one print may hold (the PDF is rasterised server side). */
export const MAX_CARDS = 500;

const EPS = 1e-6;
type Turn = "keep" | "turn" | "free";
type Rect = { x: number; y: number; w: number; h: number };

/** One sheet's free space, as maximal free rectangles (MaxRects). */
class Bin {
  free: Rect[];
  constructor(W: number, H: number) {
    this.free = [{ x: 0, y: 0, w: W, h: H }];
  }
  /** Best spot for a w×h box (short side fit), or null. keep / turn: that way round only, unless only the other fits. */
  find(w: number, h: number, mode: Turn): { x: number; y: number; turned: boolean } | null {
    if (mode !== "free" && Math.abs(w - h) > EPS) return this.findIn(w, h, mode === "turn" ? [true] : [false]) ?? this.findIn(w, h, mode === "turn" ? [false] : [true]);
    return this.findIn(w, h, Math.abs(w - h) > EPS ? [false, true] : [false]);
  }
  private findIn(w: number, h: number, ways: boolean[]) {
    let best: { x: number; y: number; turned: boolean; a: number; b: number } | null = null;
    for (const f of this.free) {
      for (const turned of ways) {
        const bw = turned ? h : w, bh = turned ? w : h;
        if (bw > f.w + EPS || bh > f.h + EPS) continue;
        const lw = f.w - bw, lh = f.h - bh;
        const a = Math.min(lw, lh), b = Math.max(lw, lh);
        // Ties: higher up, then further left, so sheets fill top to bottom like a page of text.
        if (!best || a < best.a - EPS || (Math.abs(a - best.a) <= EPS && (b < best.b - EPS || (Math.abs(b - best.b) <= EPS && (f.y < best.y - EPS || (Math.abs(f.y - best.y) <= EPS && f.x < best.x)))))) {
          best = { x: f.x, y: f.y, turned, a, b };
        }
      }
    }
    return best;
  }
  place(r: Rect) {
    const next: Rect[] = [];
    for (const f of this.free) {
      if (r.x >= f.x + f.w - EPS || r.x + r.w <= f.x + EPS || r.y >= f.y + f.h - EPS || r.y + r.h <= f.y + EPS) { next.push(f); continue; }
      if (r.x > f.x + EPS) next.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
      if (r.x + r.w < f.x + f.w - EPS) next.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - (r.x + r.w), h: f.h });
      if (r.y > f.y + EPS) next.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
      if (r.y + r.h < f.y + f.h - EPS) next.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - (r.y + r.h) });
    }
    // Drop rectangles that sit inside another.
    this.free = next.filter((a, i) => !next.some((b, j) => j !== i && a.x >= b.x - EPS && a.y >= b.y - EPS && a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS && (j < i || a.w !== b.w || a.h !== b.h || a.x !== b.x || a.y !== b.y)));
  }
}

const sameSize = (w: number, h: number, sw: number, sh: number) => Math.abs(w - sw) < 0.02 && Math.abs(h - sh) < 0.02;

export function pack<T>(items: PackItem<T>[], paper: PaperSize, opts: { margin?: number } = {}): PackResult<T> {
  const sheets: { cards: Placed<T>[] }[] = [];
  const unplaced: T[] = [];
  const list = items.slice(0, MAX_CARDS);
  for (const it of items.slice(MAX_CARDS)) unplaced.push(it.ref);

  // Ready-cut label sheets: one matching card per slot, in the order given.
  if (paper.slots) {
    const S = paper.slots;
    let cur: { cards: Placed<T>[] } | null = null;
    for (const it of list) {
      const fits = sameSize(it.w, it.h, S.w, S.h), turned = !fits && sameSize(it.h, it.w, S.w, S.h);
      if (!fits && !turned) { unplaced.push(it.ref); continue; }
      if (!cur || cur.cards.length >= S.at.length) { cur = { cards: [] }; sheets.push(cur); }
      const at = S.at[cur.cards.length];
      cur.cards.push({ x: at.x, y: at.y, w: S.w, h: S.h, rotated: turned, scale: 1, round: !!it.round, ref: it.ref });
    }
    return { sheets, unplaced };
  }

  const m = opts.margin ?? PAPER_MARGIN;
  const W = paper.w - 2 * m, H = paper.h - 2 * m;
  const g = list.some((it) => it.round && !it.page) ? ROUND_GAP : 0;
  const pages: { cards: Placed<T>[] }[] = [];

  // Largest first; equal sizes keep their order so copies of one card stay together.
  const order = list
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !it.page)
    .sort((a, b) => Math.max(b.it.w, b.it.h) - Math.max(a.it.w, a.it.h) || b.it.w * b.it.h - a.it.w * a.it.h || a.i - b.i);

  const run = (mode: Turn) => {
    const bins: Bin[] = [], out: { cards: Placed<T>[] }[] = [], left: T[] = [];
    for (const { it } of order) {
      // Grow each box and the sheet by the gap, so gaps fall only between cards.
      const bw = it.w + g, bh = it.h + g;
      let done = false;
      for (let s = 0; s <= bins.length && !done; s++) {
        if (s === bins.length) {
          if ((bw > W + g + EPS || bh > H + g + EPS) && (bh > W + g + EPS || bw > H + g + EPS)) break; // never fits
          bins.push(new Bin(W + g, H + g));
          out.push({ cards: [] });
        }
        const spot = bins[s].find(bw, bh, mode);
        if (!spot) continue;
        const pw = spot.turned ? bh : bw, ph = spot.turned ? bw : bh;
        bins[s].place({ x: spot.x, y: spot.y, w: pw, h: ph });
        out[s].cards.push({ x: spot.x, y: spot.y, w: spot.turned ? it.h : it.w, h: spot.turned ? it.w : it.h, rotated: spot.turned, scale: 1, round: !!it.round, ref: it.ref });
        done = true;
      }
      if (!done) left.push(it.ref);
    }
    return { out, left };
  };
  // Fewest sheets wins; on a tie, cards stay the way they were drawn.
  let best = run("keep");
  for (const mode of ["turn", "free"] as const) {
    const r = run(mode);
    if (r.left.length < best.left.length || (r.left.length === best.left.length && r.out.length < best.out.length)) best = r;
  }
  sheets.push(...best.out);
  unplaced.push(...best.left);

  // Centre each sheet's cards on the paper (they were packed from the top-left corner of the safe area).
  for (const sh of sheets) {
    const right = Math.max(...sh.cards.map((c) => c.x + c.w)), bottom = Math.max(...sh.cards.map((c) => c.y + c.h));
    const dx = m + Math.max(0, (W - right) / 2), dy = m + Math.max(0, (H - bottom) / 2);
    for (const c of sh.cards) { c.x += dx; c.y += dy; }
  }

  // Whole-page cards: one per sheet, as large as the paper allows, centred, turned if the paper's the other way.
  for (const it of list) {
    if (!it.page) continue;
    const turned = (it.w > it.h) !== (paper.w > paper.h) && Math.abs(it.w - it.h) > EPS;
    const cw = turned ? it.h : it.w, ch = turned ? it.w : it.h;
    const scale = Math.min(paper.w / cw, paper.h / ch);
    pages.push({ cards: [{ x: (paper.w - cw * scale) / 2, y: (paper.h - ch * scale) / 2, w: cw * scale, h: ch * scale, rotated: turned, scale, round: false, ref: it.ref }] });
  }
  return { sheets: sheets.concat(pages), unplaced };
}

/**
 * "Fill the empty space": extra copies per line (same order as `lines`) that fit on the sheets already used,
 * added one at a time round-robin, so every piece gets a fair share. Whole-page cards never get extras.
 */
export function fillExtra(lines: { w: number; h: number; round?: boolean; page?: boolean; copies: number }[], paper: PaperSize, opts: { margin?: number } = {}): number[] {
  const extra = lines.map(() => 0);
  const items = () => lines.flatMap((l, i) => Array.from({ length: l.copies + extra[i] }, () => ({ w: l.w, h: l.h, round: l.round, page: l.page, ref: i })));
  const base = pack(items(), paper, opts);
  const sheets = base.sheets.length;
  if (!sheets) return extra;
  const open = lines.map((l) => l.copies > 0 && !l.page);
  let total = lines.reduce((n, l) => n + l.copies, 0);
  for (let guard = 0; guard < MAX_CARDS && open.some(Boolean) && total < MAX_CARDS; guard++) {
    for (let i = 0; i < lines.length; i++) {
      if (!open[i]) continue;
      extra[i]++;
      const r = pack(items(), paper, opts);
      if (r.sheets.length > sheets || r.unplaced.length > base.unplaced.length) { extra[i]--; open[i] = false; } else total++;
    }
  }
  return extra;
}
