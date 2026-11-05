// GET /api/public/v1/artworks/:slug — one approved artwork with sizes, prices, edition info and buyer rating.
import { prisma } from "@/lib/prisma";
import { getReviewSummary } from "@/lib/reviews";
import {
  PUBLIC_ARTWORK, artworkSelect, cleanSlug, editionSales, handler, json, methodNotAllowed, notFound, preflight, serializeArtwork, siteBase, sizesFor,
} from "@/components/devtools/publicApi";

export const dynamic = "force-dynamic";

type Ctx = { params: { slug: string } };

export const GET = handler<Ctx>(async (req, { params }) => {
  const slug = cleanSlug(params.slug);
  if (!slug) return notFound("Artwork");
  const a = await prisma.artwork.findFirst({
    where: { ...PUBLIC_ARTWORK, slug },
    select: { ...artworkSelect, description: true },
  });
  if (!a) return notFound("Artwork");
  const [sold, reviews] = await Promise.all([editionSales(prisma, [a]), getReviewSummary({ artworkId: a.id })]);
  const base = siteBase(req);
  return json({
    artwork: {
      ...serializeArtwork(base, a, sold.get(a.id) ?? 0),
      rating: reviews.count ? reviews.average : null,
      reviewCount: reviews.count,
      description: a.description || "",
      sizes: sizesFor(a),
      buyUrl: `${base}/art/${a.slug}`,
    },
  });
});

export const OPTIONS = preflight;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
