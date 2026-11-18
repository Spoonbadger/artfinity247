// WHAT THIS PROTECTS: Print codes color. Cards print in color by default, looks saved in the old Black ink come back
// in color, and black and white is applied only at print time.
//
// Run: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESIGN, INKS, sanitizeDesign } from "../components/qr/card.ts";
import { printLook } from "./printOptions.ts";

const base = { disc: 0, pro: true };

test("the default card is in color", () => {
  assert.equal(DEFAULT_DESIGN.ink, "color");
  assert.equal(printLook(DEFAULT_DESIGN, "label", { ...base, color: "color" }).accent, INKS.color.accent);
});

test("a look saved in Black ink comes back in color", () => {
  const d = sanitizeDesign({ ...DEFAULT_DESIGN, ink: "black", ...{ fg: INKS.black.fg, bg: INKS.black.bg, eye: INKS.black.eye, accent: INKS.black.accent, tag: INKS.black.tag } });
  assert.equal(d.ink, "color");
  assert.equal(d.accent, INKS.color.accent);
  assert.equal(d.tag, INKS.color.tag);
});

test("an artist's own colors survive", () => {
  const d = sanitizeDesign({ ...DEFAULT_DESIGN, ink: "black", accent: "#2b37f0" });
  assert.equal(d.ink, "color");
  assert.equal(d.accent, "#2b37f0");
});

test("black and white changes the print, not the saved look", () => {
  const look = { ...DEFAULT_DESIGN, extras: ["match"] };
  const d = printLook(look, "sticker", { ...base, color: "bw" });
  assert.equal(d.ink, "black");
  assert.equal(d.accent, INKS.black.accent);
  assert.deepEqual(d.extras, []);
  assert.equal(d.format, "sticker");
  assert.equal(look.ink, "color");
});
