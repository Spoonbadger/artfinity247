// GET /api/public/v1/artists/:handle/events — the artist's current and upcoming shows, soonest first.
// The same list as "See it in person" on the artist page: name, venue and dates the artist typed in Studio.
// Linked places' addresses, venue contacts and revenue shares are never included.
import { prisma } from "@/lib/prisma";
import { OPEN_ARTIST, cleanHandle, handler, json, methodNotAllowed, notFound, preflight } from "@/components/devtools/publicApi";

export const dynamic = "force-dynamic";

const MAX_EVENTS = 20;
/** Event days are calendar days in New York, like the artist page. */
const today = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

type Ctx = { params: { handle: string } };

export const GET = handler<Ctx>(async (_req, { params }) => {
  const handle = cleanHandle(params.handle);
  if (!handle) return notFound("Artist");
  const artist = await prisma.artist.findFirst({ where: { slug: handle, ...OPEN_ARTIST }, select: { id: true } });
  if (!artist) return notFound("Artist");
  const day = today();
  const rows = await prisma.studioEvent.findMany({
    where: { artistId: artist.id, end: { gte: day } },
    orderBy: [{ start: "asc" }, { createdAt: "asc" }],
    take: MAX_EVENTS,
    select: { name: true, venue: true, start: true, end: true },
  });
  return json({
    events: rows.map((e) => ({ name: e.name, venue: e.venue || null, start: e.start, end: e.end, onNow: e.start <= day })),
  });
});

export const OPTIONS = preflight;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
