// The hand-made NYC list (the five boroughs and their neighborhoods), US states, and small helpers. Pure data, no network.
// Nationwide suggestions (every US city, town and neighborhood we know, and ZIPs) come from GET /api/places
// (lib/placeSearch.server.ts, data/us-places.json). scripts/build-us-places.mjs reads the NYC list from here, so
// this file must stay import-free.
//
// How artist locations are stored: Artist.city is free text and Artist.state the state. In NYC, picking a borough
// stores just the borough ("Brooklyn") and a neighborhood stores "Neighborhood, Borough", so existing rows keep
// matching. Elsewhere the field holds "City, ST" or "Neighborhood, City, ST" (lib/citySlug.ts splits it).

export const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"] as const;
export type Borough = (typeof BOROUGHS)[number];

const N: Record<Borough, string> = {
  Manhattan:
    "Alphabet City|Battery Park City|Carnegie Hill|Chelsea|Chinatown|Civic Center|East Harlem|East Village|Financial District|Flatiron|Gramercy Park|Greenwich Village|Hamilton Heights|Harlem|Hell's Kitchen|Hudson Square|Hudson Yards|Inwood|Kips Bay|Koreatown|Lenox Hill|Lincoln Square|Little Italy|Lower East Side|Manhattan Valley|Manhattanville|Meatpacking District|Midtown|Midtown East|Morningside Heights|Murray Hill|NoHo|NoLita|NoMad|Roosevelt Island|SoHo|Stuyvesant Town|Sutton Place|Tribeca|Two Bridges|Turtle Bay|Union Square|Upper East Side|Upper West Side|Washington Heights|West Village|Yorkville|Marble Hill|Central Harlem|Sugar Hill",
  Brooklyn:
    "Bath Beach|Bay Ridge|Bed-Stuy|Bensonhurst|Bergen Beach|Boerum Hill|Borough Park|Brighton Beach|Brooklyn Heights|Brownsville|Bushwick|Canarsie|Carroll Gardens|Clinton Hill|Cobble Hill|Columbia Waterfront|Coney Island|Crown Heights|Cypress Hills|Ditmas Park|Downtown Brooklyn|DUMBO|Dyker Heights|East Flatbush|East New York|East Williamsburg|Flatbush|Flatlands|Fort Greene|Fort Hamilton|Gerritsen Beach|Gowanus|Gravesend|Greenpoint|Greenwood Heights|Kensington|Manhattan Beach|Marine Park|Midwood|Mill Basin|Navy Yard|Ocean Hill|Park Slope|Prospect Heights|Prospect Lefferts Gardens|Prospect Park South|Red Hook|Sea Gate|Sheepshead Bay|South Slope|Sunset Park|Vinegar Hill|Weeksville|Williamsburg|Windsor Terrace|Wingate",
  Queens:
    "Astoria|Auburndale|Bayside|Bellerose|Breezy Point|Briarwood|Cambria Heights|College Point|Corona|Ditmars|Douglaston|East Elmhurst|Elmhurst|Far Rockaway|Flushing|Forest Hills|Fresh Meadows|Glen Oaks|Glendale|Hollis|Howard Beach|Jackson Heights|Jamaica|Jamaica Estates|Kew Gardens|Kew Gardens Hills|Laurelton|Little Neck|Long Island City|Maspeth|Middle Village|Murray Hill (Queens)|Ozone Park|Queens Village|Rego Park|Richmond Hill|Ridgewood|Rockaway Beach|Rockaway Park|Rosedale|South Ozone Park|Springfield Gardens|St. Albans|Sunnyside|Whitestone|Woodhaven|Woodside|Hunters Point|Dutch Kills|Arverne",
  Bronx:
    "Bedford Park|Belmont|Castle Hill|City Island|Co-op City|Concourse|Country Club|Eastchester|Fordham|Highbridge|Hunts Point|Kingsbridge|Longwood|Melrose|Morris Heights|Morris Park|Morrisania|Mott Haven|Norwood|Parkchester|Pelham Bay|Pelham Gardens|Port Morris|Riverdale|Soundview|Spuyten Duyvil|Throgs Neck|Tremont|University Heights|Van Nest|Wakefield|Westchester Square|Williamsbridge|Woodlawn",
  "Staten Island":
    "Annadale|Arden Heights|Bulls Head|Castleton Corners|Clifton|Dongan Hills|Eltingville|Graniteville|Grant City|Great Kills|Grymes Hill|Huguenot|Mariners Harbor|Midland Beach|New Brighton|New Dorp|New Springville|Oakwood|Port Richmond|Princes Bay|Rosebank|St. George|Silver Lake|South Beach|Stapleton|Todt Hill|Tompkinsville|Tottenville|West Brighton|Westerleigh",
};

