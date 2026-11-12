// Builds data/us-places.json and data/us-zips.json, the server-only datasets behind GET /api/places
// (lib/placeSearch.server.ts). Run it again only to refresh the data:
//
//   node --no-warnings scripts/build-us-places.mjs
//
// Sources, downloaded at build time only (nothing here is a runtime dependency):
//   - GeoNames cities1000 (US + PR towns and cities with 1,000+ people, with population and feature codes), from the
//     npm package cities-with-1000. CC BY 4.0, https://www.geonames.org
//   - GeoNames US postal codes (ZIP → postal city and state), from the npm package zipcodes-us. CC BY 4.0.
//   - Neighborhood boundaries for about 70 US cities from Code for America's Click That 'Hood (MIT; each city's data
//     comes from that city's open data portal, Zillow or a local project, listed in its .metadata.json).
//   - The hand-made NYC borough and neighborhood list in lib/places.ts (that list wins inside NYC).
//
// Output rows are "|"-separated, one place per line (see FIELDS below). Everything stays on the server.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(tmpdir(), "artfinity-us-places");
mkdirSync(CACHE, { recursive: true });

const NPM = {
  cities: "https://registry.npmjs.org/cities-with-1000/-/cities-with-1000-1.0.4.tgz",
  zips: "https://registry.npmjs.org/zipcodes-us/-/zipcodes-us-1.2.0.tgz",
};
const HOODS_REV = "48ba05ad4c6969e3b3c25735492169227ae411f1";
const HOODS_URL = (slug) => `https://raw.githubusercontent.com/codeforgermany/click_that_hood/${HOODS_REV}/public/data/${slug}.geojson`;

// Click That 'Hood files that are neighborhoods of one US city: slug → [city as in GeoNames, state].
// Left out on purpose: files of homeowner associations or subdivisions rather than neighborhoods (San Antonio,
// Albuquerque, Chapel Hill, Durham, Savannah, Rockville, Blacksburg, Williamsburg VA), and NYC (lib/places.ts).
const HOOD_FILES = {
  akron: ["Akron", "OH"], alameda: ["Alameda", "CA"], albany: ["Albany", "NY"],
  anchorage: ["Anchorage", "AK"], arlingtonva: ["Arlington", "VA"], atlanta: ["Atlanta", "GA"], austin: ["Austin", "TX"],
  baltimore: ["Baltimore", "MD"], birmingham: ["Birmingham", "AL"], boston: ["Boston", "MA"],
  charlottesville: ["Charlottesville", "VA"], chesapeake: ["Chesapeake", "VA"],
  chicago: ["Chicago", "IL"], cincinnati: ["Cincinnati", "OH"], cleveland: ["Cleveland", "OH"], columbus: ["Columbus", "OH"],
  dallas: ["Dallas", "TX"], denver: ["Denver", "CO"], "des-moines": ["Des Moines", "IA"], detroit: ["Detroit", "MI"],
  fargo: ["Fargo", "ND"], "fort-lauderdale": ["Fort Lauderdale", "FL"], "grand-rapids": ["Grand Rapids", "MI"],
  hampton: ["Hampton", "VA"], hartford: ["Hartford", "CT"], henderson: ["Henderson", "NV"], honolulu: ["Honolulu", "HI"],
  houston: ["Houston", "TX"], indianapolis: ["Indianapolis", "IN"], "kansas-city": ["Kansas City", "MO"], "las-vegas": ["Las Vegas", "NV"],
  lexington: ["Lexington", "KY"], "long-beach": ["Long Beach", "CA"], "los-angeles": ["Los Angeles", "CA"], louisville: ["Louisville", "KY"],
  macon: ["Macon", "GA"], miami: ["Miami", "FL"], milwaukee: ["Milwaukee", "WI"], minneapolis: ["Minneapolis", "MN"],
  "new-haven": ["New Haven", "CT"], "new-orleans": ["New Orleans", "LA"], oakland: ["Oakland", "CA"], olympia: ["Olympia", "WA"],
  orlando: ["Orlando", "FL"], philadelphia: ["Philadelphia", "PA"], phoenix: ["Phoenix", "AZ"], pittsburgh: ["Pittsburgh", "PA"],
  portland: ["Portland", "OR"], providence: ["Providence", "RI"], raleigh: ["Raleigh", "NC"], richmond: ["Richmond", "VA"],
  rochester: ["Rochester", "NY"], sacramento: ["Sacramento", "CA"], "salt-lake-city": ["Salt Lake City", "UT"],
  "san-diego": ["San Diego", "CA"], "san-francisco": ["San Francisco", "CA"], "san-jose": ["San Jose", "CA"],
  seattle: ["Seattle", "WA"], springfield: ["Springfield", "MA"], "st-louis": ["St. Louis", "MO"],
  stamford: ["Stamford", "CT"], tampa: ["Tampa", "FL"], tucson: ["Tucson", "AZ"], washington: ["Washington", "DC"],
  "west-linn": ["West Linn", "OR"], "west-palm-beach": ["West Palm Beach", "FL"],
};
// Not neighborhoods people live in or would type.
const NOT_A_HOOD = /\b(airport|cemetery|industrial|association|hoa|coalition|committee|partnership|inc|condominiums?|apts|apartments|owners|subdivision|townhomes?|club|unassigned|unknown|water)\b/i;
const DIRECTION = /^(north|south|east|west|northeast|northwest|southeast|southwest|central|north central|south central|east central|west central)$/i;

