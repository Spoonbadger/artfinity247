// WHAT THIS PROTECTS: Infinity custom card sizes (components/qr/card.ts). (1) Any size from the browser becomes a safe
// one: clamped to 1–7.5 × 1–10 in, circles stay round, a label sheet sets its own size. (2) Each size is drawn with a
// layout that fits it. (3) The print sheet fits the cards on US Letter, and a label sheet's grid matches the box.
// (4) Free artists never print a custom size, and the card really comes out at the chosen size.
//
// Run: pnpm test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESIGN, customFormat, freeDesign, renderCard, sanitizeCustom, sanitizeDesign, sheetLayout, usesInfinity } from "../../components/qr/card.ts";
import { loadFonts } from "../../components/qr/text.ts";

test("custom sizes are clamped and circles stay round", () => {
  assert.deepEqual(sanitizeCustom({ w: 40, h: 0.2, shape: "rounded" }), { w: 7.5, h: 1, shape: "rounded", sheet: "auto" });
  assert.deepEqual(sanitizeCustom({ w: 3, h: 5, shape: "round" }), { w: 3, h: 3, shape: "round", sheet: "auto" }); // the width ("Across") wins
  assert.equal(sanitizeCustom({ w: "abc", h: 2 }), null);
  assert.equal(sanitizeCustom(null), null);
  assert.deepEqual(sanitizeCustom({ w: 1, h: 1, sheet: "avery-5163" }), { w: 4, h: 2, shape: "rounded", sheet: "avery-5163" });
});

test("each shape gets a layout that fits it", () => {
  assert.equal(customFormat({ w: 4, h: 2, shape: "rect" }), "label");
  assert.equal(customFormat({ w: 3, h: 5, shape: "rounded" }), "tag");
  assert.equal(customFormat({ w: 3, h: 3, shape: "rounded" }), "sticker");
  assert.equal(customFormat({ w: 4, h: 2, shape: "round" }), "sticker");
  assert.equal(sanitizeDesign({ ...DEFAULT_DESIGN, format: "poster", custom: { w: 3, h: 5 } }).format, "tag");
});

test("print sheets fit US Letter and match label sheets", () => {
  const auto = sheetLayout("label", sanitizeCustom({ w: 4, h: 2 }));
  assert.equal(auto.slots.length, 10);
  for (const p of auto.slots) assert.ok(p.x >= 0 && p.y >= 0 && p.x + auto.cw <= 612 && p.y + auto.ch <= 792);
  assert.ok(auto.marks.length > 0, "cut-it-yourself sheets get crop marks");
  const avery = sheetLayout("label", sanitizeCustom({ sheet: "avery-5160" }));
  assert.equal(avery.slots.length, 30);
  assert.equal(avery.marks.length, 0, "ready-cut label sheets get no crop marks");
  assert.ok(Math.abs(avery.slots[0].x - 0.1875 * 72) < 0.01 && Math.abs(avery.slots[0].y - 0.5 * 72) < 0.01, "first label sits where Avery 5160's does");
});

test("free artists don't print custom sizes; Infinity cards come out at the chosen size", async () => {
  const d = sanitizeDesign({ ...DEFAULT_DESIGN, custom: { w: 3, h: 5, shape: "rounded" } });
  assert.ok(usesInfinity(d));
  assert.equal(freeDesign(d).custom, null);
  const art = { slug: "x", title: "Blue Hour", artist: "Sam Lee", imageUrl: "", markups: { small: 0, medium: 0, large: 0, xl: 0 } };
  const card = renderCard(d, art, await loadFonts(), "HTTPS://THEARTFINITY.COM/Q/K7P2");
  assert.equal(card.w, 3 * 72);
  assert.equal(card.h, 5 * 72);
  assert.ok(card.qrPt > 1.5 * 72, "the code grows with the card");
});
