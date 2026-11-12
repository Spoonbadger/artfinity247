// Place search for GET /api/places: every US state, city and town (and the neighborhoods we have) from
// data/us-places.json, plus ZIPs from data/us-zips.json (loaded the first time a ZIP is needed). Server only: the
// data never reaches the browser. Loaded once per server process into plain arrays; a query is one linear scan
// over ~38k short strings (about a millisecond).
//
// Ranking: how well the name matches (exact, starts with, a word starts with, contains) traded against population:
// each step down the match list costs a factor of 10 to 30 in size, so "brook" offers Brooklyn before Brook, IN,
// and "portland" still offers both Portlands before Portage. Typed
// qualifiers narrow it: "portland, me", "portland me", "portland maine", "williamsburg, brooklyn". "near" (a state
// code) lifts that state's places. Abbreviations match both ways ("St. Louis" = "Saint Louis", "Ft" = "Fort").
import data from "@/data/us-places.json";
import { BOROUGHS, US_STATES } from "@/lib/places";

export type PlaceKind = "state" | "city" | "borough" | "neighborhood";
export type SearchKind = "place" | "city" | "state" | "neighborhood" | "address" | "zip";

/** One suggestion. `value` is what a place field stores: "Austin, TX", "Williamsburg, Brooklyn", "Wicker Park, Chicago, IL". */
export type PlaceHit = {
  value: string;
  primary: string;
  secondary: string;
  kind: PlaceKind | "address";
  /** The city a mail carrier wants: "Brooklyn" for Williamsburg, "New York" for SoHo, "Astoria" for Astoria. */
  city: string;
  state: string;
  neighborhood?: string;
  borough?: string;
  zip?: string;
};

type Row = {
  k: "s" | "c" | "b" | "n";
  name: string;
  st: string;
  pop: number;
  parent: string;
  postal: string;
  keys: string[];
  /** How many of `keys` are the name itself (the rest are aliases). */
  own: number;
  qual: string[];
};

const KIND: Record<Row["k"], PlaceKind> = { s: "state", c: "city", b: "borough", n: "neighborhood" };
const STATE_NAME = new Map(US_STATES);
const STATE_BY_FOLD = new Map<string, string>();
const NYC = new Set<string>(BOROUGHS);

/** Lowercase, no accents, no apostrophes, "&" as "and", everything else a single space. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019`.]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ABBR: [string, string][] = [["st", "saint"], ["ste", "sainte"], ["mt", "mount"], ["ft", "fort"], ["pt", "point"]];
/** A folded name with abbreviations spelled out, and with them shortened. */
function variants(f: string): string[] {
  const words = f.split(" ");
  const long = words.map((w) => ABBR.find(([a]) => a === w)?.[1] ?? w).join(" ");
  const short = words.map((w) => ABBR.find(([, b]) => b === w)?.[0] ?? w).join(" ");
  return [...new Set([f, long, short])];
}

let rows: Row[] | null = null;

function load(): Row[] {
  if (rows) return rows;
  for (const [code, name] of US_STATES) {
    STATE_BY_FOLD.set(fold(code), code);
    STATE_BY_FOLD.set(fold(name), code);
  }
  const out: Row[] = [];
  // Many rows share a state, parent or postal city: fold each once and share the string.
  const memo = new Map<string, string>();
  const shared = (v: string) => {
    let f = memo.get(v);
    if (f === undefined) memo.set(v, (f = fold(v)));
    return f;
  };
  for (const line of (data as { rows: string }).rows.split("\n")) {
    const [k, name, st, pop, parent = "", postal = "", aliases = ""] = line.split("|");
    if (!name) continue;
    const own = variants(fold(name));
    const extra = aliases ? aliases.split(";").flatMap((a) => variants(fold(a))) : [];
    const qual = [shared(st), shared(STATE_NAME.get(st) ?? ""), ...(parent ? [shared(parent)] : []), ...(postal ? [shared(postal)] : [])];
    out.push({ k: k as Row["k"], name, st, pop: Number(pop) || 0, parent, postal, keys: [...own, ...extra.filter((a) => !own.includes(a))], own: own.length, qual });
  }
  rows = out;
  return rows;
}

/** 0 exact, 1 starts with, 2 a word starts with, 3 contains (4+ letters), -1 no match. Aliases only count whole or as a start. */
function tier(r: Row, q: string): number {
  let best = -1;
  for (let i = 0; i < r.keys.length; i++) {
    const key = r.keys[i];
    let t = -1;
    if (key === q) t = 0;
    else if (key.startsWith(q)) t = 1;
    else if (i < r.own && key.includes(" " + q)) t = 2;
    else if (i < r.own && q.length >= 4 && key.includes(q)) t = 3;
    // A short alias (a state code, "LA", "SF") only counts when typed in full.
    if (t === 1 && i >= r.own && key.length <= 3) t = -1;
    if (t >= 0 && (best < 0 || t < best)) best = t;
    if (best === 0) break;
  }
  return best;
}

