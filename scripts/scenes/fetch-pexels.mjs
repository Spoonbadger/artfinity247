#!/usr/bin/env node
// Fetch real interior photos (rooms, cafés, galleries, with people for scale) from Pexels into scenes/photos/.
//
//   PEXELS_API_KEY=... npm run scenes:fetch                 up to 120 new photos
//   npm run scenes:fetch -- --max 40 --per-query 6          smaller batch
//   npm run scenes:fetch -- --queries "bedroom wall,hallway" --orientations landscape
//   npm run scenes:fetch -- --dry-run                       list what it would download
//
// Needs: a free API key from https://www.pexels.com/api/ (in .env or the environment), and network access to
// api.pexels.com and images.pexels.com. Behind an HTTP(S) proxy, run with NODE_USE_ENV_PROXY=1 (Node 22.21+).
// Writes scenes/photos/pexels-<id>.jpg (long edge 2400px) + pexels-<id>.json (photographer, page URL, license).
// Skips photos it already has, keeps its place per query in scenes/photos/.pexels-state.json (re-run to resume),
// and stays under the free tier's 200 requests/hour (it stops and tells you when to come back).
// Your own photos: drop any .jpg/.png/.webp into scenes/photos/ (optionally with a <name>.json credit file); the
// annotation tool picks them up the same way.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argDir = process.argv.indexOf("--dir");
const DIR = argDir > 0 && process.argv[argDir + 1] ? path.resolve(process.argv[argDir + 1]) : path.join(root, "scenes", "photos");
const STATE = path.join(DIR, ".pexels-state.json");
const API = process.env.PEXELS_API_URL || "https://api.pexels.com/v1/search"; // override only for testing
const LICENSE = "Pexels License: free to use, no attribution required";
const LICENSE_URL = "https://www.pexels.com/license/";

export const QUERIES = [
  "living room person standing",
  "living room wall sofa",
  "cafe interior people wall",
  "coffee shop interior wall",
  "bedroom wall",
  "home office",
  "home office person desk",
  "art gallery visitors",
  "gallery white wall people",
  "loft apartment people",
  "restaurant wall",
  "hallway",
  "brooklyn apartment",
  "dining room wall",
  "kitchen interior person",
  "minimalist living room",
];

const argv = process.argv.slice(2);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const dry = argv.includes("--dry-run");
const MAX = Math.max(1, Number(opt("max", 120)) || 120);
const PER_QUERY = Math.max(1, Number(opt("per-query", 12)) || 12);
const PER_PAGE = Math.min(80, Math.max(5, Number(opt("per-page", 40)) || 40));
const queries = opt("queries", "") ? opt("queries", "").split(",").map((s) => s.trim()).filter(Boolean) : QUERIES;
const orientations = opt("orientations", "landscape,portrait").split(",").filter((o) => ["landscape", "portrait", "square"].includes(o));
const MIN_LONG = 1600;
const HOURLY = 190; // keep a little under the 200/hour free tier
const GAP_MS = 1200;

function loadEnv() {
  if (process.env.PEXELS_API_KEY) return;
  try {
    for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();
const KEY = process.env.PEXELS_API_KEY;
if (!KEY) {
  console.error("Set PEXELS_API_KEY (free at https://www.pexels.com/api/) in .env or the environment.");
  process.exit(1);
}

fs.mkdirSync(DIR, { recursive: true });
const readJson = (f, d) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return d;
  }
};
const writeJson = (f, v) => {
  fs.writeFileSync(f + ".tmp", JSON.stringify(v, null, 2) + "\n");
  fs.renameSync(f + ".tmp", f);
};
const state = readJson(STATE, { queries: {}, calls: [] });
state.queries ||= {};
state.calls = (state.calls || []).filter((t) => Date.now() - t < 3600_000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastCall = 0;
async function api(params) {
  const recent = state.calls.filter((t) => Date.now() - t < 3600_000);
  if (recent.length >= HOURLY) {
    const wait = Math.ceil((recent[0] + 3600_000 - Date.now()) / 60000);
    throw Object.assign(new Error(`Hourly request budget used (${HOURLY}). Re-run in about ${wait} min to continue.`), { stop: true });
  }
  const gap = lastCall + GAP_MS - Date.now();
  if (gap > 0) await sleep(gap);
  lastCall = Date.now();
  state.calls.push(lastCall);
  const url = `${API}?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { Authorization: KEY }, signal: AbortSignal.timeout(20000) });
    } catch (e) {
      if (attempt === 2) throw new Error(`Network error talking to api.pexels.com: ${e.message}. Is the host allowed?`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (res.status === 429 || (Number.isFinite(remaining) && remaining <= 1)) {
      const when = reset ? new Date(reset * 1000).toLocaleTimeString() : "in an hour";
      if (res.status === 429) throw Object.assign(new Error(`Pexels rate limit reached. Re-run after ${when}.`), { stop: true });
      console.log(`  (rate limit nearly used; stopping after this page, resets ${when})`);
      state.stopAfterThis = true;
    }
    if (res.status === 401 || res.status === 403) throw Object.assign(new Error("Pexels rejected the API key (401/403)."), { stop: true });
    if (!res.ok) {
      if (attempt === 2) throw new Error(`Pexels search failed: HTTP ${res.status}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    return res.json();
  }
}

