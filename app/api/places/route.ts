// GET /api/places?q=aus&kind=place|city|state|neighborhood|address|zip&limit=8&near=TX
// Location suggestions for LocationInput: US states, cities, towns and neighborhoods (lib/placeSearch.server.ts).
// kind=address finishes the part of a street address after the first comma ("Brookl" → "Brooklyn, NY");
// kind=zip turns a ZIP into its city and state. The data stays on the server; answers are small and cacheable.
import { NextRequest, NextResponse } from "next/server";
import { searchPlacesUS, type SearchKind } from "@/lib/placeSearch.server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set<SearchKind>(["place", "city", "state", "neighborhood", "address", "zip"]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").slice(0, 100);
  const kind = (KINDS.has(sp.get("kind") as SearchKind) ? sp.get("kind") : "place") as SearchKind;
  const limit = Number(sp.get("limit")) || 8;
  const near = sp.get("near");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`places:${ip}`, 600, 60_000)) return NextResponse.json({ results: [] }, { status: 429 });
  const results = await searchPlacesUS(q, kind, { limit, near });
  return NextResponse.json(
    { results },
    // The data only changes with a deploy.
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