// 2020 census populations, for ranking states against cities.
const STATE_POP = {
  AL: 5024279, AK: 733391, AZ: 7151502, AR: 3011524, CA: 39538223, CO: 5773714, CT: 3605944, DE: 989948, DC: 689545, FL: 21538187,
  GA: 10711908, HI: 1455271, ID: 1839106, IL: 12812508, IN: 6785528, IA: 3190369, KS: 2937880, KY: 4505836, LA: 4657757, ME: 1362359,
  MD: 6177224, MA: 7029917, MI: 10077331, MN: 5706494, MS: 2961279, MO: 6154913, MT: 1084225, NE: 1961504, NV: 3104614, NH: 1377529,
  NJ: 9288994, NM: 2117522, NY: 20201249, NC: 10439388, ND: 779094, OH: 11799448, OK: 3959353, OR: 4237256, PA: 13002700, RI: 1097379,
  SC: 5118425, SD: 886667, TN: 6910840, TX: 29145505, UT: 3271616, VT: 643077, VA: 8631393, WA: 7705281, WV: 1793716, WI: 5893718,
  WY: 576851, PR: 3285874,
};

// Names people type for big cities.
const CITY_ALIASES = {
  "New York|NY": ["New York City", "NYC"], "Los Angeles|CA": ["LA"], "San Francisco|CA": ["SF"], "Philadelphia|PA": ["Philly"],
  "Washington|DC": ["Washington DC", "DC"], "Las Vegas|NV": ["Vegas"], "New Orleans|LA": ["NOLA"], "Atlanta|GA": ["ATL"],
  "Saint Paul|MN": ["St Paul"], "Salt Lake City|UT": ["SLC"], "Kansas City|MO": ["KC", "KCMO"], "Oklahoma City|OK": ["OKC"],
};

// GeoNames names that need tidying.
const RENAME = { "Washington, D.C.": "Washington", "New York City": "New York", "Lexington-Fayette": "Lexington", "Stambaugh, Iron River": "Stambaugh", "New Century, KS": "New Century", "City of Milford (balance)": "Milford", "Village of Oak Creek (Big Park)": "Village of Oak Creek" };
const tidyName = (n) => (RENAME[n] ?? n).replace(/\s*\((village|balance|city|town)\)$/i, "").trim();