/** A typed qualifier ("me", "maine", "brooklyn", "chi") fits this row's state, parent city or postal city. */
function fits(r: Row, qual: string): boolean {
  if (!qual) return true;
  const [code, stateName, ...rest] = r.qual;
  if (qual === code || (qual.length >= 3 && stateName.startsWith(qual)) || (qual.length === 1 && code.startsWith(qual))) return true;
  return rest.some((p) => p.startsWith(qual) || p.includes(" " + qual));
}

const KINDS: Record<Exclude<SearchKind, "address" | "zip">, Row["k"][]> = {
  place: ["s", "c", "b", "n"],
  city: ["c", "b", "n"],
  state: ["s"],
  neighborhood: ["n", "b"],
};
// States compete with cities at a fraction of their size, so "new york" offers the city first.
const WEIGHT: Record<Row["k"], number> = { s: 0.3, c: 1, b: 1, n: 1 };

type Scored = { r: Row; t: number; score: number };
// What a worse match costs, in powers of ten of population.
const PENALTY = [0, 1, 2.5, 4];

function scan(head: string, quals: string[], kinds: Row["k"][], near: string | null, into: Map<Row, Scored>) {
  if (!head) return;
  for (const r of load()) {
    if (!kinds.includes(r.k)) continue;
    const t = tier(r, head);
    if (t < 0 || !quals.every((q) => fits(r, q))) continue;
    const w = r.pop * WEIGHT[r.k] * (near && r.st === near ? 3 : 1);
    const score = Math.log10(w + 10) - PENALTY[t];
    const prev = into.get(r);
    if (!prev || score > prev.score) into.set(r, { r, t, score });
  }
}

function rank(query: string, kinds: Row["k"][], near: string | null): Row[] {
  const segs = query.split(",").map((s) => fold(s));
  const head = segs[0];
  const quals = segs.slice(1).filter(Boolean);
  const found = new Map<Row, Scored>();
  scan(head, quals, kinds, near, found);
  // "portland me", "portland maine", "salem north carolina": a state on the end, without a comma.
  if (!quals.length) {
    const words = head.split(" ");
    for (const n of [1, 2]) {
      if (words.length <= n) continue;
      const st = STATE_BY_FOLD.get(words.slice(-n).join(" "));
      if (st) scan(words.slice(0, -n).join(" "), [fold(st)], kinds, near, found);
    }
  }
  // Typed something after a comma that fits nothing ("Booth 14, DUM")? Try the last part alone.
  if (!found.size && quals.length) scan(quals[quals.length - 1], [], kinds, near, found);
  return [...found.values()].sort((a, b) => b.score - a.score).map((s) => s.r);
}

function hit(r: Row): PlaceHit {
  const stateName = STATE_NAME.get(r.st) ?? r.st;
  if (r.k === "s") return { value: r.name, primary: r.name, secondary: "State", kind: "state", city: "", state: r.st };
  if (r.k === "b") return { value: r.name, primary: r.name, secondary: "Borough of New York City", kind: "borough", city: r.postal || r.name, state: "NY", borough: r.name };
  if (r.k === "n") {
    const nyc = r.st === "NY" && NYC.has(r.parent);
    return {
      value: nyc ? `${r.name}, ${r.parent}` : `${r.name}, ${r.parent}, ${r.st}`,
      primary: r.name,
      secondary: `Neighborhood in ${r.parent}, ${r.st}`,
      kind: "neighborhood",
      city: r.postal || r.parent,
      state: r.st,
      neighborhood: r.name,
      ...(nyc ? { borough: r.parent } : {}),
    };
  }
  return { value: `${r.name}, ${r.st}`, primary: r.name, secondary: `City in ${stateName}`, kind: "city", city: r.name, state: r.st };
}

/* ---------------- ZIPs ---------------- */

type ZipIndex = { byZip: Map<string, { city: string; st: string }>; byCity: Map<string, string[]> };
let zipIndex: Promise<ZipIndex> | null = null;

function zips(): Promise<ZipIndex> {
  zipIndex ??= import("@/data/us-zips.json").then((mod) => {
    const byZip = new Map<string, { city: string; st: string }>();
    const byCity = new Map<string, string[]>();
    for (const line of (mod.default as { rows: string }).rows.split("\n")) {
      const [st, city, list] = line.split("|");
      if (!list) continue;
      let z = 0;
      const all = list.split(",").map((d, i) => String((z = i ? z + parseInt(d, 36) : Number(d))).padStart(5, "0"));
      for (const zip of all) byZip.set(zip, { city, st });
      byCity.set(`${fold(city)}|${st}`, all);
    }
    return { byZip, byCity };
  });
  return zipIndex;
}

