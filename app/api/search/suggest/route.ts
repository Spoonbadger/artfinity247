// GET /api/search/suggest?q=wil  Typeahead for the header and /search: a few artists, paintings and neighborhoods.
// Reuses the /search page's queries (components/browse/data.ts), so suggestions match what the results page shows.
import { NextRequest, NextResponse } from "next/server";
import { getArt, getArtists, getCities } from "@/components/browse/data";
import { searchPlaces } from "@/lib/places";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let citiesCache: { at: number; rows: Awaited<ReturnType<typeof getCities>> } | null = null;
async function cities() {
  if (citiesCache && Date.now() - citiesCache.at < 60_000) return citiesCache.rows;
  const rows = await getCities();
  citiesCache = { at: Date.now(), rows };
  return rows;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ artists: [], art: [], places: [] });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`suggest:${ip}`, 120, 60_000)) return NextResponse.json({ artists: [], art: [], places: [] }, { status: 429 });
  try {
    const [artists, { art }, scenes] = await Promise.all([getArtists({ q, take: 4, pieces: 0 }), getArt({ q, perPage: 5 }), cities()]);
    const ql = q.toLowerCase();
    // Neighborhoods with art first (they link to their scene), then NYC places to search by.
    const withArt = scenes.filter((c) => c.name.toLowerCase().includes(ql)).slice(0, 3).map((c) => ({ label: c.name, sub: `${c.pieces} ${c.pieces === 1 ? "piece" : "pieces"}`, href: `/scenes/${c.slug}` }));
    const more = searchPlaces(q, "nyc", 4)
      .filter((p) => !withArt.some((w) => w.label.toLowerCase() === p.primary.toLowerCase()))
      .slice(0, Math.max(0, 3 - withArt.length))
      .map((p) => ({ label: p.primary, sub: p.kind === "borough" ? "Borough" : p.borough, href: `/search?q=${encodeURIComponent(p.primary)}` }));
    return NextResponse.json(
      {
        artists: artists.map((a) => ({ slug: a.slug, name: a.name, city: a.city, avatar: a.avatar })),
        art: art.map((a) => ({ slug: a.slug, title: a.title, artist: a.artist.name, handle: a.artist.slug, imageUrl: a.imageUrl, sensitive: a.sensitive.length > 0 })),
        places: [...withArt, ...more],
      },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (e) {
    console.error("search suggest", e);
    return NextResponse.json({ artists: [], art: [], places: [] }, { status: 500 });
  }
}