async function download(url, file) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 20000) throw new Error("file too small");
      fs.writeFileSync(file + ".part", buf);
      fs.renameSync(file + ".part", file);
      return buf.length;
    } catch (e) {
      if (attempt === 2) throw new Error(`Download failed (${e.message}). Is images.pexels.com allowed?`);
      await sleep(1500 * (attempt + 1));
    }
  }
}

const have = new Set(fs.readdirSync(DIR).filter((f) => /^pexels-\d+\.(jpe?g|png|webp)$/.test(f)).map((f) => f.replace(/\.\w+$/, "")));
console.log(`${have.size} Pexels photos already in scenes/photos. Fetching up to ${MAX} new (${PER_QUERY} per query × orientation)${dry ? " [dry run]" : ""}.`);
let added = 0;
try {
  outer: for (const q of queries) {
    for (const orientation of orientations) {
      const key = `${q}|${orientation}`;
      const st = (state.queries[key] ||= { page: 1, done: false, got: 0 });
      if (st.done) continue;
      let gotHere = 0;
      while (gotHere < PER_QUERY && added < MAX) {
        const data = await api({ query: q, orientation, size: "large", per_page: String(PER_PAGE), page: String(st.page) });
        const photos = data?.photos || [];
        if (!photos.length) {
          st.done = true;
          break;
        }
        for (const p of photos) {
          if (gotHere >= PER_QUERY || added >= MAX) break;
          const id = `pexels-${p.id}`;
          if (have.has(id)) continue;
          if (Math.max(p.width, p.height) < MIN_LONG) continue;
          const src = p.src?.original ? `${p.src.original}?auto=compress&cs=tinysrgb&w=${p.width >= p.height ? 2400 : 1800}` : p.src?.large2x;
          if (!src) continue;
          if (dry) {
            console.log(`  would fetch ${id}  ${p.width}×${p.height}  by ${p.photographer}  (${q}, ${orientation})`);
          } else {
            const bytes = await download(src, path.join(DIR, `${id}.jpg`));
            writeJson(path.join(DIR, `${id}.json`), {
              source: "Pexels",
              pexelsId: p.id,
              photographer: p.photographer,
              photographerUrl: p.photographer_url,
              url: p.url,
              alt: p.alt || "",
              avgColor: p.avg_color,
              width: p.width,
              height: p.height,
              query: q,
              orientation,
              license: LICENSE,
              licenseUrl: LICENSE_URL,
              fetchedAt: new Date().toISOString(),
            });
            console.log(`  + ${id}  ${(bytes / 1024).toFixed(0)} KB  by ${p.photographer}  (${q}, ${orientation})`);
          }
          have.add(id);
          added++;
          gotHere++;
          st.got = (st.got || 0) + 1;
        }
        st.page++;
        if (!data.next_page) st.done = true;
        writeJson(STATE, state);
        if (state.stopAfterThis) {
          delete state.stopAfterThis;
          break outer;
        }
        if (st.done) break;
      }
      if (added >= MAX) break outer;
    }
  }
} catch (e) {
  console.error(e.message);
  if (!e.stop) process.exitCode = 1;
} finally {
  delete state.stopAfterThis;
  writeJson(STATE, state);
}
console.log(`\n${dry ? "Would add" : "Added"} ${added} photos. Next: annotate them at /admin/scenes, then npm run scenes:build.`);