/** The postal city and state for a ZIP ("11211" → Brooklyn, NY). */
export async function lookupZip(zip: string): Promise<PlaceHit | null> {
  const z = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(z)) return null;
  const hitZ = (await zips()).byZip.get(z);
  if (!hitZ) return null;
  const value = `${hitZ.city}, ${hitZ.st} ${z}`;
  return { value, primary: value, secondary: `ZIP in ${STATE_NAME.get(hitZ.st) ?? hitZ.st}`, kind: "address", city: hitZ.city, state: hitZ.st, zip: z };
}

/**
 * The end of a street address, after the first comma: "Brook" → "Brooklyn, NY"; "Brooklyn, N" → "Brooklyn, NY";
 * "Brooklyn, NY 112" → "Brooklyn, NY 11201"…; "11211" → "Brooklyn, NY 11211". `value` is the finished part only.
 */
async function addressTail(q: string, near: string | null, limit: number): Promise<PlaceHit[]> {
  const segs = q.split(",").map((s) => s.trim());
  const last = segs[segs.length - 1] ?? "";
  const zipPart = last.match(/(?:^|\s)(\d{1,5})$/)?.[1];
  const out: PlaceHit[] = [];
  const seen = new Set<string>();
  const push = (h: PlaceHit) => {
    if (seen.has(h.value) || out.length >= limit) return;
    seen.add(h.value);
    out.push(h);
  };

  if (zipPart) {
    const parts = [...segs.slice(0, -1), last.slice(0, last.length - zipPart.length).trim()].filter(Boolean);
    const st = parts.length ? STATE_BY_FOLD.get(fold(parts[parts.length - 1])) : undefined;
    if (st) parts.pop();
    const city = parts[parts.length - 1] ?? "";
    const idx = await zips();
    if (!city) {
      if (zipPart.length < 3) return [];
      for (const [z, c] of idx.byZip) {
        if (!z.startsWith(zipPart) || (st && c.st !== st)) continue;
        push({ value: `${c.city}, ${c.st} ${z}`, primary: `${c.city}, ${c.st} ${z}`, secondary: `ZIP in ${STATE_NAME.get(c.st) ?? c.st}`, kind: "address", city: c.city, state: c.st, zip: z });
        if (out.length >= limit) break;
      }
      return out.sort((a, b) => a.zip!.localeCompare(b.zip!));
    }
    // ZIPs of the city typed (its postal city when it's a neighborhood).
    for (const r of rank(st ? `${city}, ${st}` : city, KINDS.city, near).slice(0, 4)) {
      const h = hit(r);
      for (const z of idx.byCity.get(`${fold(h.city)}|${h.state}`) ?? []) {
        if (z.startsWith(zipPart)) push({ value: `${h.city}, ${h.state} ${z}`, primary: `${h.city}, ${h.state} ${z}`, secondary: h.kind === "neighborhood" ? h.value : `ZIP in ${h.city}`, kind: "address", city: h.city, state: h.state, zip: z });
      }
      if (out.length) break;
    }
    return out;
  }

  // City, then state.
  const city = segs.length > 1 ? segs[segs.length - 2] : last;
  const statePart = segs.length > 1 ? last : "";
  if (fold(city).length < 2) return [];
  const idx = await zips();
  for (const r of rank(statePart ? `${city}, ${statePart}` : city, KINDS.city, near)) {
    if (statePart && !fits(r, fold(statePart))) continue;
    const h = hit(r);
    const list = idx.byCity.get(`${fold(h.city)}|${h.state}`);
    // A town with a single ZIP gets it filled in too.
    const zip = list?.length === 1 ? list[0] : undefined;
    const value = `${h.city}, ${h.state}${zip ? ` ${zip}` : ""}`;
    push({ value, primary: value, secondary: h.kind === "neighborhood" ? h.value : h.kind === "borough" ? "Borough of New York City" : `City in ${STATE_NAME.get(h.state) ?? h.state}`, kind: "address", city: h.city, state: h.state, ...(zip ? { zip } : {}), ...(h.neighborhood ? { neighborhood: h.neighborhood } : {}), ...(h.borough ? { borough: h.borough } : {}) });
    if (out.length >= limit) break;
  }
  return out;
}

/** Suggestions for what someone typed. */
export async function searchPlacesUS(query: string, kind: SearchKind = "place", opts: { limit?: number; near?: string | null } = {}): Promise<PlaceHit[]> {
  const q = query.trim().slice(0, 100);
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 10);
  const near = opts.near && STATE_NAME.has(opts.near.toUpperCase()) ? opts.near.toUpperCase() : null;
  if (!q) return [];
  load();
  if (kind === "zip") return [await lookupZip(q)].filter((h): h is PlaceHit => !!h);
  if (kind === "address") return addressTail(q, near, Math.min(limit, 6));
  const out: PlaceHit[] = [];
  const seen = new Set<string>();
  for (const r of rank(q, KINDS[kind] ?? KINDS.place, near)) {
    const h = hit(r);
    const key = kind === "city" ? `${h.primary}|${h.city}|${h.state}` : h.value;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}
