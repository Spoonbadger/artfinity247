#!/usr/bin/env node
// Fetch real interior photos (rooms, cafés, galleries, with people for scale) from Pixabay into scenes/photos/.
// Same idea as fetch-pexels.mjs, for when a Pexels key isn't available.
//
//   PIXABAY_API_KEY=... npm run scenes:fetch-pixabay          up to 120 new photos
//   npm run scenes:fetch-pixabay -- --max 12                   smaller batch
//   npm run scenes:fetch-pixabay -- --queries "bedroom,hallway" --orientations horizontal
//   npm run scenes:fetch-pixabay -- --dry-run                  list what it would download (doesn't move its place)
//   npm run scenes:fetch-pixabay -- --all-tags                 don't skip photos by tag (pets, portraits, textures…)
//
// Needs: a free API key from https://pixabay.com/api/docs/ (in .env or the environment).
// Writes scenes/photos/pixabay-<id>.jpg (long edge 1280px, the most a free key gets) + pixabay-<id>.json
// (photographer, page URL, license). Pixabay asks API users to download images rather than hotlink them, which
// is what this does. Skips photos it already has or fetched before (so photos you delete as rejects stay gone),
// skips AI images, 3D renders and tags that rarely give a usable room, keeps its place per query in
// scenes/photos/.pixabay-state.json (re-run to resume), and stays under the 100 requests/minute limit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argDir = process.argv.indexOf("--dir");
const DIR = argDir > 0 && process.argv[argDir + 1] ? path.resolve(process.argv[argDir + 1]) : path.join(root, "scenes", "photos");
const STATE = path.join(DIR, ".pixabay-state.json");
const API = process.env.PIXABAY_API_URL || "https://pixabay.com/api/"; // override only for testing
const LICENSE = "Pixabay Content License: free to use, no attribution required";
const LICENSE_URL = "https://pixabay.com/service/license-summary/";
const UA = "artfinity-scenes/1.0 (room preview photos)";

// Pixabay matches every word against photo tags, so short queries work best. Ordered by how many usable photos
// each gave in the first big run (about 1 in 15 overall). Plain walls with furniture work; busy cafés, bars,
// "empty wall" (textures) and famous paintings mostly don't.
export const QUERIES = [
  "white wall sofa",
  "living room interior",
  "scandinavian living room",
  "modern living room",
  "chair white wall",
  "bedroom interior",
  "office interior",
  "cafe interior",
  "minimalist living room",
  "art gallery",
  "apartment interior",
  "woman sitting sofa",
  "scandinavian interior",
  "minimalist bedroom",
  "loft interior",
  "coworking",
  "home office",
  "people living room",
  "armchair wall",
  "desk white wall",
];

const argv = process.argv.slice(2);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const dry = argv.includes("--dry-run");
const MAX = Math.max(1, Number(opt("max", 120)) || 120);
const PER_QUERY = Math.max(1, Number(opt("per-query", 8)) || 8);
const PER_PAGE = Math.min(200, Math.max(3, Number(opt("per-page", 50)) || 50));
const queries = opt("queries", "") ? opt("queries", "").split(",").map((s) => s.trim()).filter(Boolean) : QUERIES;
const orientations = opt("orientations", "horizontal,vertical").split(",").filter((o) => ["horizontal", "vertical"].includes(o));
const MIN_LONG = 1600; // original size; downloads are scaled to 1280
const PER_MINUTE = 90; // a little under the 100/minute limit
const GAP_MS = 700;
// Pixabay also hosts AI images and 3D renders; we only want real photos.
const NOT_A_PHOTO = /\b(ai[- ]?generated|generated|ai art|3d|render(ing)?|illustration|digital art|cgi|photomontage|photoshop|manipulation|composing|fantasy)\b/i;
// Tags that almost never give a usable room photo (close-ups, pets, textures, frame mockups, seasonal, ruins).
export const SKIP_TAGS = /\b(cats?|kitten|dogs?|puppy|pets?|animal|portrait|model|fashion|beauty|sexy|lingerie|bride|wedding|christmas|xmas|advent|halloween|easter|abandoned|lost places?|ruin|decay|graffiti|texture|background|wallpaper|pattern|backdrop|frame|mockup|mock-up|template|blank canvas|copy space|beer|pub|cocktail|whisky|wine|food|cake|breakfast|close-?up|macro|bokeh|black and white|monochrome|conference|meeting room|bathroom|toilet|bathtub|shower|sauna|blueprint|floor plan|staircase|stairs|attic)\b/i;