const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['\u2019.]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// "St. Louis" and "Saint Louis" are the same name.
const ABBR = { st: "saint", ste: "sainte", mt: "mount", ft: "fort", pt: "point" };
const canon = (s) => fold(s).split(" ").map((w) => ABBR[w] ?? w).join(" ");

// Rough populations for big NYC neighborhoods GeoNames has no good number for (NYC Planning, 2020, rounded).
const NYC_POP = { Williamsburg: 150000, "Bed-Stuy": 160000, "Crown Heights": 140000, "Upper West Side": 210000, "Upper East Side": 220000, Chelsea: 50000, "Lower East Side": 70000, "Long Island City": 45000, Flushing: 72000 };

/* ---------------- downloads ---------------- */

async function download(url, file) {
  const out = path.join(CACHE, file);
  if (existsSync(out)) return out;
  process.stdout.write(`  downloading ${url.replace(/^.*\//, "")}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  return out;
}

async function npmFile(url, inner) {
  const tgz = await download(url, path.basename(url));
  const dir = path.join(CACHE, path.basename(url, ".tgz"));
  if (!existsSync(path.join(dir, inner))) {
    mkdirSync(dir, { recursive: true });
    execFileSync("tar", ["xzf", tgz, "-C", dir]);
  }
  return readFileSync(path.join(dir, inner), "utf8");
}

/* ---------------- geometry ---------------- */

function rings(geom) {
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  return [];
}
function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inGeom(geom, lon, lat) {
  return rings(geom).some((poly) => inRing(poly[0], lon, lat) && !poly.slice(1).some((hole) => inRing(hole, lon, lat)));
}
function centroid(geom) {
  if (geom?.type === "Point") return geom.coordinates;
  const pts = rings(geom).flatMap((p) => p[0] ?? []);
  if (!pts.length) return null;
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}
const km = (a, b) => {
  const r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r;
  const dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/* ---------------- build ---------------- */

const titleCase = (s) => (s === s.toUpperCase() && /[A-Z]{3}/.test(s) ? s.toLowerCase().replace(/(^|[\s\-/(.'])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : s);
const cleanHood = (s) =>
  titleCase(String(s).replace(/\s+/g, " ").trim())
    .replace(/\s*\((neighborhood|nbhd)\)$/i, "")
    .replace(/\s+(Neighborhood|Neighbourhood)$/i, "")
    .trim();

async function main() {
  const { US_STATES, nycPlaces } = await import(path.join(ROOT, "lib/places.ts"));

  console.log("Reading GeoNames cities1000…");
  const citiesTxt = await npmFile(NPM.cities, "package/cities1000.txt");
  const geo = [];
  for (const line of citiesTxt.split("\n")) {
    const f = line.split("\t");
    if (f.length < 15) continue;
    const country = f[8];
    if (country !== "US" && country !== "PR") continue;
    const code = f[7];
    if (["PPLQ", "PPLH", "PPLW", "PPLCH"].includes(code) || /\(historical\)/.test(f[1])) continue;
    const pop = Number(f[14]) || 0;
    const st = country === "PR" ? "PR" : f[10];
    if (!US_STATES.some(([c]) => c === st)) continue;
    geo.push({ id: f[0], name: tidyName(f[1]), st, pop, code, ll: [Number(f[5]), Number(f[4])] });
  }
  console.log(`  ${geo.length} US and PR places`);

  console.log("Reading GeoNames postal codes…");
  const zipTxt = await npmFile(NPM.zips, "package/data/US.txt");
  const zipRows = [];
  for (const line of zipTxt.split("\n")) {
    const f = line.split("\t");
    if (f.length < 5 || !/^\d{5}$/.test(f[1])) continue;
    const st = f[4] || (f[3] === "Puerto Rico" ? "PR" : "");
    if (!US_STATES.some(([c]) => c === st)) continue;
    zipRows.push({ zip: f[1], city: f[2].trim(), st, ll: [Number(f[10]), Number(f[9])] });
  }
  const postal = new Set(zipRows.map((z) => `${canon(z.city)}|${z.st}`));
  console.log(`  ${zipRows.length} ZIPs, ${postal.size} postal cities`);

  // NYC: the five boroughs' outlines decide which GeoNames points are really NYC neighborhoods.
  const boroughsGeo = JSON.parse(readFileSync(await download(HOODS_URL("new-york-city-boroughs"), "new-york-city-boroughs.geojson"), "utf8"));
  const boroughOf = (ll) => {
    for (const f of boroughsGeo.features) if (inGeom(f.geometry, ll[0], ll[1])) return String(f.properties.name ?? f.properties.BoroName);
    return null;
  };
  const BORO_FIX = { "The Bronx": "Bronx" };

  const out = []; // { k, name, st, pop, parent?, postal?, aliases? }
  const seen = new Set();
  const add = (row) => {
    const key = `${row.k}|${fold(row.name)}|${row.st}|${fold(row.parent ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    out.push(row);
    return true;
  };

  // States.
  for (const [code, name] of US_STATES) add({ k: "s", name, st: code, pop: STATE_POP[code] ?? 0, aliases: [code] });

  // NYC from the hand list, with GeoNames populations where the names match.
  const nycGeo = new Map(); // fold(name) → { pop, borough }
  const insideNyc = new Set();
  for (const g of geo) {
    if (g.st !== "NY" || g.ll[1] < 40.45 || g.ll[1] > 40.95 || g.ll[0] < -74.3 || g.ll[0] > -73.65) continue;
    const b = boroughOf(g.ll);
    if (!b) continue;
    if (g.id === "5128581") continue; // New York City itself stays a city
    insideNyc.add(g.id);
    const k = fold(g.name.replace(/^The /, ""));
    if (!nycGeo.has(k) || nycGeo.get(k).pop < g.pop) nycGeo.set(k, { pop: g.pop, borough: BORO_FIX[b] ?? b, name: g.name });
  }
  const nyc = nycPlaces();
  const hoodCount = {};
  for (const p of nyc) if (p.kind === "neighborhood") hoodCount[p.borough] = (hoodCount[p.borough] ?? 0) + 1;
  const boroPop = {};
  for (const p of nyc.filter((x) => x.kind === "borough")) {
    const g = nycGeo.get(fold(p.primary));
    boroPop[p.borough] = g?.pop ?? 400000;
    add({ k: "b", name: p.primary, st: "NY", pop: boroPop[p.borough], parent: "New York", postal: p.primary === "Manhattan" ? "New York" : undefined, aliases: (p.aliases ?? []).filter((a) => !/^new york|^nyc$/i.test(a)) });
  }
  const usedNycGeo = new Set();
  for (const p of nyc.filter((x) => x.kind === "neighborhood")) {
    const g = [p.primary, ...(p.aliases ?? [])].map((a) => nycGeo.get(fold(a))).find((x) => x && x.borough === p.borough);
    if (g) usedNycGeo.add(fold(g.name.replace(/^The /, "")));
    const pop = Math.max(g?.pop ?? Math.round(boroPop[p.borough] / hoodCount[p.borough]), NYC_POP[p.primary] ?? 0);
    const post = p.borough === "Manhattan" ? "New York" : postal.has(`${canon(p.primary)}|NY`) && p.borough === "Queens" ? p.primary : p.borough;
    add({ k: "n", name: p.primary, st: "NY", pop, parent: p.borough, postal: post !== p.borough ? post : undefined, aliases: p.aliases });
  }
  // GeoNames NYC places missing from the hand list become neighborhoods of their borough.
  const extraNyc = [];
  for (const [k, g] of nycGeo) {
    if (usedNycGeo.has(k) || nyc.some((p) => fold(p.primary) === k)) continue;
    if (g.pop < 1000) continue;
    const post = g.borough === "Manhattan" ? "New York" : g.borough === "Queens" && postal.has(`${canon(g.name)}|NY`) ? g.name : g.borough;
    if (add({ k: "n", name: g.name, st: "NY", pop: g.pop, parent: g.borough, postal: post !== g.borough ? post : undefined })) extraNyc.push(g.name);
  }
  console.log(`  NYC: ${nyc.length} hand-made places, ${extraNyc.length} more from GeoNames`);

  // Neighborhoods elsewhere (Click That 'Hood), with GeoNames populations where a same-named point sits inside.
  const cityPop = new Map();
  for (const g of geo) {
    if (g.code === "PPLX") continue;
    const k = `${g.name}|${g.st}`;
    if ((cityPop.get(k) ?? -1) < g.pop) cityPop.set(k, g.pop);
  }
  const absorbed = new Set(); // GeoNames ids that turned out to be a neighborhood
  const hoods = [];
  let files = 0;
  for (const [slug, [city, st]] of Object.entries(HOOD_FILES)) {
    let gj;
    try {
      gj = JSON.parse(readFileSync(await download(HOODS_URL(slug), `${slug}.geojson`), "utf8"));
    } catch (e) {
      console.warn(`  skipped ${slug}: ${e.message}`);
      continue;
    }
    files++;
    const names = [];
    for (const f of gj.features ?? []) {
      const pr = f.properties ?? {};
      const raw = pr.name ?? pr.NAME ?? pr.Name ?? pr.neighborhood ?? pr.NEIGHBORHOOD ?? pr.nbhd_name;
      if (!raw || typeof raw !== "string") continue;
      // "Downtown/Civic Center" is two places.
      for (const part of raw.split("/")) {
        const name = cleanHood(part);
        if (name.length < 3 || /^\d+$/.test(name) || fold(name) === fold(city) || NOT_A_HOOD.test(name) || DIRECTION.test(name)) continue;
        names.push({ name, geom: f.geometry });
      }
    }
    const uniq = new Map();
    for (const n of names) if (!uniq.has(fold(n.name))) uniq.set(fold(n.name), n);
    const parentPop = cityPop.get(`${city}|${st}`) ?? cityPop.get(`${city.replace(/^St\. /, "Saint ")}|${st}`) ?? 100000;
    const each = Math.max(1000, Math.round(parentPop / Math.max(uniq.size, 1)));
    for (const { name, geom } of uniq.values()) {
      const k = fold(name);
      let pop = each;
      for (const g of geo) {
        if (g.st !== st || fold(g.name) !== k || g.pop >= parentPop) continue;
        const c = centroid(geom);
        if (inGeom(geom, g.ll[0], g.ll[1]) || (c && km(c, g.ll) < 3)) {
          pop = Math.max(pop, g.pop);
          absorbed.add(g.id);
        }
      }
      const post = postal.has(`${canon(name)}|${st}`) ? name : undefined;
      hoods.push({ k: "n", name, st, pop: Math.min(pop, Math.round(parentPop / 3)), parent: city, postal: post });
    }
  }
  console.log(`  ${hoods.length} neighborhoods from ${files} cities`);

  // GeoNames PPLX ("section of a populated place") outside NYC: a neighborhood of a big city close by, unless it is
  // a mail town of its own (Culver City, Marina del Rey…), which stays a town.
  const big = geo.filter((g) => g.code !== "PPLX" && g.pop >= 400000);
  for (const g of geo) {
    if (g.code !== "PPLX" || insideNyc.has(g.id) || postal.has(`${canon(g.name)}|${g.st}`)) continue;
    let best = null;
    for (const b of big) {
      if (b.st !== g.st || b.pop < g.pop * 2) continue;
      const d = km(b.ll, g.ll);
      if (d < 15 && (!best || d < best.d)) best = { b, d };
    }
    if (!best) continue; // stays a town below
    absorbed.add(g.id);
    const k = fold(g.name);
    if (hoods.some((h) => h.st === g.st && fold(h.name) === k)) continue;
    hoods.push({ k: "n", name: g.name, st: g.st, pop: g.pop, parent: best.b.name, postal: postal.has(`${canon(g.name)}|${g.st}`) ? g.name : undefined });
  }
  for (const h of hoods) add(h);

  // Cities and towns. GeoNames sometimes lists one town twice ("St. Louis" and "Saint Louis"): keep the bigger.
  let cities = 0;
  const kept = new Map();
  for (const g of [...geo].sort((a, b) => b.pop - a.pop)) {
    if (insideNyc.has(g.id) || absorbed.has(g.id)) continue;
    if (g.pop < 1000 && !/^PPLA/.test(g.code) && g.code !== "PPLC") continue;
    const dk = `${canon(g.name)}|${g.st}`;
    if ((kept.get(dk) ?? []).some((ll) => km(ll, g.ll) < 10)) continue;
    kept.set(dk, [...(kept.get(dk) ?? []), g.ll]);
    if (add({ k: "c", name: g.name, st: g.st, pop: g.pop, aliases: CITY_ALIASES[`${g.name}|${g.st}`] })) cities++;
  }
  // Postal cities with no GeoNames row (small towns, mail-only names): ranked below every known town.
  const known = new Set(out.map((r) => `${canon(r.name)}|${r.st}`));
  for (const r of out) if (r.postal) known.add(`${canon(r.postal)}|${r.st}`);
  const zipCount = new Map();
  const zipName = new Map();
  for (const z of zipRows) {
    const k = `${canon(z.city)}|${z.st}`;
    zipCount.set(k, (zipCount.get(k) ?? 0) + 1);
    zipName.set(k, z.city);
  }
  let postalOnly = 0;
  for (const [k, n] of zipCount) {
    if (known.has(k)) continue;
    const [, st] = k.split("|");
    if (add({ k: "c", name: zipName.get(k), st, pop: Math.min(n, 9) })) postalOnly++;
  }
  console.log(`  ${cities} cities and towns, ${postalOnly} more postal towns`);

  // Biggest first, so the server can stop early.
  out.sort((a, b) => b.pop - a.pop);
  const FIELDS = "kind|name|state|population|parent|postal city|aliases (;)";
  const rows = out.map((r) => [r.k, r.name, r.st, r.pop, r.parent ?? "", r.postal ?? "", (r.aliases ?? []).join(";")].join("|").replace(/\|+$/, ""));
  for (const r of rows) if (r.split("|").length > 7) throw new Error(`stray "|" in ${r}`);
  const meta = {
    about: "US states, cities, towns and neighborhoods for GET /api/places. Built by scripts/build-us-places.mjs. Server only.",
    sources: "GeoNames cities1000 and US postal codes (CC BY 4.0, geonames.org); Click That 'Hood neighborhoods (MIT, Code for America); NYC list in lib/places.ts",
    fields: FIELDS,
    counts: Object.fromEntries(["s", "c", "b", "n"].map((k) => [k, out.filter((r) => r.k === k).length])),
  };
  writeFileSync(path.join(ROOT, "data/us-places.json"), JSON.stringify({ ...meta, rows: rows.join("\n") }) + "\n");

  // ZIPs, grouped by postal city: "ST|City|first zip,delta,delta…" (deltas in base 36).
  const byCity = new Map();
  for (const z of zipRows) {
    const k = `${z.st}|${z.city}`;
    if (!byCity.has(k)) byCity.set(k, []);
    byCity.get(k).push(Number(z.zip));
  }
  const zipLines = [...byCity].map(([k, list]) => {
    list.sort((a, b) => a - b);
    const enc = list.map((z, i) => (i ? (z - list[i - 1]).toString(36) : String(z).padStart(5, "0")));
    return `${k}|${enc.join(",")}`;
  });
  writeFileSync(
    path.join(ROOT, "data/us-zips.json"),
    JSON.stringify({ about: "US ZIP codes by postal city for GET /api/places. Built by scripts/build-us-places.mjs. Server only.", sources: "GeoNames US postal codes (CC BY 4.0, geonames.org)", fields: "state|postal city|first zip,then base-36 gaps to the next", rows: zipLines.join("\n") }) + "\n",
  );
  console.log("Counts:", meta.counts, `ZIP cities: ${zipLines.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
