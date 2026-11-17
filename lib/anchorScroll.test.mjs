import test from "node:test";
import assert from "node:assert/strict";
import { easeInOutCubic, glideMs, samePageHash } from "./anchorScroll.ts";

const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
const here = { href: "https://www.theartfinity.com/how-it-works" };

test("same-page hash links are taken over", () => {
  assert.equal(samePageHash({ href: "#step-2" }, here, click), "#step-2");
  assert.equal(samePageHash({ href: "/how-it-works#step-3" }, here, click), "#step-3");
});

test("other pages, new tabs, downloads and modified clicks are left alone", () => {
  assert.equal(samePageHash({ href: "/pricing#calculator" }, here, click), null);
  assert.equal(samePageHash({ href: "https://example.com/how-it-works#x" }, here, click), null);
  assert.equal(samePageHash({ href: "#x", target: "_blank" }, here, click), null);
  assert.equal(samePageHash({ href: "#x", hasDownload: true }, here, click), null);
  assert.equal(samePageHash({ href: "#x" }, here, { ...click, metaKey: true }), null);
  assert.equal(samePageHash({ href: "#x" }, here, { ...click, defaultPrevented: true }), null);
  assert.equal(samePageHash({ href: "/how-it-works" }, here, click), null);
});

test("glide time is short and capped", () => {
  assert.equal(glideMs(0), 350);
  assert.equal(glideMs(800), 376);
  assert.equal(glideMs(-3000), 640);
  assert.equal(glideMs(20000), 750);
});

test("easing starts at 0, ends at 1, passes the middle at 0.5", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
});
