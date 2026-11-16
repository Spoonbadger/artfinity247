// pnpm test (runs with scripts/test-hooks.mjs so "@/…" imports resolve)
import test from "node:test";
import assert from "node:assert/strict";
import { esc, safeUrl, extLink } from "./html.ts";
import {
  EMBED_DEFAULTS, contrast, embedDataAttrs, embedQuery, estimateHeight, inkOn, parseAccent, parseBool, parseEmbedOptions, resolveAccent,
} from "./options.ts";
import { parseEmbedPath, parseEmbedUrl } from "./target.ts";
import { editionText, embedHeaders, gridColumns, renderEmbed, renderUnavailable, RESIZE_MESSAGE } from "./render.ts";

// ---------------- html ----------------

test("esc covers text and both attribute quote styles", () => {
  assert.equal(esc(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  assert.equal(esc(null), "");
  assert.equal(esc(42), "42");
});

test("safeUrl only lets absolute http(s) URLs through", () => {
  assert.equal(safeUrl("https://theartfinity.com/@maya"), "https://theartfinity.com/@maya");
  assert.equal(safeUrl("javascript:alert(1)"), "#");
  assert.equal(safeUrl(" JAVASCRIPT:alert(1)"), "#");
  assert.equal(safeUrl("data:text/html,hi"), "#");
  assert.equal(safeUrl("/relative"), "#");
  assert.equal(safeUrl(null), "#");
  assert.equal(safeUrl(`https://x.com/a"onmouseover="b`), "https://x.com/a%22onmouseover=%22b");
});

test("extLink always opens a new tab without opener access", () => {
  assert.equal(extLink("https://a.com", "A"), `<a href="https://a.com/" target="_blank" rel="noopener">A</a>`);
});

// ---------------- options ----------------

test("no query means the defaults", () => {
  assert.deepEqual(parseEmbedOptions(new URLSearchParams()), EMBED_DEFAULTS);
});

test("options parse, clamp and fall back", () => {
  const o = parseEmbedOptions(new URLSearchParams("layout=carousel&columns=9&count=500&theme=DARK&accent=%232B37F0&prices=no&header=0"));
  assert.deepEqual(o, { layout: "carousel", columns: 6, count: 50, theme: "dark", accent: "#2b37f0", prices: false, header: false });
  const bad = parseEmbedOptions({ layout: "masonry", columns: "-2", count: "abc", theme: "neon", accent: "url(x)", prices: "maybe" });
  assert.deepEqual(bad, { ...EMBED_DEFAULTS, columns: 0 });
});

test("limit is the old name for count, and single always shows one", () => {
  assert.equal(parseEmbedOptions({ limit: "9" }).count, 9);
  assert.equal(parseEmbedOptions({ count: "3", limit: "9" }).count, 3);
  assert.equal(parseEmbedOptions({ layout: "single", count: "12" }).count, 1);
  assert.equal(parseEmbedOptions({ count: "0" }).count, 1);
});

test("parseBool", () => {
  assert.equal(parseBool("yes", false), true);
  assert.equal(parseBool("OFF", true), false);
  assert.equal(parseBool("", true), true);
  assert.equal(parseBool(undefined, false), false);
});

test("parseAccent takes paint ids and hex, nothing else", () => {
  assert.equal(parseAccent("Ultramarine"), "ultramarine");
  assert.equal(parseAccent("2b37f0"), "#2b37f0");
  assert.equal(parseAccent("#ABC"), "#aabbcc");
  assert.equal(parseAccent("page"), null);
  assert.equal(parseAccent("red;background:url(x)"), null);
  assert.equal(parseAccent("#12345"), null);
});

test("embedQuery and embedDataAttrs only carry what differs from the defaults", () => {
  assert.equal(embedQuery({}), "");
  assert.equal(embedQuery(EMBED_DEFAULTS), "");
  assert.equal(embedQuery({ layout: "carousel", count: 9, accent: "#2b37f0", prices: false }), "?layout=carousel&count=9&accent=2b37f0&prices=no");
  assert.equal(embedQuery({ layout: "single", count: 9, columns: 3 }), "?layout=single");
  assert.equal(embedQuery({ theme: "dark" }, [["autosize", "1"]]), "?theme=dark&autosize=1");
  assert.equal(embedDataAttrs({ columns: 3, theme: "auto", header: false }), ` data-columns="3" data-theme="auto" data-header="no"`);
});

test("a query string survives a round trip", () => {
  const o = { layout: "carousel", columns: 4, count: 12, theme: "auto", accent: "#ffd43b", prices: false, header: false };
  assert.deepEqual(parseEmbedOptions(new URLSearchParams(embedQuery(o).slice(1))), o);
});

test("accent: option, then page accent, then Garnet; text color stays readable", () => {
  assert.deepEqual(resolveAccent(null, null), { color: "#8b2a4b", ink: "#ffffff" });
  assert.deepEqual(resolveAccent(null, "naples-yellow"), { color: "#ffd43b", ink: "#15161b" });
  assert.deepEqual(resolveAccent("cerulean", "naples-yellow"), { color: "#1f8fb5", ink: "#ffffff" });
  assert.equal(resolveAccent("#ffff00").ink, "#15161b");
  assert.equal(resolveAccent("#000080").ink, "#ffffff");
  assert.equal(inkOn("#ffffff"), "#15161b");
  assert.ok(contrast("#ffffff", "#000000") > 20);
});

// ---------------- link parsing (oEmbed) ----------------

test("artwork, artist and collection links", () => {
  assert.deepEqual(parseEmbedUrl("https://theartfinity.com/@maya/art/east-river"), { kind: "art", slug: "east-river" });
  assert.deepEqual(parseEmbedUrl("https://theartfinity.com/art/east-river?src=ig"), { kind: "art", slug: "east-river" });
  assert.deepEqual(parseEmbedUrl("https://theartfinity.com/embed/art/east-river"), { kind: "art", slug: "east-river" });
  assert.deepEqual(parseEmbedUrl("https://theartfinity.com/@maya"), { kind: "artist", handle: "maya" });
  assert.deepEqual(parseEmbedUrl("https://theartfinity.com/@maya/"), { kind: "artist", handle: "maya" });
  assert.deepEqual(parseEmbedUrl("https://theartfinity.com/%40maya/links"), { kind: "artist", handle: "maya" });
  assert.deepEqual(parseEmbedUrl("https://theartfinity.com/artists/maya"), { kind: "artist", handle: "maya" });
  assert.deepEqual(parseEmbedUrl("https://theartfinity.com/embed/artist/maya?layout=carousel"), { kind: "artist", handle: "maya" });
  assert.deepEqual(parseEmbedUrl("https://theartfinity.com/@maya/collections/night-walks"), { kind: "collection", handle: "maya", slug: "night-walks" });
  assert.deepEqual(parseEmbedUrl("https://theartfinity.com/embed/collection/maya/night-walks"), { kind: "collection", handle: "maya", slug: "night-walks" });
});

test("anything else is not embeddable", () => {
  for (const u of [
    "https://theartfinity.com/",
    "https://theartfinity.com/studio",
    "https://theartfinity.com/@maya/collections",
    "https://theartfinity.com/@maya/art",
    "https://theartfinity.com/@/art/x",
    "https://theartfinity.com/@ma<ya",
    "https://theartfinity.com/%E0%A4%A",
    "javascript:alert(1)",
    "not a url",
  ]) assert.equal(parseEmbedUrl(u), null, u);
  assert.equal(parseEmbedPath("/embed/collection/maya"), null);
});

// ---------------- rendering ----------------

const work = (o = {}) => ({
  title: "East River", url: "https://theartfinity.com/@maya/art/east-river", imageUrl: "https://theartfinity.com/seed/a.jpg",
  sensitive: [], price: "$34.99", edition: null, ...o,
});
const view = (o = {}) => ({
  artist: { name: "Maya Okafor", url: "https://theartfinity.com/@maya", avatar: null, location: "Brooklyn, NY", verified: true, medal: "Gold" },
  works: [work(), work({ title: "Two", url: "https://theartfinity.com/@maya/art/two" })],
  total: 14,
  moreUrl: "https://theartfinity.com/@maya",
  homeUrl: "https://theartfinity.com",
  ...o,
});
const accent = { color: "#8b2a4b", ink: "#ffffff" };

test("editionText", () => {
  assert.equal(editionText(null), "");
  assert.equal(editionText({ size: 10, remaining: 3, soldOut: false }), "3 of 10 left");
  assert.equal(editionText({ size: 10, remaining: 3, soldOut: false }, true), "Limited edition of 10 · 3 of 10 left");
  assert.equal(editionText({ size: 10, remaining: 0, soldOut: true }), "Edition sold out");
});

test("artist embed: header, cards, footer, resize script; every link opens a new tab", () => {
  const html = renderEmbed(view(), EMBED_DEFAULTS, accent);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<h1>.*Maya Okafor.*<\/h1>/);
  assert.match(html, /Brooklyn, NY · Gold/);
  assert.match(html, /\(verified\)/);
  assert.equal((html.match(/class="c"/g) || []).length, 2);
  assert.match(html, /From \$34\.99/);
  assert.match(html, /See all 14/);
  assert.match(html, /Prints by Artfinity/);
  assert.ok(html.includes(RESIZE_MESSAGE));
  const anchors = html.match(/<a [^>]*>/g);
  assert.ok(anchors.length > 4);
  for (const a of anchors) assert.match(a, /target="_blank" rel="noopener"/);
  assert.ok(!/<link|@import|fonts\.googleapis/.test(html), "no web fonts or external CSS");
});

test("titles and names are escaped, hostile URLs neutralized", () => {
  const html = renderEmbed(
    view({
      artist: { name: `<script>alert(1)</script>`, url: "javascript:alert(1)", avatar: "javascript:x", location: "", verified: false, medal: null },
      works: [work({ title: `"><img src=x onerror=alert(1)>`, url: "javascript:alert(2)" })],
    }),
    EMBED_DEFAULTS,
    accent,
  );
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(!html.includes(`"><img src=x`));
  assert.ok(!html.includes("javascript:"));
});

test("prices off hides prices, not the buy button; header off drops the header", () => {
  const html = renderEmbed(view(), { ...EMBED_DEFAULTS, prices: false, header: false }, accent);
  assert.ok(!html.includes("$34.99"));
  assert.match(html, /Buy a print/);
  assert.ok(!html.includes("<header"));
});

test("layouts: carousel scrolls with a label, single shows one big piece", () => {
  const car = renderEmbed(view(), { ...EMBED_DEFAULTS, layout: "carousel" }, accent);
  assert.match(car, /class="k"[^>]*tabindex="0"[^>]*aria-label="Art by Maya Okafor, scroll for more"/);
  const one = renderEmbed(view(), { ...EMBED_DEFAULTS, layout: "single", count: 1 }, accent);
  assert.match(one, /class="c x"/);
  assert.equal((one.match(/Buy a print of/g) || []).length, 1);
});

test("count trims the list; columns set the grid", () => {
  const html = renderEmbed(view(), { ...EMBED_DEFAULTS, count: 1, columns: 3 }, accent);
  assert.equal((html.match(/class="c"/g) || []).length, 1);
  assert.ok(html.includes(gridColumns(3)));
  assert.equal(gridColumns(0), "repeat(auto-fill,minmax(140px,1fr))");
  assert.equal(gridColumns(1), "minmax(0,1fr)");
});

test("sensitive pieces are blurred with a Show button", () => {
  const html = renderEmbed(view({ works: [work({ sensitive: ["Nudity"] })] }), EMBED_DEFAULTS, accent);
  assert.match(html, /class="i s"/);
  assert.match(html, /<span>Nudity<\/span><button type="button" data-show/);
});

test("collection embed leads with the collection, credits the artist", () => {
  const html = renderEmbed(
    view({ collection: { title: "Night walks", description: "Ink & rain", url: "https://theartfinity.com/@maya/collections/night-walks" }, total: 2 }),
    EMBED_DEFAULTS,
    accent,
  );
  assert.match(html, /<h1>.*Night walks.*<\/h1>/);
  assert.match(html, /by Maya Okafor · Brooklyn, NY/);
  assert.match(html, /Ink &amp; rain/);
  assert.match(html, /See the collection/);
  assert.match(html, /<title>Night walks by Maya Okafor<\/title>/);
});

test("themes: dark sets dark colors, auto follows the visitor", () => {
  assert.match(renderEmbed(view(), { ...EMBED_DEFAULTS, theme: "dark" }, accent), /--bg:#15161b/);
  const auto = renderEmbed(view(), { ...EMBED_DEFAULTS, theme: "auto" }, accent);
  assert.match(auto, /prefers-color-scheme:dark/);
  assert.match(auto, /content="light dark"/);
});

test("empty and unavailable states still render a framed page", () => {
  assert.match(renderEmbed(view({ works: [], total: 0 }), EMBED_DEFAULTS, accent), /No pieces to show yet/);
  assert.match(renderUnavailable("https://theartfinity.com", "This artist isn't available"), /This artist isn&#39;t available/);
});

test("embed headers allow framing anywhere and nothing else", () => {
  const h = embedHeaders(true);
  assert.match(h["Content-Security-Policy"], /frame-ancestors \*/);
  assert.match(h["Content-Security-Policy"], /default-src 'none'/);
  assert.equal(h["X-Frame-Options"], undefined);
  assert.equal(embedHeaders(false)["Cache-Control"], "no-store");
});

test("estimateHeight is in a sane range and grows with rows", () => {
  const six = estimateHeight(EMBED_DEFAULTS, 600, 6);
  const twelve = estimateHeight({ ...EMBED_DEFAULTS, count: 12 }, 600, 12);
  assert.ok(six > 300 && six < 1400, String(six));
  assert.ok(twelve > six);
  assert.ok(estimateHeight({ ...EMBED_DEFAULTS, layout: "carousel" }, 600, 6) < six);
});
