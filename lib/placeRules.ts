// Places: the plain rules, shared by the server and the Studio screens (no database here).
// A Place is open until the artist closes it ("This place closed / show ended") or its end date passes. Once it has
// ended, scans of its codes follow afterEnd. Every choice lands somewhere useful; none is an error page.

export const PLACE_KINDS = {
  cafe: "Café or bar",
  gallery: "Gallery",
  market: "Market stall",
  shop: "Shop",
  popup: "Pop-up or show",
  studio: "Studio",
  other: "Somewhere else",
} as const;
export type PlaceKind = keyof typeof PLACE_KINDS;
export const isPlaceKind = (v: unknown): v is PlaceKind => typeof v === "string" && v in PLACE_KINDS;

export const AFTER_END = {
  art: { label: "Open the painting as usual", sub: "Without the “You scanned this at” line." },
  page: { label: "Send scans to my artist page", sub: "Good when the painting has sold or gone home." },
  pause: { label: "Pause the codes", sub: "Scans open your page with a short note. Turn them back on any time." },
} as const;
export type AfterEnd = keyof typeof AFTER_END;
export const isAfterEnd = (v: unknown): v is AfterEnd => typeof v === "string" && v in AFTER_END;

const TZ = "America/New_York";
/** Today in New York, "YYYY-MM-DD". */
export function nyToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type PlaceLike = { active: boolean; endsOn: string | null; startsOn?: string | null; afterEnd?: string | null };

/** Closed by the artist, or past its last day. */
export function placeEnded(p: PlaceLike, now = new Date()) {
  return !p.active || (!!p.endsOn && p.endsOn < nyToday(now));
}

/** What a scan of a code at this place does: "open" (as usual, with the venue line) or the after-end choice. */
export function scanRoute(p: PlaceLike | null | undefined, now = new Date()): "open" | AfterEnd {
  if (!p || !placeEnded(p, now)) return "open";
  return isAfterEnd(p.afterEnd) ? p.afterEnd : "art";
}

const day = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const dayLabel = day;

/** "Open", "Closed", "Ended Nov 7", "Starts Nov 19" for the lists. */
export function placeStatus(p: PlaceLike, now = new Date()): { text: string; on: boolean } {
  if (!p.active) return { text: "Closed", on: false };
  const today = nyToday(now);
  if (p.endsOn && p.endsOn < today) return { text: `Ended ${day(p.endsOn)}`, on: false };
  if (p.startsOn && p.startsOn > today) return { text: `Starts ${day(p.startsOn)}`, on: true };
  return { text: "Open", on: true };
}

/** "Nov 19 – Dec 24", "Nov 7", or "" */
export function placeDates(p: { startsOn: string | null; endsOn: string | null }) {
  if (p.startsOn && p.endsOn) return p.startsOn === p.endsOn ? day(p.startsOn) : `${day(p.startsOn)} – ${day(p.endsOn)}`;
  if (p.startsOn) return `From ${day(p.startsOn)}`;
  if (p.endsOn) return `Until ${day(p.endsOn)}`;
  return "";
}

/** How a picker or a request names a Place: an existing one, a partner venue (made into a Place), a new name, or none. */
export type PlaceInput = { id: string } | { venueId: string } | { name: string } | null;