/** Other names people type for the same place. */
const ALIASES: Record<string, string[]> = {
  "Bed-Stuy": ["Bedford-Stuyvesant", "Bedford Stuyvesant"],
  DUMBO: ["Dumbo"],
  "Financial District": ["FiDi"],
  "Hell's Kitchen": ["Clinton", "Hells Kitchen"],
  "Long Island City": ["LIC"],
  "Lower East Side": ["LES"],
  "Upper East Side": ["UES"],
  "Upper West Side": ["UWS"],
  "Prospect Lefferts Gardens": ["PLG"],
  NoLita: ["Nolita"],
  SoHo: ["Soho"],
  NoHo: ["Noho"],
  Tribeca: ["TriBeCa"],
  Bronx: ["The Bronx"],
  Manhattan: ["New York", "New York City", "NYC"],
  "Staten Island": ["SI"],
};

export const US_STATES: [code: string, name: string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"],
  ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"], ["PR", "Puerto Rico"],
];

export type Place = {
  /** What goes in the field when picked, e.g. "Williamsburg, Brooklyn" or "Austin, TX". */
  value: string;
  /** The main line in the list. */
  primary: string;
  /** The grey second line, e.g. "Brooklyn" or "Texas". */
  secondary?: string;
  kind: "borough" | "neighborhood" | "state" | "city";
  /** For NYC places: the neighborhood and borough; for cities: the city name. */
  city: string;
  borough?: Borough;
  /** Two-letter state code. */
  state: string;
  aliases?: string[];
};

let cache: { nyc: Place[]; us: Place[] } | null = null;

/** Every NYC borough and neighborhood (for scripts/build-us-places.mjs). */
export function nycPlaces(): Place[] {
  return build().nyc;
}

function build() {
  if (cache) return cache;
  const nyc: Place[] = BOROUGHS.map((b) => ({ value: b, primary: b, secondary: "New York City", kind: "borough", city: b, borough: b, state: "NY", aliases: ALIASES[b] }));
  for (const b of BOROUGHS) {
    for (const raw of N[b].split("|")) {
      const name = raw.replace(/ \(Queens\)$/, "");
      nyc.push({ value: `${name}, ${b}`, primary: name, secondary: b, kind: "neighborhood", city: name, borough: b, state: "NY", aliases: ALIASES[name] });
    }
  }
  const us: Place[] = [];
  for (const [code, name] of US_STATES) us.push({ value: name, primary: name, secondary: code, kind: "state", city: "", state: code, aliases: [code] });
  cache = { nyc, us };
  return cache;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** 0 = exact, 1 = starts with, 2 = a word starts with, 3 = contains, -1 = no match. */
function rank(name: string, q: string) {
  const n = fold(name);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(" ").some((w) => w.startsWith(q)) || n.includes(" " + q)) return 2;
  if (q.length >= 3 && n.includes(q)) return 3;
  return -1;
}

export type PlaceScope = "nyc" | "state";

/** Local suggestions: "nyc" = boroughs and neighborhoods (the header search), "state" = US states. */
export function searchPlaces(query: string, scope: PlaceScope = "nyc", limit = 8): Place[] {
  const { nyc, us } = build();
  const q = fold(query.split(",")[0] ?? "");
  if (!q) return [];
  const pool = scope === "nyc" ? nyc : us;
  const scored: { p: Place; s: number }[] = [];
  for (const p of pool) {
    let best = rank(p.primary, q);
    for (const a of p.aliases ?? []) {
      const r = rank(a, q);
      if (r >= 0 && (best < 0 || r < best)) best = r;
    }
    if (best < 0) continue;
    // Boroughs, then neighborhoods; list order within each.
    const tier = p.kind === "borough" ? 0 : p.kind === "neighborhood" ? 1 : 2;
    scored.push({ p, s: best * 10 + tier });
  }
  scored.sort((a, b) => a.s - b.s);
  return scored.slice(0, limit).map((x) => x.p);
}

/** Find the NYC place a stored value refers to ("Williamsburg, Brooklyn", "Brooklyn", "williamsburg"). */
export function findNycPlace(value: string): Place | null {
  const v = fold(value);
  if (!v) return null;
  const { nyc } = build();
  return nyc.find((p) => fold(p.value) === v || fold(p.primary) === v || (p.aliases ?? []).some((a) => fold(a) === v)) ?? null;
}

/** "11211" → true. Accepts ZIP+4. */
export const isZip = (s: string) => /^\d{5}(-\d{4})?$/.test(s.trim());

/** Two-letter code for a state name or code ("new york" → "NY"), or null. */
export function stateCode(s: string): string | null {
  const v = s.trim().toLowerCase();
  if (!v) return null;
  const hit = US_STATES.find(([c, n]) => c.toLowerCase() === v || n.toLowerCase() === v);
  return hit ? hit[0] : null;
}

/** The city a mail carrier wants for a place: Manhattan is "New York", Queens neighborhoods keep their own name. */
export function postalCity(p: { kind: string; city: string; borough?: string }): string {
  if (!p.borough) return p.city;
  if (p.borough === "Manhattan") return "New York";
  if (p.borough === "Queens" && p.kind === "neighborhood") return p.city;
  return p.borough;
}
