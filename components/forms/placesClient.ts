// Browser side of the location fields: fetches suggestions from GET /api/places and /api/places/address, keeps a small
// in-memory cache per query, and works out instant results while a request is in flight. No place data ships here
// beyond the 52 states (lib/places.ts US_STATES).
import { US_STATES } from "@/lib/places";

export type PlaceKind = "state" | "city" | "borough" | "neighborhood";
export type SearchKind = "place" | "city" | "state" | "neighborhood" | "address" | "zip";

/** Mirrors PlaceHit in lib/placeSearch.server.ts. */
export type PlaceHit = {
  value: string;
  primary: string;
  secondary: string;
  kind: PlaceKind | "address";
  city: string;
  state: string;
  neighborhood?: string;
  borough?: string;
  zip?: string;
};

export type AddressHit = { id: string; value: string; primary: string; secondary: string };
export type AddressPick = { value: string; kind: "address"; line1: string; city: string; state: string; zip: string; neighborhood?: string; borough?: string };

/** Lowercase, no accents or punctuation (same idea as the server's fold). */
export const fold = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['\u2019`.]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const cache = new Map<string, PlaceHit[]>();
const key = (q: string, kind: SearchKind, near?: string) => `${kind}|${near ?? ""}|${fold(q)}${/,\s*$/.test(q) ? "," : ""}`;

function remember(k: string, v: PlaceHit[]) {
  cache.set(k, v);
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
}

/** Cached answer for exactly this query, if any. */
export function cachedPlaces(q: string, kind: SearchKind, near?: string): PlaceHit[] | undefined {
  return cache.get(key(q, kind, near));
}

/** Something to show right away: an earlier, shorter query's answers that still match, and states (tiny, bundled). */
export function instantPlaces(q: string, kind: SearchKind, near?: string): PlaceHit[] {
  const f = fold(q);
  if (!f || q.includes(",")) return [];
  let prior: PlaceHit[] = [];
  for (let n = f.length - 1; n >= 1; n--) {
    const hit = cache.get(`${kind}|${near ?? ""}|${f.slice(0, n)}`);
    if (hit) {
      prior = hit.filter((h) => startsAtWord(fold(h.primary), f));
      break;
    }
  }
  const states = kind === "place" || kind === "state" ? localStates(f) : [];
  const out = [...prior];
  for (const s of states) if (!out.some((h) => h.value === s.value)) out.push(s);
  return out.slice(0, 8);
}

const startsAtWord = (name: string, q: string) => name.startsWith(q) || name.includes(" " + q);

/** States matching what was typed ("tx", "new", "car"), bigger match first. */
export function localStates(f: string): PlaceHit[] {
  if (!f) return [];
  const out: { h: PlaceHit; t: number }[] = [];
  for (const [code, name] of US_STATES) {
    const n = fold(name);
    const t = fold(code) === f || n === f ? 0 : n.startsWith(f) ? 1 : n.includes(" " + f) ? 2 : -1;
    if (t >= 0) out.push({ t, h: { value: name, primary: name, secondary: "State", kind: "state", city: "", state: code } });
  }
  return out.sort((a, b) => a.t - b.t).map((x) => x.h);
}

/** Suggestions from GET /api/places, cached per query. Throws AbortError when cancelled. */
export async function fetchPlaces(q: string, kind: SearchKind, opts: { near?: string; limit?: number; signal?: AbortSignal } = {}): Promise<PlaceHit[]> {
  const k = key(q, kind, opts.near);
  const hit = cache.get(k);
  if (hit) return hit;
  const sp = new URLSearchParams({ q, kind });
  if (opts.near) sp.set("near", opts.near);
  if (opts.limit) sp.set("limit", String(opts.limit));
  const res = await fetch(`/api/places?${sp}`, { signal: opts.signal });
  if (!res.ok) return [];
  const { results } = (await res.json()) as { results: PlaceHit[] };
  remember(k, results ?? []);
  return results ?? [];
}

/* ---------------- street addresses ---------------- */

/** null until the first answer: "google" when the server has a key, "none" when it doesn't. */
let provider: "google" | "none" | null = null;
export const addressProvider = () => provider;

/** A new autocomplete session token (Google bills per session: the keystrokes plus the final pick). */
export function newSession(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
  }
}

export async function fetchAddresses(q: string, session: string, opts: { types?: "address" | "any"; signal?: AbortSignal } = {}): Promise<AddressHit[]> {
  const sp = new URLSearchParams({ q, session });
  if (opts.types === "any") sp.set("types", "any");
  const res = await fetch(`/api/places/address?${sp}`, { signal: opts.signal });
  const body = (await res.json().catch(() => ({}))) as { results?: AddressHit[]; provider?: "google" | "none" };
  if (body.provider) provider = body.provider;
  return body.results ?? [];
}

export async function resolveAddress(id: string, session: string): Promise<AddressPick | null> {
  const res = await fetch(`/api/places/address?${new URLSearchParams({ id, session })}`).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { place?: AddressPick | null };
  return body.place ?? null;
}
