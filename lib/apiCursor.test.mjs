// pnpm test
import test from "node:test";
import assert from "node:assert/strict";
import { afterCursor, decodeCursor, encodeCursor, pageOf } from "./apiCursor.ts";
import { parseArtworkSearch, SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT } from "./artworkSearch.ts";

test("cursors round-trip and look opaque", () => {
  const c = { k: 1763251200000, id: "clx9abc123def" };
  const s = encodeCursor(c);
  assert.match(s, /^[\w-]+$/);
  assert.ok(!s.includes("clx9abc123def"));
  assert.deepEqual(decodeCursor(s), c);
  assert.deepEqual(decodeCursor(encodeCursor({ k: 0, id: "a" })), { k: 0, id: "a" });
  assert.deepEqual(decodeCursor(encodeCursor({ k: -3, id: "a_b-c" })), { k: -3, id: "a_b-c" });
});

test("junk cursors are rejected, not thrown", () => {
  for (const s of [null, "", "!!", "a".repeat(200), Buffer.from("nodot").toString("base64url"), Buffer.from("12.bad id").toString("base64url"), Buffer.from("1e5.x").toString("base64url"), Buffer.from("99999999999999999.x").toString("base64url")]) {
    assert.equal(decodeCursor(s), null, String(s));
  }
});

test("afterCursor: strictly after the last row, ties broken by id", () => {
  const c = { k: 5, id: "m" };
  assert.deepEqual(afterCursor("position", c, "asc", (k) => k), { OR: [{ position: { gt: 5 } }, { position: 5, id: { gt: "m" } }] });
  const d = afterCursor("createdAt", { k: 1000, id: "m" }, "desc", (k) => new Date(k));
  assert.deepEqual(d, { OR: [{ createdAt: { lt: new Date(1000) } }, { createdAt: new Date(1000), id: { lt: "m" } }] });
});

test("pageOf: next cursor only when there is more", () => {
  const rows = [1, 2, 3].map((n) => ({ n, id: "r" + n }));
  const key = (r) => ({ k: r.n, id: r.id });
  const more = pageOf(rows, 2, key);
  assert.deepEqual(more.page.map((r) => r.n), [1, 2]);
  assert.deepEqual(decodeCursor(more.nextCursor), { k: 2, id: "r2" });
  assert.equal(pageOf(rows, 3, key).nextCursor, null);
  assert.equal(pageOf([], 3, key).nextCursor, null);
});

test("search: defaults", () => {
  const r = parseArtworkSearch(new URLSearchParams());
  assert.deepEqual(r, { ok: true, value: { q: null, artist: null, city: null, edition: null, sensitive: "include", sort: "newest", limit: SEARCH_DEFAULT_LIMIT, cursor: null } });
});

test("search: every filter", () => {
  const cursor = encodeCursor({ k: 10, id: "abc" });
  const r = parseArtworkSearch(new URLSearchParams(`q=  east   river &artist=@maya&city=Austin-TX&edition=limited&sensitive=exclude&sort=oldest&limit=999&cursor=${cursor}`));
  assert.ok(r.ok);
  assert.deepEqual(r.value, { q: "east river", artist: "maya", city: "austin-tx", edition: "limited", sensitive: "exclude", sort: "oldest", limit: SEARCH_MAX_LIMIT, cursor: { k: 10, id: "abc" } });
});

test("search: bad input gets a clear message", () => {
  const bad = { q: "x".repeat(101), artist: "no spaces", city: "new york", edition: "rare", sensitive: "hide", sort: "price", limit: "0", cursor: "nope!" };
  for (const [k, v] of Object.entries(bad)) {
    const r = parseArtworkSearch({ [k]: v });
    assert.equal(r.ok, false, k);
    assert.match(r.error, new RegExp(k), k);
  }
});
