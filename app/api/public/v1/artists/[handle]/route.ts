// GET /api/public/v1/artists/:handle — public artist profile.
import { prisma } from "@/lib/prisma";
import { getArtistTrust } from "@/lib/artistTrust";
import {
  artistSelect, cleanHandle, handler, json, methodNotAllowed, notFound, preflight, serializeArtist, siteBase,
} from "@/components/devtools/publicApi";

export const dynamic = "force-dynamic";

type Ctx = { params: { handle: string } };

export const GET = handler<Ctx>(async (req, { params }) => {
  const handle = cleanHandle(params.handle);
  if (!handle) return notFound("Artist");
  const a = await prisma.artist.findUnique({ where: { slug: handle }, select: artistSelect });
  if (!a) return notFound("Artist");
  const trust = await getArtistTrust(a.id);
  return json({ artist: serializeArtist(siteBase(req), a, trust) });
});

export const OPTIONS = preflight;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