function loadEnv() {
  if (process.env.PIXABAY_API_KEY) return;
  try {
    for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();
const KEY = process.env.PIXABAY_API_KEY;
if (!KEY) {
  console.error("Set PIXABAY_API_KEY (free at https://pixabay.com/api/docs/) in .env or the environment.");
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
state.calls = (state.calls || []).filter((t) => Date.now() - t < 60_000);
state.seen ||= []; // every Pixabay id ever downloaded, kept or deleted
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastCall = 0;
async function api(params) {
  for (;;) {
    const recent = state.calls.filter((t) => Date.now() - t < 60_000);
    if (recent.length < PER_MINUTE) break;
    console.log("  (pausing a few seconds to stay under the per-minute limit)");
    await sleep(recent[0] + 60_000 - Date.now() + 500);
    state.calls = recent;
  }
  const gap = lastCall + GAP_MS - Date.now();
  if (gap > 0) await sleep(gap);
  lastCall = Date.now();
  state.calls.push(lastCall);
  // The key goes in the URL (Pixabay's API has no header option), so never print the URL.
  const url = `${API}?${new URLSearchParams({ key: KEY, ...params })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    } catch (e) {
      if (attempt === 2) throw new Error(`Network error talking to pixabay.com: ${e.message}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.status === 429) {
      const reset = Number(res.headers.get("x-ratelimit-reset")) || 60;
      console.log(`  (rate limited; waiting ${reset}s)`);
      await sleep(reset * 1000 + 500);
      continue;
    }
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      if (/api key/i.test(body) || res.status === 401 || res.status === 403)
        throw Object.assign(new Error(`Pixabay rejected the API key (HTTP ${res.status}: ${body.replace(KEY, "***")}). Check PIXABAY_API_KEY in .env.`), { stop: true });
      if (attempt === 2) throw new Error(`Pixabay search failed: HTTP ${res.status} ${body.replace(KEY, "***")}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    return res.json();
  }
  throw new Error("Pixabay search failed after retries.");
}

async function download(url, file) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 5000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("not a JPEG");
      fs.writeFileSync(file + ".part", buf);
      fs.renameSync(file + ".part", file);
      return buf.length;
    } catch (e) {
      if (attempt === 2) throw new Error(`Download failed (${e.message}).`);
      await sleep(1500 * (attempt + 1));
    }
  }
}

const onDisk = fs.readdirSync(DIR).filter((f) => /^pixabay-\d+\.(jpe?g|png|webp)$/.test(f)).map((f) => f.replace(/\.\w+$/, ""));
const have = new Set([...onDisk, ...state.seen.map((i) => `pixabay-${i}`)]);
console.log(`${onDisk.length} Pixabay photos in scenes/photos (${have.size} fetched before). Fetching up to ${MAX} new (${PER_QUERY} per query × orientation)${dry ? " [dry run]" : ""}.`);
let added = 0;
try {
  outer: for (const q of queries) {
    for (const orientation of orientations) {
      const key = `${q}|${orientation}`;
      const saved = state.queries[key] || { page: 1, done: false, got: 0 };
      // A dry run works on a copy so it doesn't move the saved place.
      const st = dry ? { ...saved } : (state.queries[key] = saved);
      if (st.done) continue;
      let gotHere = 0;
      while (gotHere < PER_QUERY && added < MAX) {
        const params = { q: q.slice(0, 100), image_type: "photo", orientation, safesearch: "true", per_page: String(PER_PAGE), page: String(st.page) };
        if (orientation === "horizontal") params.min_width = String(MIN_LONG);
        else params.min_height = String(MIN_LONG);
        const data = await api(params);
        const photos = data?.hits || [];
        if (!photos.length) {
          st.done = true;
          break;
        }
        for (const p of photos) {
          if (gotHere >= PER_QUERY || added >= MAX) break;
          const id = `pixabay-${p.id}`;
          if (have.has(id)) continue;
          if (Math.max(p.imageWidth, p.imageHeight) < MIN_LONG) continue;
          if (NOT_A_PHOTO.test(p.tags || "")) continue;
          if (!argv.includes("--all-tags") && SKIP_TAGS.test(p.tags || "")) continue;
          const src = p.largeImageURL;
          if (!src) continue;
          if (dry) {
            console.log(`  would fetch ${id}  ${p.imageWidth}×${p.imageHeight}  by ${p.user}  [${p.tags}]  (${q}, ${orientation})`);
          } else {
            let bytes;
            try {
              bytes = await download(src, path.join(DIR, `${id}.jpg`));
            } catch (e) {
              console.log(`  ! skipped ${id}: ${e.message}`);
              continue;
            }
            writeJson(path.join(DIR, `${id}.json`), {
              source: "Pixabay",
              pixabayId: p.id,
              photographer: p.user,
              photographerUrl: `https://pixabay.com/users/${p.user}-${p.user_id}/`,
              url: p.pageURL,
              alt: p.tags || "",
              width: p.imageWidth,
              height: p.imageHeight,
              query: q,
              orientation,
              license: LICENSE,
              licenseUrl: LICENSE_URL,
              fetchedAt: new Date().toISOString(),
            });
            state.seen.push(p.id);
            console.log(`  + ${id}  ${(bytes / 1024).toFixed(0)} KB  by ${p.user}  [${p.tags}]  (${q}, ${orientation})`);
          }
          have.add(id);
          added++;
          gotHere++;
          st.got = (st.got || 0) + 1;
        }
        st.page++;
        if (st.page > Math.ceil((data.totalHits || 0) / PER_PAGE)) st.done = true;
        if (!dry) writeJson(STATE, state);
        if (st.done) break;
      }
      if (added >= MAX) break outer;
    }
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (!dry) writeJson(STATE, state);
}
console.log(`\n${dry ? "Would add" : "Added"} ${added} photos. Next: annotate them at /admin/scenes, then npm run scenes:build.`);
