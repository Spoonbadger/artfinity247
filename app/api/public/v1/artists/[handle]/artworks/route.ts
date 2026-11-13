// GET /api/public/v1/artists/:handle/artworks?limit=&cursor=&collection= — approved works, newest first.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_ARTWORK, apiError, artworkSelect, cleanHandle, cleanSlug, editionSales, handler, json, methodNotAllowed, notFound, parseLimit,
  preflight, serializeArtwork, siteBase, MAX_LIMIT,
} from "@/components/devtools/publicApi";

export const dynamic = "force-dynamic";

type Ctx = { params: { handle: string } };

export const GET = handler<Ctx>(async (req, { params }) => {
  const handle = cleanHandle(params.handle);
  if (!handle) return notFound("Artist");
  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp.get("limit"));
  if (limit == null) return apiError("bad_request", `limit must be a number from 1 to ${MAX_LIMIT}.`, 400);
  const cursor = sp.get("cursor");
  if (cursor && !/^[\w-]{1,64}$/.test(cursor)) return apiError("bad_request", "cursor is not valid.", 400);
  const collectionRaw = sp.get("collection");
  const collectionSlug = collectionRaw ? cleanSlug(collectionRaw) : null;
  if (collectionRaw && !collectionSlug) return apiError("bad_request", "collection is not valid.", 400);

  const artist = await prisma.artist.findFirst({ where: { slug: handle, closedAt: null, suspendedAt: null }, select: { id: true, slug: true } });
  if (!artist) return notFound("Artist");

  const where: Prisma.ArtworkWhereInput = { ...PUBLIC_ARTWORK, artistId: artist.id };
  if (collectionSlug) {
    const col = await prisma.collection.findUnique({ where: { artistId_slug: { artistId: artist.id, slug: collectionSlug } }, select: { id: true } });
    if (!col) return notFound("Collection");
    where.collectionItems = { some: { collectionId: col.id } };
  }

  let rows;
  try {
    rows = await prisma.artwork.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: artworkSelect,
    });
  } catch {
    return apiError("bad_request", "cursor is not valid.", 400);
  }
  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[page.length - 1].id : null;
  const sold = await editionSales(prisma, page);
  const base = siteBase(req);
  return json({
    artworks: page.map((a) => serializeArtwork(base, a, sold.get(a.id) ?? 0)),
    nextCursor: next,
  });
});

export const OPTIONS = preflight;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
