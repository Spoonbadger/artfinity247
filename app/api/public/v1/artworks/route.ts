// GET /api/public/v1/artworks?q=&artist=&city=&edition=&sensitive=&sort=&limit=&cursor= — approved work from every
// open artist, newest first. Search matches the title, the description and the artist's public name (never the
// legal name). Keyset pagination: pass nextCursor back as cursor.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { afterCursor, pageOf } from "@/lib/apiCursor";
import { parseArtworkSearch } from "@/lib/artworkSearch";
import {
  PUBLIC_ARTWORK, apiError, artworkSelect, editionSales, handler, json, methodNotAllowed, preflight, serializeArtwork, siteBase,
} from "@/components/devtools/publicApi";

export const dynamic = "force-dynamic";

const MAX_WORDS = 6;

function wordMatch(word: string): Prisma.ArtworkWhereInput {
  const has = { contains: word, mode: "insensitive" } as const;
  return {
    OR: [
      { title: has },
      { description: has },
      { artist: { artist_name: has } },
      // `name` is the public name only when no artist name is set (the same rule as the page and the API).
      { artist: { name: has, OR: [{ artist_name: null }, { artist_name: "" }] } },
    ],
  };
}

export const GET = handler<unknown>(async (req) => {
  const parsed = parseArtworkSearch(req.nextUrl.searchParams);
  if (!parsed.ok) return apiError("bad_request", parsed.error, 400);
  const s = parsed.value;
  const dir = s.sort === "oldest" ? "asc" : "desc";

  const and: Prisma.ArtworkWhereInput[] = [PUBLIC_ARTWORK];
  if (s.q) for (const w of s.q.split(" ").slice(0, MAX_WORDS)) and.push(wordMatch(w));
  if (s.artist) and.push({ artist: { slug: s.artist } });
  if (s.city) and.push({ artist: { citySlug: s.city } });
  if (s.edition === "limited") and.push({ editionSize: { not: null } });
  if (s.edition === "open") and.push({ editionSize: null });
  if (s.sensitive === "exclude") and.push({ sensitive: { isEmpty: true } });
  if (s.cursor) and.push(afterCursor("createdAt", s.cursor, dir, (k) => new Date(k)) as Prisma.ArtworkWhereInput);

  const rows = await prisma.artwork.findMany({
    where: { AND: and },
    orderBy: [{ createdAt: dir }, { id: dir }],
    take: s.limit + 1,
    select: artworkSelect,
  });
  const { page, nextCursor } = pageOf(rows, s.limit, (r) => ({ k: r.createdAt.getTime(), id: r.id }));
  const sold = await editionSales(prisma, page);
  const base = siteBase(req);
  return json({ artworks: page.map((a) => serializeArtwork(base, a, sold.get(a.id) ?? 0)), nextCursor });
});

export const OPTIONS = preflight;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
