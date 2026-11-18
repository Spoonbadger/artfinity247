// WHAT THIS PROTECTS: the Print codes packer (lib/printPack.ts). Any mix of card sizes lands on the fewest sheets,
// no card overlaps another or leaves the printable area, copies are never lost, and "fill the empty space" never adds
// a sheet.
//
// Run: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { pack, fillExtra, PAPER_MARGIN, ROUND_GAP } from "./printPack.ts";

const LETTER = { w: 8.5, h: 11 }, A4 = { w: 8.27, h: 11.69 };
const LABEL = { w: 3.5, h: 2 }, STICKER = { w: 2, h: 2, round: true }, TAG = { w: 2, h: 3.5 }, POSTER = { w: 8.5, h: 11, page: true };
const many = (n, size, ref = "x") => Array.from({ length: n }, (_, i) => ({ ...size, ref: `${ref}${i}` }));
const count = (r) => r.sheets.reduce((n, s) => n + s.cards.length, 0);

function assertSane(r, paper) {
  for (const s of r.sheets) {
    for (const c of s.cards) {
      if (c.scale !== 1) continue; // whole-page cards are checked on their own
      assert.ok(c.x >= PAPER_MARGIN - 1e-6 && c.y >= PAPER_MARGIN - 1e-6, "inside the top-left margin");
      assert.ok(c.x + c.w <= paper.w - PAPER_MARGIN + 1e-6 && c.y + c.h <= paper.h - PAPER_MARGIN + 1e-6, "inside the bottom-right margin");
    }
    for (let i = 0; i < s.cards.length; i++) for (let j = i + 1; j < s.cards.length; j++) {
      const a = s.cards[i], b = s.cards[j];
      const g = a.round || b.round ? ROUND_GAP - 1e-6 : -1e-6;
      const apart = a.x + a.w + g <= b.x || b.x + b.w + g <= a.x || a.y + a.h + g <= b.y || b.y + b.h + g <= a.y;
      assert.ok(apart, `cards ${i} and ${j} overlap`);
    }
  }
}

test("one size: as many per Letter sheet as the old fixed grids, or more", () => {
  // Turned sideways, wall labels fit 4 across and 3 down: 12 per sheet (the old grid held 10).
  assert.equal(pack(many(12, LABEL), LETTER).sheets.length, 1, "12 labels on one sheet");
  assert.equal(pack(many(13, LABEL), LETTER).sheets.length, 2);
  assert.equal(pack(many(12, TAG), LETTER).sheets.length, 1, "12 tags on one sheet");
  const st = pack(many(15, STICKER), LETTER);
  assert.equal(st.sheets.length, 1, "15 stickers fit (the old grid held 12)");
  assertSane(st, LETTER);
});

test("a mixed print: 2 + 1 + 3×5 cards of different sizes, all placed, nothing overlaps", () => {
  const items = [...many(2, LABEL, "a"), ...many(1, STICKER, "b"), ...[1, 2, 3, 4, 5].flatMap((p) => many(3, p % 2 ? LABEL : TAG, `p${p}`))];
  const r = pack(items, LETTER);
  assert.equal(r.unplaced.length, 0);
  assert.equal(count(r), items.length);
  assertSane(r, LETTER);
  assert.ok(r.sheets.length <= 2, `18 cards in ${r.sheets.length} sheets`);
});

test("small cards fill the gaps on earlier sheets before a new sheet starts", () => {
  // 8 labels leave a row free; 3 stickers fit there instead of starting sheet 2.
  const r = pack([...many(8, LABEL), ...many(3, STICKER, "s")], LETTER);
  assert.equal(r.sheets.length, 1);
  assertSane(r, LETTER);
});

test("other papers: A4 and a custom size work the same way", () => {
  const a4 = pack(many(10, LABEL), A4);
  assert.equal(count(a4), 10);
  assertSane(a4, A4);
  const small = { w: 4, h: 6 };
  const r = pack(many(5, LABEL), small);
  assert.equal(r.sheets.length, 3, "two 3.5 × 2 labels per 4 × 6 card");
  assertSane(r, small);
});

test("a card bigger than the paper is reported, not dropped silently", () => {
  const r = pack([{ w: 9, h: 9, ref: "big" }, { ...LABEL, ref: "ok" }], LETTER);
  assert.deepEqual(r.unplaced, ["big"]);
  assert.equal(count(r), 1);
});

test("posters take a sheet each, scaled to the paper", () => {
  const r = pack([...many(2, POSTER, "p"), ...many(3, LABEL)], LETTER);
  assert.equal(r.sheets.length, 3);
  const posters = r.sheets.flatMap((s) => s.cards).filter((c) => String(c.ref).startsWith("p"));
  assert.equal(posters.length, 2);
  assert.equal(posters[0].scale, 1);
  const big = pack(many(1, POSTER), { w: 11, h: 17 }).sheets[0].cards[0];
  assert.ok(big.scale > 1.25, "a poster on tabloid paper is printed bigger");
});

test("Avery label sheets: one matching card per slot, other sizes refused", () => {
  const avery = { w: 8.5, h: 11, slots: { w: 3.5, h: 2, at: Array.from({ length: 10 }, (_, i) => ({ x: 0.75 + (i % 2) * 3.5, y: 0.5 + Math.floor(i / 2) * 2 })) } };
  const r = pack([...many(12, LABEL), { ...STICKER, ref: "st" }], avery);
  assert.equal(r.sheets.length, 2);
  assert.equal(r.sheets[0].cards.length, 10);
  assert.deepEqual(r.unplaced, ["st"]);
});

test("fill the empty space: fair extras, never a new sheet", () => {
  const lines = [{ ...LABEL, copies: 2 }, { ...LABEL, copies: 1 }, { ...LABEL, copies: 3 }];
  const extra = fillExtra(lines, LETTER);
  assert.equal(extra.reduce((a, b) => a + b, 0), 6, "6 labels + 6 extras = a full sheet of 12");
  assert.ok(Math.max(...extra) - Math.min(...extra) <= 1, "shared round-robin");
  assert.deepEqual(fillExtra([{ ...POSTER, copies: 1 }], LETTER), [0], "posters get no extras");
});
