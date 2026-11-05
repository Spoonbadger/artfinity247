// GET /api/public/v1/artists/:handle/collections — the artist's collections with approved-work counts.
import { prisma } from "@/lib/prisma";
import {
  PUBLIC_ARTWORK, absUrl, cleanHandle, handler, json, methodNotAllowed, notFound, preflight, siteBase,
} from "@/components/devtools/publicApi";

export const dynamic = "force-dynamic";

type Ctx = { params: { handle: string } };

export const GET = handler<Ctx>(async (req, { params }) => {
  const handle = cleanHandle(params.handle);
  if (!handle) return notFound("Artist");
  const artist = await prisma.artist.findFirst({
    where: { slug: handle, closedAt: null },
    select: {
      slug: true,
      collections: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          slug: true, title: true, description: true, coverArtworkId: true,
          items: {
            where: { artwork: PUBLIC_ARTWORK },
            orderBy: { position: "asc" },
            select: { artwork: { select: { id: true, imageUrl: true, title: true, sensitive: true } } },
          },
        },
      },
    },
  });
  if (!artist) return notFound("Artist");
  const base = siteBase(req);
  const collections = artist.collections
    .filter((c) => c.items.length > 0)
    .map((c) => {
      const cover = c.items.find((i) => i.artwork.id === c.coverArtworkId)?.artwork ?? c.items[0].artwork;
      return {
        slug: c.slug,
        title: c.title,
        description: c.description || "",
        artworkCount: c.items.length,
        cover: { url: absUrl(base, cover.imageUrl), alt: cover.title, sensitive: cover.sensitive },
        artworks: `${base}/api/public/v1/artists/${artist.slug}/artworks?collection=${encodeURIComponent(c.slug)}`,
      };
    });
  return json({ collections });
});

export const OPTIONS = preflight;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
