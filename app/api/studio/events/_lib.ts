// Shared bits for /api/studio/events: who is asking, and checking an event's fields.
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";

export const MAX_EVENTS = 200;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const eventSelect = { id: true, name: true, venue: true, start: true, end: true, createdAt: true } as const;

/** The signed-in, open artist account, or null. */
export async function currentArtistId() {
  const user = await getUserFromCookie();
  if (!user?.id) return null;
  const a = await prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, closedAt: true } });
  return a && !a.closedAt ? a.id : null;
}

function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2100 && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export type EventInput = { name: string; venue: string; start: string; end: string };

/** Checks a full event (partial = only the fields given, for PATCH). Returns an error message or the clean fields. */
export function cleanEvent(raw: any, base?: EventInput): { error: string } | { data: EventInput } {
  const src = { ...(base || {}), ...(raw && typeof raw === "object" ? raw : {}) };
  const name = typeof src.name === "string" ? src.name.trim().slice(0, 80) : "";
  const venue = typeof src.venue === "string" ? src.venue.trim().slice(0, 80) : "";
  if (!name) return { error: "Name the event." };
  if (!validDate(src.start)) return { error: "Pick a start date." };
  const end = src.end === undefined || src.end === null || src.end === "" ? src.start : src.end;
  if (!validDate(end)) return { error: "That end date looks off." };
  if (end < src.start) return { error: "End date is before the start." };
  return { data: { name, venue, start: src.start, end } };
}
