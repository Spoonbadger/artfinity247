// GET /api/public/v1 — what's here: every endpoint, as URL templates. Handy for exploring with curl.
import { API_VERSION, PUBLIC_RATE_LIMIT, handler, json, methodNotAllowed, preflight, siteBase } from "@/components/devtools/publicApi";

export const dynamic = "force-dynamic";

export const GET = handler<unknown>(async (req) => {
  const base = siteBase(req);
  const api = `${base}/api/public/${API_VERSION}`;
  return json({
    version: API_VERSION,
    docs: `${base}/developers`,
    rateLimit: { requests: PUBLIC_RATE_LIMIT, per: "minute" },
    endpoints: {
      artworks: `${api}/artworks{?q,artist,city,edition,sensitive,sort,limit,cursor}`,
      artwork: `${api}/artworks/{slug}`,
      artist: `${api}/artists/{handle}`,
      artistArtworks: `${api}/artists/{handle}/artworks{?limit,cursor,collection}`,
      artistCollections: `${api}/artists/{handle}/collections`,
      collection: `${api}/artists/{handle}/collections/{slug}{?limit,cursor}`,
      artistEvents: `${api}/artists/{handle}/events`,
      oembed: `${base}/api/embed{?url,maxwidth,maxheight}`,
    },
  });
});

export const OPTIONS = preflight;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
