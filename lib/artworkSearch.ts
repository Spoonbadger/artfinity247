// Query parsing for GET /api/public/v1/artworks (search and listing across every artist). Pure.
import { decodeCursor, type Cursor } from "./apiCursor";

export const SEARCH_MAX_LIMIT = 50;
export const SEARCH_DEFAULT_LIMIT = 12;

export type ArtworkSearch = {
  /** Words to find in the title, description or the artist's public name. */
  q: string | null;
  artist: string | null;
  /** Artist.citySlug, as in /art?city=… ("brooklyn", "austin-tx"). */
  city: string | null;
  edition: "limited" | "open" | null;
  /** exclude drops pieces with a sensitive label; include (default) keeps them, labelled, for the client to blur. */
  sensitive: "include" | "exclude";
  sort: "newest" | "oldest";
  limit: number;
  cursor: Cursor | null;
};

export type Parsed = { ok: true; value: ArtworkSearch } | { ok: false; error: string };

type Source = URLSearchParams | Record<string, string | undefined>;
const get = (q: Source, k: string) => ((q instanceof URLSearchParams ? q.get(k) : q[k]) ?? "").trim();

export function parseArtworkSearch(q: Source): Parsed {
  const qRaw = get(q, "q").replace(/\s+/g, " ");
  if (qRaw.length > 100) return { ok: false, error: "q must be 100 characters or fewer." };

  const artistRaw = get(q, "artist").replace(/^@/, "");
  if (artistRaw && !/^[\w.-]{1,64}$/.test(artistRaw)) return { ok: false, error: "artist is not a valid handle." };

  const city = get(q, "city").toLowerCase();
  if (city && !/^[a-z0-9-]{1,80}$/.test(city)) return { ok: false, error: "city is not valid. Use a city slug like brooklyn or austin-tx." };

  const edition = get(q, "edition").toLowerCase();
  if (edition && edition !== "limited" && edition !== "open") return { ok: false, error: "edition must be limited or open." };

  const sensitive = get(q, "sensitive").toLowerCase() || "include";
  if (sensitive !== "include" && sensitive !== "exclude") return { ok: false, error: "sensitive must be include or exclude." };

  const sort = get(q, "sort").toLowerCase() || "newest";
  if (sort !== "newest" && sort !== "oldest") return { ok: false, error: "sort must be newest or oldest." };

  const limitRaw = get(q, "limit");
  let limit = SEARCH_DEFAULT_LIMIT;
  if (limitRaw) {
    const n = Math.floor(Number(limitRaw));
    if (!Number.isFinite(n) || n < 1) return { ok: false, error: `limit must be a number from 1 to ${SEARCH_MAX_LIMIT}.` };
    limit = Math.min(n, SEARCH_MAX_LIMIT);
  }

  const cursorRaw = get(q, "cursor");
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) return { ok: false, error: "cursor is not valid." };

  return {
    ok: true,
    value: {
      q: qRaw || null,
      artist: artistRaw || null,
      city: city || null,
      edition: (edition || null) as ArtworkSearch["edition"],
      sensitive,
      sort,
      limit,
      cursor,
    },
  };
}
