// Artist.citySlug: the URL key that groups artists by place (/scenes/<slug>, /art?city=<slug>, /artists?city=<slug>).
// New York State keeps the plain slug it always had ("brooklyn", "williamsburg-brooklyn"), so existing rows and links
// keep working. Every other state gets its code on the end ("portland-or", "portland-me"), so same-named cities
// in different states don't share a page. Write citySlug only through citySlugFor.
import slugify from "slugify";
import US_STATE_OPTIONS from "@/lib/constants/usa_states";

const SLUG = { lower: true, strict: true } as const;
const fold = (s: string) => s.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");

/** Two-letter code for a US state code or name ("tx", "Texas" → "TX"), or null. */
export function stateAbbr(state?: string | null): string | null {
  const v = fold(state ?? "");
  if (!v) return null;
  const hit = US_STATE_OPTIONS.find((s) => s.code.toLowerCase() === v || s.name.toLowerCase() === v);
  return hit ? hit.code : null;
}

/** "Austin, TX" or "Austin, Texas" typed in the city field → { city: "Austin", state: "TX" }. Otherwise state is null. */
export function splitCityState(city: string): { city: string; state: string | null } {
  const m = city.trim().match(/^(.*\S)\s*,\s*([^,]+)$/);
  const st = m ? stateAbbr(m[2]) : null;
  return st ? { city: m![1].trim(), state: st } : { city: city.trim(), state: null };
}

/** The city without a trailing ", <state>" when it repeats the artist's state. */
function bareCity(city: string, state: string | null): string {
  const s = splitCityState(city);
  return state && s.state === state ? s.city : city.trim();
}

/** The citySlug to store for a city and state. New York State (or no state, on older rows) keeps slugify(city). */
export function citySlugFor(city: string, state?: string | null): string {
  const raw = (state ?? "").trim();
  if (!raw) return slugify(city, SLUG);
  const st = stateAbbr(raw);
  if (st === "NY") return slugify(city, SLUG);
  return slugify(`${bareCity(city, st ?? raw)}-${st ?? raw}`, SLUG);
}

/** "Brooklyn, NY", "Austin, TX": the city with the state's code, for artist cards and pages. */
export function cityLabel(a: { city?: string | null; state?: string | null }): string {
  const st = stateAbbr(a.state) ?? (a.state?.trim() || null);
  return [a.city ? bareCity(a.city, st) : null, st].filter(Boolean).join(", ");
}

/** A place's name in lists and headings: NYC places as they always were ("Williamsburg"), elsewhere with the state ("Austin, TX"). */
export function placeName(a: { city?: string | null; state?: string | null }): string {
  const city = (a.city ?? "").trim();
  const st = stateAbbr(a.state) ?? (a.state?.trim() || null);
  if (!st || st === "NY") return city;
  return `${bareCity(city, st)}, ${st}`;
}
