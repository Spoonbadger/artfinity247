// GET /api/public/v1/artists/:handle/collections/:slug?limit=&cursor= — one collection and its approved pieces, in the
// artist's order. A collection with no public pieces is not found (it's hidden on the artist page too).
import { prisma } from "@/lib/prisma";
import { afterCursor, decodeCursor, pageOf } from "@/lib/apiCursor";
import { collectionUrl, artistUrl } from "@/lib/urls";
import {
  MAX_LIMIT, OPEN_ARTIST, PUBLIC_ARTWORK, absUrl, apiError, artworkSelect, cleanHandle, cleanSlug, displayName, editionSales, handler, json,
  methodNotAllowed, notFound, parseLimit, preflight, serializeArtwork, siteBase,
} from "@/components/devtools/publicApi";

export const dynamic = "force-dynamic";

type Ctx = { params: { handle: string; slug: string } };

export const GET = handler<Ctx>(async (req, { params }) => {
  const handle = cleanHandle(params.handle);
  if (!handle) return notFound("Artist");
  const slug = cleanSlug(params.slug);
  if (!slug) return notFound("Collection");
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp.get("limit"));
  if (limit == null) return apiError("bad_request", `limit must be a number from 1 to ${MAX_LIMIT}.`, 400);
  const cursorRaw = sp.get("cursor");
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) return apiError("bad_request", "cursor is not valid.", 400);

  const artist = await prisma.artist.findFirst({ where: { slug: handle, ...OPEN_ARTIST }, select: { id: true, slug: true, name: true, artist_name: true } });
  if (!artist) return notFound("Artist");
  const col = await prisma.collection.findUnique({
    where: { artistId_slug: { artistId: artist.id, slug } },
    select: { id: true, slug: true, title: true, description: true, coverArtworkId: true },
  });
  if (!col) return notFound("Collection");

  const itemWhere = { collectionId: col.id, artwork: PUBLIC_ARTWORK };
  const coverSelect = { artwork: { select: { id: true, imageUrl: true, title: true, sensitive: true } } } as const;
  const [rows, total, chosenCover, firstItem] = await Promise.all([
    prisma.collectionItem.findMany({
      where: cursor ? { AND: [itemWhere, afterCursor("position", cursor, "asc", (k) => k)] } : itemWhere,
      orderBy: [{ position: "asc" }, { id: "asc" }],
      take: limit + 1,
      select: { id: true, position: true, artwork: { select: artworkSelect } },
    }),
    prisma.collectionItem.count({ where: itemWhere }),
    col.coverArtworkId ? prisma.collectionItem.findFirst({ where: { ...itemWhere, artworkId: col.coverArtworkId }, select: coverSelect }) : null,
    prisma.collectionItem.findFirst({ where: itemWhere, orderBy: [{ position: "asc" }, { id: "asc" }], select: coverSelect }),
  ]);
  if (!total) return notFound("Collection");

  const { page, nextCursor } = pageOf(rows, limit, (r) => ({ k: r.position, id: r.id }));
  const works = page.map((r) => r.artwork);
  const sold = await editionSales(prisma, works);
  const base = siteBase(req);
  const cover = (chosenCover ?? firstItem)!.artwork;
  return json({
    collection: {
      slug: col.slug,
      title: col.title,
      description: col.description || "",
      url: collectionUrl(artist.slug, col.slug, base),
      artworkCount: total,
      cover: { url: absUrl(base, cover.imageUrl), alt: cover.title, sensitive: cover.sensitive },
      artist: { handle: artist.slug, name: displayName(artist), url: artistUrl(artist.slug, base) },
    },
    artworks: works.map((a) => serializeArtwork(base, a, sold.get(a.id) ?? 0)),
    nextCursor,
  });
});

export const OPTIONS = preflight;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
