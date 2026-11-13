// Checks for the handle and display-name filter (lib/trust/names.ts). Run with `pnpm test`.
// Blocked examples are ROT13-encoded (same as the source) so the file stays readable.
import { test } from "node:test";
import assert from "node:assert/strict";

const N = await import(new URL("./names" + ".ts", import.meta.url).href);
const r = N.rot13;

test("handles with severe words are blocked anywhere, including look-alikes and stretched letters", () => {
  for (const h of [
    r("shpx"), r("fuvg_neg"), r("fhcrefuvg"), r("onefuvg") + "123", `@${r("avttre")}`, r("snttbg") + ".paints",
    "f4" + r("tt") + "0" + r("g"), "sh1" + r("g"), r("shhhhpx"), r("ovgpu") + "es", r("pbpxfhpxre"),
  ]) {
    assert.equal(N.isOffensiveHandle(h), true, `should block ${r(h)}`);
  }
});

test("handles with mild words are blocked only as their own word", () => {
  for (const h of [r("nff"), r("qvpx"), r("qvpx") + "_art", "big." + r("pbpx"), r("nff") + "99", "the_" + r("gvgf"), r("frkl") + ".art"]) {
    assert.equal(N.isOffensiveHandle(h), true, `should block ${r(h)}`);
  }
});

test("ordinary handles that contain those letters are fine", () => {
  for (const h of [
    "classic.art", "bass.player", "glassworks", "peacock_studio", "dickens.prints", "cocktail.hour", "scunthorpe_art",
    "the.therapist", "shiitake.paints", "maya.okafor", "assassins_creed", "hancock", "titanic", "cumberland",
    "shital.paints", "middlesex.studio", "nigerian.art", "analog.photos", "sussex", "homestead",
  ]) {
    assert.equal(N.isOffensiveHandle(h), false, `should allow ${h}`);
  }
});

test("display names: slurs and strong profanity are blocked", () => {
  for (const n of [r("Shpx Lbh"), r("Ovt Fuvg"), r("Zl anzr vf onfgneq"), "M" + r("btureshpxre") + " Jones", r("A1ttn"), r("Cbea Fgne")]) {
    assert.equal(N.isOffensiveName(n), true, `should block ${r(n)}`);
  }
});

test("display names: real names that look like mild words pass", () => {
  for (const n of ["Dick Van Dyke", "Courteney Cox", "Fanny Brice", "Kike Sánchez", "Shital Patel", "Pornchai Wong", "Maya Okafor", "Analise Brown", "Cassidy Hancock", "Jean-Luc Picard"]) {
    assert.equal(N.isOffensiveName(n), false, `should allow ${n}`);
  }
});

test("display names: mild words that aren't names are still blocked on their own", () => {
  for (const n of [r("Ovt Nff"), r("Gur Chffl Cnvagre"), r("Ubeal Negvfg")]) {
    assert.equal(N.isOffensiveName(n), true, `should block ${r(n)}`);
  }
});

test("empty input is not offensive", () => {
  assert.equal(N.isOffensiveHandle(""), false);
  assert.equal(N.isOffensiveName("   "), false);
});
