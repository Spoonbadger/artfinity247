// GET /api/places/address?q=214+bedford&session=…[&types=any]   street address suggestions (US only)
// GET /api/places/address?id=<placeId>&session=…                  the picked address, split into line1, city, state, ZIP
//
// A thin proxy to Google Places API (New) with a server-side key, so the browser loads no Google script and never
// sees the key. `session` is the autocomplete session token from the browser: every keystroke and the final pick share
// it, so Google bills one session instead of every request. Without a key the answer is { results: [], provider: "none" }
// and LocationInput finishes the city, state and ZIP from GET /api/places?kind=address instead.
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TODO(thomas): add GOOGLE_MAPS_API_KEY (Places API New) for full US address autocomplete
const KEY = () => process.env.GOOGLE_MAPS_API_KEY?.trim() || "";

const SESSION = /^[A-Za-z0-9_-]{8,64}$/;
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const NO_STORE = { "Cache-Control": "private, no-store" };

type Component = { longText?: string; shortText?: string; types?: string[] };

export type AddressPick = { value: string; kind: "address"; line1: string; city: string; state: string; zip: string; neighborhood?: string; borough?: string };

function fromComponents(parts: Component[], formatted?: string): AddressPick {
  const get = (t: string, short = false) => {
    const c = parts.find((x) => x.types?.includes(t));
    return (short ? c?.shortText : c?.longText) ?? "";
  };
  const line1 = [get("street_number"), get("route", true)].filter(Boolean).join(" ");
  const borough = get("sublocality_level_1") || undefined;
  const city = get("locality") || borough || get("sublocality") || get("neighborhood") || get("postal_town");
  const state = get("administrative_area_level_1", true);
  const zip = get("postal_code");
  const value = formatted ? formatted.replace(/, USA$/, "") : [line1, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return { value, kind: "address", line1, city, state, zip, neighborhood: get("neighborhood") || undefined, borough };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const key = KEY();
  const id = sp.get("id");
  if (!key) return NextResponse.json(id ? { place: null, provider: "none" } : { results: [], provider: "none" }, { headers: { "Cache-Control": "private, max-age=300" } });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`address:${ip}`, process.env.NODE_ENV === "production" ? 90 : 600, 60_000)) {
    return NextResponse.json({ results: [], place: null, provider: "google" }, { status: 429, headers: NO_STORE });
  }
  const session = SESSION.test(sp.get("session") || "") ? sp.get("session")! : undefined;

  try {
    if (id) {
      if (!PLACE_ID.test(id)) return NextResponse.json({ place: null, provider: "google" }, { status: 400, headers: NO_STORE });
      const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`);
      url.searchParams.set("languageCode", "en");
      url.searchParams.set("regionCode", "us");
      if (session) url.searchParams.set("sessionToken", session);
      const res = await fetch(url, { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "addressComponents,formattedAddress" }, signal: AbortSignal.timeout(5000), cache: "no-store" });
      if (!res.ok) throw new Error(`Places details ${res.status}`);
      const d = (await res.json()) as { addressComponents?: Component[]; formattedAddress?: string };
      return NextResponse.json({ place: fromComponents(d.addressComponents ?? [], d.formattedAddress), provider: "google" }, { headers: NO_STORE });
    }

    const q = (sp.get("q") || "").trim().slice(0, 160);
    if (q.length < 3) return NextResponse.json({ results: [], provider: "google" }, { headers: NO_STORE });
    const body: Record<string, unknown> = { input: q, includedRegionCodes: ["us"], regionCode: "us", languageCode: "en", ...(session ? { sessionToken: session } : {}) };
    // Street addresses by default; types=any also offers businesses and venues by name.
    if (sp.get("types") !== "any") body.includedPrimaryTypes = ["street_address", "premise", "subpremise", "route"];
    const ask = () =>
      fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      });
    let res = await ask();
    // If Google ever rejects the type filter, ask again without it rather than show nothing.
    if (res.status === 400 && body.includedPrimaryTypes) {
      delete body.includedPrimaryTypes;
      res = await ask();
    }
    if (!res.ok) throw new Error(`Places autocomplete ${res.status}`);
    const d = (await res.json()) as { suggestions?: { placePrediction?: { placeId: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }[] };
    const results = (d.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .slice(0, 6)
      .map((p) => {
        const full = (p.text?.text ?? "").replace(/, USA$/, "");
        return { id: p.placeId, value: full, primary: p.structuredFormat?.mainText?.text ?? full, secondary: (p.structuredFormat?.secondaryText?.text ?? "").replace(/, USA$/, "") };
      });
    return NextResponse.json({ results, provider: "google" }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (e) {
    console.error("places address", e);
    // The input falls back to finishing the city, state and ZIP locally.
    return NextResponse.json(id ? { place: null, provider: "google" } : { results: [], provider: "google" }, { status: 502, headers: NO_STORE });
  }
}
