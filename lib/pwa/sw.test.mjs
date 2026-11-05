// Unit check for the service worker's routing (public/sw.js): node --test lib/pwa/sw.test.mjs
// Loads the worker in a sandbox with a fake `self` and checks what it would do with each request.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const listeners = {};
const self = { addEventListener: (type, fn) => (listeners[type] = fn), location: { origin: "https://theartfinity.com" } };
vm.runInNewContext(src, { self, URL, Response: class {}, caches: {}, fetch: () => {} });
const strategyFor = self.__afStrategyFor;
const O = "https://theartfinity.com";
const headers = (h = {}) => ({ get: (n) => h[n] ?? h[n.toLowerCase()] ?? null });
const req = (path, o = {}) => ({ method: "GET", url: path.startsWith("http") ? path : O + path, mode: "no-cors", destination: "", headers: headers(), ...o });
const nav = (path, o = {}) => req(path, { mode: "navigate", destination: "document", ...o });

test("registers install, activate and fetch handlers", () => {
  assert.equal(typeof listeners.install, "function");
  assert.equal(typeof listeners.activate, "function");
  assert.equal(typeof listeners.fetch, "function");
});

test("never touches checkout, cart, auth, admin or API", () => {
  for (const p of ["/api/auth/me", "/api/create-checkout-session", "/api/studio/stats", "/checkout", "/cart", "/information", "/thank-you?session_id=x", "/cancel", "/admin", "/admin/orders/1", "/login", "/register", "/reset-password?token=x", "/q/K7P2", "/Q/K7P2", "/sw.js"]) {
    assert.equal(strategyFor(nav(p), O), "passthrough", `navigate ${p}`);
    assert.equal(strategyFor(req(p), O), "passthrough", `fetch ${p}`);
  }
});

test("never touches non-GET requests (server actions, form posts)", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(strategyFor(nav("/studio", { method }), O), "passthrough");
    assert.equal(strategyFor(req("/_next/static/chunks/a.js", { method }), O), "passthrough");
  }
});

test("Studio data (RSC) fetches pass through", () => {
  assert.equal(strategyFor(req("/studio/money", { headers: headers({ RSC: "1" }) }), O), "passthrough");
  assert.equal(strategyFor(req("/studio/money?_rsc=abc"), O), "passthrough");
  assert.equal(strategyFor(req("/studio", { headers: headers({ "Next-Router-Prefetch": "1", RSC: "1" }) }), O), "passthrough");
  assert.equal(strategyFor(nav("/studio?_rsc=1"), O), "passthrough");
});

test("static assets are cache-first", () => {
  for (const p of ["/_next/static/chunks/main-abc123.js", "/_next/static/css/app.css", "/_next/static/media/font.woff2", "/fonts/Inter.ttf", "/brand/app/icon-192.png", "/favicon.ico"])
    assert.equal(strategyFor(req(p), O), "static", p);
  assert.equal(strategyFor(req("/whatever.woff2", { destination: "font" }), O), "static");
});

test("other pages: network only with the offline fallback, never cached", () => {
  for (const p of ["/", "/studio", "/studio/money", "/@mayaokafor/art/east-river-late-may", "/help"]) assert.equal(strategyFor(nav(p), O), "page", p);
});

test("everything else, cross-origin and images included, passes through", () => {
  assert.equal(strategyFor(req("/_next/image?url=x&w=640"), O), "passthrough");
  assert.equal(strategyFor(req("/uploads/art.jpg"), O), "passthrough");
  assert.equal(strategyFor(req("https://res.cloudinary.com/x.jpg"), O), "passthrough");
  assert.equal(strategyFor(nav("https://checkout.stripe.com/c/pay/x"), O), "passthrough");
  assert.equal(strategyFor(req("https://js.stripe.com/v3/"), O), "passthrough");
});
