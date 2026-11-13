/* Artfinity service worker (hand-written, no build plugin). Registered in production only
 * by components/pwa/PwaSetup.tsx.
 *
 * It caches exactly two things:
 *   1. the /offline page (plus the /_next/static files it needs), shown when a page can't load
 *   2. static, fingerprinted assets: /_next/static/*, fonts, /brand/* icons
 *
 * It never caches HTML of real pages, API responses, RSC/data fetches, or anything personal.
 * /api, /checkout, /cart, /information, /thank-you, /cancel, /admin, auth pages and every
 * non-GET request are not touched at all: the browser handles them as if there were no worker.
 *
 * Changing this file or the /offline page? Bump VERSION: the new worker installs, deletes the
 * old caches on activate, and takes over open tabs.
 */
const VERSION = "2026-11-05.2";
const PREFIX = "af-";
const STATIC_CACHE = `${PREFIX}static-${VERSION}`;
const OFFLINE_CACHE = `${PREFIX}offline-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAX_STATIC_ENTRIES = 150;

// Never intercepted, whatever the request.
const BYPASS = [
  /^\/api(\/|$)/,
  /^\/checkout(\/|$)/,
  /^\/cart(\/|$)/,
  /^\/information(\/|$)/,
  /^\/thank-you(\/|$)/,
  /^\/cancel(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/(login|register|logout|recover-password|reset-password|change-password)(\/|$)/,
  /^\/q(\/|$)/i, // printed QR short links: always straight to the server (scan counts)
  /^\/sw\.js$/,
];

const STATIC = [/^\/_next\/static\//, /^\/fonts\//, /^\/brand\//, /^\/favicon\.ico$/];

/**
 * What to do with a request: "passthrough" (don't call respondWith), "static" (cache-first),
 * or "page" (network only, /offline if the network fails). Pure, so it can be unit-tested.
 * @param {{ method: string, url: string, mode?: string, destination?: string, headers?: { get(name: string): string | null } }} req
 * @param {string} origin the worker's origin
 */
function strategyFor(req, origin) {
  if (req.method !== "GET") return "passthrough";
  let url;
  try { url = new URL(req.url); } catch { return "passthrough"; }
  if (url.origin !== origin) return "passthrough";
  const path = url.pathname;
  if (BYPASS.some((re) => re.test(path))) return "passthrough";
  const header = (name) => (req.headers && typeof req.headers.get === "function" ? req.headers.get(name) : null);
  // React Server Component / data fetches (Studio data included) are never handled here.
  if (header("RSC") || header("Next-Router-Prefetch") || url.searchParams.has("_rsc")) return "passthrough";
  if (STATIC.some((re) => re.test(path)) || req.destination === "font") return "static";
  if (req.mode === "navigate") return "page";
  return "passthrough";
}

// Exposed for the unit check (scripts/sw-check.mjs), harmless in the browser.
self.__afStrategyFor = strategyFor;

/** fetch() that gives up after `ms`, so a stuck request can't leave the worker installing forever. */
function fetchWithin(url, init, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function precacheOffline() {
  const cache = await caches.open(OFFLINE_CACHE);
  const res = await fetchWithin(OFFLINE_URL, { credentials: "omit", cache: "reload" });
  if (!res.ok) throw new Error(`offline page: ${res.status}`);
  const html = await res.clone().text();
  await cache.put(OFFLINE_URL, res);
  // The CSS, JS and fonts the offline page links to, so it renders styled with no network.
  const assets = Array.from(new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []));
  const statics = await caches.open(STATIC_CACHE);
  await Promise.all(assets.map((a) => fetchWithin(a, { credentials: "omit" }).then((r) => (r.ok ? statics.put(a, r) : null)).catch(() => null)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOffline().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, OFFLINE_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_STATIC_ENTRIES; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  // credentials omitted: static files never depend on who is asking.
  const res = await fetch(request.url, { credentials: "omit" });
  const type = res.headers.get("Content-Type") || "";
  if (res.ok && res.type === "basic" && !/text\/html/.test(type) && !/no-store|private/.test(res.headers.get("Cache-Control") || "")) {
    cache.put(request.url, res.clone()).then(() => trim(cache)).catch(() => {});
  }
  return res;
}

async function pageOrOffline(event) {
  try {
    const preload = await event.preloadResponse;
    if (preload) return preload;
    return await fetch(event.request);
  } catch {
    const cache = await caches.open(OFFLINE_CACHE);
    return (await cache.match(OFFLINE_URL)) || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const strategy = strategyFor(event.request, self.location.origin);
  if (strategy === "static") event.respondWith(cacheFirst(event.request).catch(() => fetch(event.request)));
  else if (strategy === "page") event.respondWith(pageOrOffline(event));
  // "passthrough": no respondWith, the browser fetches normally.
});
