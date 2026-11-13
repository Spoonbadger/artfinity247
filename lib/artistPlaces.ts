// Places (/studio/places): where an artist's work hangs, and everything that belongs to one. Server only.
// (lib/places.ts is the unrelated NYC neighborhood list for location fields.)
//
//   Place     artist-owned: name, kind, area, optional dates, open/closed, what scans do once it ends (lib/placeRules.ts)
//   Codes     QrCode.placeId. QrCode.venue / venueId mirror the Place's name and partner Venue, so the buyer's
//             "You scanned this at …" line, checkout and venue revenue share (lib/venues.ts) keep reading the code.
//             Every change to a Place's name or partner venue is copied onto its codes (syncPlaceCodes).
//   Paintings Hanging rows: one open row per painting; moving it ends that row and opens another (history with dates).
//   Print jobs PrintQueueItem.placeId: "Mark as printed" tags the printed codes to the Place.
//   Events    StudioEvent.placeId: found or made by the event's name when it's saved.
import { prisma } from "@/lib/prisma";
import { createQrCode, isLive } from "@/lib/shortlinks";
import { addToQueue, lastLook } from "@/lib/printQueue";
import { sanitizeDesign } from "@/components/qr/card";
import { itemBreakdown } from "@/lib/sales";
import { activeRefunds } from "@/lib/refunds";
import { isAfterEnd, isPlaceKind, nyToday, placeEnded, type PlaceInput, type PlaceKind } from "@/lib/placeRules";

const DAY = 86400000;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || null : null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const key = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

export const MAX_PLACES = 200;

export type PlaceFields = { name?: string; kind?: PlaceKind; area?: string | null; venueId?: string | null; startsOn?: string | null; endsOn?: string | null; active?: boolean; afterEnd?: string };

/** Checks a Place's fields (only those present). Returns an error message or the clean fields. */
export async function parsePlace(body: Record<string, unknown>, creating: boolean): Promise<PlaceFields | string> {
  const out: PlaceFields = {};
  if ("name" in body || creating) {
    const name = clean(body.name, 60);
    if (!name) return "Name the place.";
    out.name = name;
  }
  if ("kind" in body) out.kind = isPlaceKind(body.kind) ? body.kind : "other";
  if ("area" in body) out.area = clean(body.area, 100);
  for (const k of ["startsOn", "endsOn"] as const) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === null || v === "") out[k] = null;
    else if (typeof v === "string" && DATE.test(v)) out[k] = v;
    else return k === "startsOn" ? "That start date looks off." : "That end date looks off.";
  }
  if (out.startsOn && out.endsOn && out.endsOn < out.startsOn) return "The last day is before the first.";
  if ("venueId" in body) {
    const id = typeof body.venueId === "string" && body.venueId ? body.venueId : null;
    if (id && !(await prisma.venue.findUnique({ where: { id }, select: { id: true } }))) return "That partner venue isn't on the list any more.";
    out.venueId = id;
  }
  if ("active" in body) out.active = body.active !== false;
  if ("afterEnd" in body) {
    if (!isAfterEnd(body.afterEnd)) return "Pick what scans should do.";
    out.afterEnd = body.afterEnd;
  }
  return out;
}

/** The artist's Places for pickers: open ones first, then by name. */
export async function placeOptions(artistId: string) {
  const rows = await prisma.place.findMany({
    where: { artistId },
    select: { id: true, name: true, area: true, kind: true, venueId: true, active: true, endsOn: true },
    orderBy: [{ name: "asc" }],
  });
  const now = new Date();
  return rows
    .map((p) => ({ id: p.id, name: p.name, area: p.area, kind: p.kind, venueId: p.venueId, ended: placeEnded(p, now) }))
    .sort((a, b) => Number(a.ended) - Number(b.ended) || a.name.localeCompare(b.name));
}
export type PlaceOption = Awaited<ReturnType<typeof placeOptions>>[number];

/** Partner venues an artist can pick that none of their Places link to yet (picking one makes the Place). */
export async function partnerChoices(artistId: string) {
  const [venues, linked] = await Promise.all([
    prisma.venue.findMany({ where: { active: true }, select: { id: true, name: true, neighborhood: true }, orderBy: { name: "asc" } }),
    prisma.place.findMany({ where: { artistId, venueId: { not: null } }, select: { venueId: true } }),
  ]);
  const taken = new Set(linked.map((p) => p.venueId));
  return venues.filter((v) => !taken.has(v.id));
}

/** Find the artist's Place for a partner venue or a name (accents and case ignored), or make it. */
export async function ensurePlace(artistId: string, f: { name: string; venueId?: string | null; kind?: PlaceKind; area?: string | null; startsOn?: string | null; endsOn?: string | null }) {
  if (f.venueId) {
    const hit = await prisma.place.findFirst({ where: { artistId, venueId: f.venueId }, orderBy: { createdAt: "asc" } });
    if (hit) return hit;
  } else {
    const k = key(f.name);
    const all = await prisma.place.findMany({ where: { artistId }, orderBy: [{ createdAt: "asc" }] });
    // Prefer a Place without a partner venue, so a typed name never starts earning a venue a share.
    const hit = all.filter((p) => key(p.name) === k).sort((a, b) => Number(!!a.venueId) - Number(!!b.venueId))[0];
    if (hit) return hit;
  }
  const count = await prisma.place.count({ where: { artistId } });
  if (count >= MAX_PLACES) throw Object.assign(new Error("That's a lot of places. Remove some old ones first."), { code: "place_limit" });
  let name = f.name, area = f.area ?? null;
  if (f.venueId) {
    const v = await prisma.venue.findUnique({ where: { id: f.venueId }, select: { name: true, neighborhood: true, address: true } });
    if (v) { name = v.name; area = area ?? v.neighborhood ?? v.address ?? null; }
  }
  return prisma.place.create({ data: { artistId, name: name.slice(0, 60), kind: f.kind ?? guessKind(name), area, venueId: f.venueId ?? null, startsOn: f.startsOn ?? null, endsOn: f.endsOn ?? null } });
}

export function guessKind(name: string): PlaceKind {
  if (/(caf[eé]|coffee|espresso|bakery|\btea\b|\bbar\b)/i.test(name)) return "cafe";
  if (/galler/i.test(name)) return "gallery";
  if (/(market|flea|fair|bazaar)/i.test(name)) return "market";
  if (/studio/i.test(name)) return "studio";
  if (/(shop|store|boutique|books)/i.test(name)) return "shop";
  return "other";
}

/**
 * A picker's choice → the Place (made if it's a partner venue or a new name), null for none, or an error message.
 */
export async function resolvePlace(artistId: string, input: unknown): Promise<{ id: string; name: string; venueId: string | null } | null | string> {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "object") return "Pick a place.";
  const i = input as Record<string, unknown>;
  if (typeof i.id === "string" && i.id) {
    const p = await prisma.place.findFirst({ where: { id: i.id, artistId }, select: { id: true, name: true, venueId: true } });
    return p ?? "That place is gone. Refresh and pick another.";
  }
  if (typeof i.venueId === "string" && i.venueId) {
    const v = await prisma.venue.findUnique({ where: { id: i.venueId }, select: { id: true, name: true } });
    if (!v) return "That venue isn't on the list any more.";
    return ensurePlace(artistId, { name: v.name, venueId: v.id });
  }
  const name = clean(i.name, 60);
  if (name) return ensurePlace(artistId, { name });
  return null;
}

/** What a code carries for its Place: the link and the mirrored venue text and partner venue. */
export const codeMirror = (p: { id: string; name: string; venueId: string | null } | null) =>
  p ? { placeId: p.id, venue: p.name.slice(0, 60), venueId: p.venueId } : { placeId: null, venue: null, venueId: null };

/** Moves codes (ids) to a Place, or out of any Place (null). Returns how many changed. */
export async function assignCodes(artistId: string, codeIds: string[], place: { id: string; name: string; venueId: string | null } | null) {
  if (!codeIds.length) return 0;
  const r = await prisma.qrCode.updateMany({ where: { artistId, id: { in: codeIds } }, data: codeMirror(place) });
  return r.count;
}

/** After a Place's name or partner venue changes, its codes follow. */
export async function syncPlaceCodes(place: { id: string; name: string; venueId: string | null }) {
  await prisma.qrCode.updateMany({ where: { placeId: place.id }, data: { venue: place.name.slice(0, 60), venueId: place.venueId } });
}

/**
 * Hang paintings at a Place (null = back home). A painting hangs at one Place at a time: its open row ends today and a
 * new one starts. Already hanging there: left as is. Returns how many moved.
 */
export async function hangArtworks(artistId: string, artworkIds: string[], placeId: string | null) {
  const arts = await prisma.artwork.findMany({ where: { artistId, id: { in: artworkIds.slice(0, 500) } }, select: { id: true } });
  if (!arts.length) return 0;
  const ids = arts.map((a) => a.id);
  const open = await prisma.hanging.findMany({ where: { artworkId: { in: ids }, endedAt: null }, select: { id: true, artworkId: true, placeId: true } });
  const already = new Set(open.filter((h) => h.placeId === placeId).map((h) => h.artworkId));
  const moving = ids.filter((id) => !already.has(id));
  if (!moving.length) return 0;
  const now = new Date();
  await prisma.$transaction([
    prisma.hanging.updateMany({ where: { artworkId: { in: moving }, endedAt: null }, data: { endedAt: now } }),
    ...(placeId ? [prisma.hanging.createMany({ data: moving.map((artworkId) => ({ artistId, artworkId, placeId, startedAt: now })) })] : []),
  ]);
  return moving.length;
}

/** Where each painting hangs now: artworkId → Place. */
export async function currentHangings(artistId: string) {
  const rows = await prisma.hanging.findMany({ where: { artistId, endedAt: null }, select: { artworkId: true, startedAt: true, place: { select: { id: true, name: true } } } });
  return new Map(rows.map((r) => [r.artworkId, { ...r.place, since: r.startedAt }]));
}

// ---------------- numbers ----------------
type Stat = { paintings: number; codes: number; liveCodes: number; scans: number; scans30: number; sales: number; sales30: number; revenueCents: number };
const zero = (): Stat => ({ paintings: 0, codes: 0, liveCodes: 0, scans: 0, scans30: 0, sales: 0, sales30: 0, revenueCents: 0 });

/** Per Place: paintings hanging now, codes, scans and sales (all time and the last 30 days). Refunded sales left out. */
export async function placeStats(artistId: string, placeIds: string[]) {
  const out = new Map<string, Stat>(placeIds.map((id) => [id, zero()]));
  if (!placeIds.length) return out;
  const since = new Date(Date.now() - 30 * DAY);
  const [codes, hangs] = await Promise.all([
    prisma.qrCode.findMany({ where: { artistId, placeId: { in: placeIds } }, select: { id: true, placeId: true, active: true, expiresAt: true } }),
    prisma.hanging.groupBy({ by: ["placeId"], where: { artistId, placeId: { in: placeIds }, endedAt: null }, _count: { _all: true } }),
  ]);
  for (const h of hangs) out.get(h.placeId)!.paintings = h._count._all;
  const codePlace = new Map(codes.map((c) => [c.id, c.placeId!]));
  const now = new Date();
  for (const c of codes) { const s = out.get(c.placeId!)!; s.codes++; if (isLive(c, now)) s.liveCodes++; }
  const ids = codes.map((c) => c.id);
  if (!ids.length) return out;
  const [all, recent, items] = await Promise.all([
    prisma.scanEvent.groupBy({ by: ["qrCodeId"], where: { qrCodeId: { in: ids } }, _count: { _all: true } }),
    prisma.scanEvent.groupBy({ by: ["qrCodeId"], where: { qrCodeId: { in: ids }, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.orderItem.findMany({
      where: { qrCodeId: { in: ids }, order: { paymentStatus: "paid", kind: { notIn: ["bulk", "reprint"] } } },
      select: { id: true, orderId: true, qrCodeId: true, lineTotal: true, unitPrice: true, quantity: true, size: true, frameChosen: true, artistSplit: true, order: { select: { createdAt: true } } },
    }),
  ]);
  for (const g of all) out.get(codePlace.get(g.qrCodeId)!)!.scans += g._count._all;
  for (const g of recent) out.get(codePlace.get(g.qrCodeId)!)!.scans30 += g._count._all;
  const refunds = await activeRefunds(Array.from(new Set(items.map((i) => i.orderId))));
  for (const i of items) {
    if (refunds.has(i.id)) continue;
    const s = out.get(codePlace.get(i.qrCodeId!)!)!;
    s.sales++;
    if (i.order.createdAt >= since) s.sales30++;
    s.revenueCents += itemBreakdown({ ...i, orderDate: i.order.createdAt }).lineTotal;
  }
  return out;
}

/** Every Place of the artist with its numbers, for /studio/places. */
export async function placeList(artistId: string) {
  const places = await prisma.place.findMany({
    where: { artistId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, kind: true, area: true, venueId: true, startsOn: true, endsOn: true, active: true, afterEnd: true, createdAt: true, venue: { select: { name: true, active: true } } },
  });
  const stats = await placeStats(artistId, places.map((p) => p.id));
  return places.map((p) => ({ ...p, ...stats.get(p.id)! }));
}

/** One Place: its paintings and codes, numbers, events, and the Places it could move to. */
export async function placeDetail(artistId: string, id: string) {
  const place = await prisma.place.findFirst({ where: { id, artistId }, include: { venue: { select: { id: true, name: true, slug: true, active: true } } } });
  if (!place) return null;
  const [stats, hangs, codes, events, history] = await Promise.all([
    placeStats(artistId, [place.id]),
    prisma.hanging.findMany({ where: { placeId: place.id, endedAt: null }, orderBy: { startedAt: "desc" }, select: { id: true, startedAt: true, artwork: { select: { id: true, title: true, slug: true, imageUrl: true, status: true } } } }),
    prisma.qrCode.findMany({
      where: { artistId, placeId: place.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true, label: true, active: true, expiresAt: true, discountPct: true, artworkId: true, artwork: { select: { title: true, imageUrl: true } }, _count: { select: { scans: true } } },
    }),
    prisma.studioEvent.findMany({ where: { placeId: place.id }, orderBy: { start: "desc" }, select: { id: true, name: true, start: true, end: true } }),
    prisma.hanging.findMany({ where: { placeId: place.id, endedAt: { not: null } }, orderBy: { endedAt: "desc" }, take: 12, select: { id: true, startedAt: true, endedAt: true, artwork: { select: { title: true, slug: true } } } }),
  ]);
  const now = new Date();
  return {
    place,
    stats: stats.get(place.id)!,
    paintings: hangs.map((h) => ({ hangingId: h.id, since: h.startedAt, ...h.artwork })),
    codes: codes.map((c) => ({ ...c, live: isLive(c, now), scans: c._count.scans })),
    events,
    history,
    today: nyToday(now),
  };
}

/**
 * "Move everything to another place": its codes, the paintings hanging there and queued print jobs go to `to`.
 * The old Place stays (closed or not) with its history.
 */
export async function moveEverything(artistId: string, fromId: string, to: { id: string; name: string; venueId: string | null }) {
  const codeIds = (await prisma.qrCode.findMany({ where: { artistId, placeId: fromId }, select: { id: true } })).map((c) => c.id);
  const artIds = (await prisma.hanging.findMany({ where: { artistId, placeId: fromId, endedAt: null }, select: { artworkId: true } })).map((h) => h.artworkId);
  const codes = await assignCodes(artistId, codeIds, to);
  const paintings = await hangArtworks(artistId, artIds, to.id);
  await prisma.printQueueItem.updateMany({ where: { artistId, placeId: fromId }, data: { placeId: to.id } });
  return { codes, paintings };
}

/** Deleting a Place: its codes keep working and simply stop naming it; its paintings come home; history goes with it. */
export async function deletePlace(artistId: string, id: string) {
  const p = await prisma.place.findFirst({ where: { id, artistId }, select: { id: true } });
  if (!p) return false;
  await prisma.$transaction([
    prisma.qrCode.updateMany({ where: { artistId, placeId: id }, data: { placeId: null, venue: null, venueId: null } }),
    prisma.place.delete({ where: { id } }),
  ]);
  return true;
}

/**
 * "Print all codes for this place": every live code there that opens a painting, plus a new code (tagged to the
 * Place) for each painting hanging there without one, goes into the print queue with its own look and today's
 * discount. The queue items carry the Place, so "Mark as printed" records them for it. Returns { queued, made }.
 */
export async function queueForPlace(artistId: string, placeId: string) {
  const place = await prisma.place.findFirst({ where: { id: placeId, artistId }, select: { id: true, name: true, venueId: true } });
  if (!place) return null;
  const now = new Date();
  const live = (await prisma.qrCode.findMany({
    where: { artistId, placeId, artworkId: { not: null }, artwork: { status: { in: ["APPROVED", "PENDING"] }, slug: { not: null } } },
    select: { id: true, artworkId: true, design: true, discountPct: true, active: true, expiresAt: true },
    orderBy: { createdAt: "asc" },
  })).filter((c) => isLive(c, now));
  const covered = new Set(live.map((c) => c.artworkId));
  const hanging = await prisma.hanging.findMany({
    where: { placeId, endedAt: null, artwork: { status: { in: ["APPROVED", "PENDING"] }, slug: { not: null } } },
    select: { artwork: { select: { id: true, title: true } } },
  });
  const last = await lastLook(artistId);
  let made = 0;
  for (const h of hanging) {
    if (covered.has(h.artwork.id)) continue;
    const qr = await createQrCode({ artistId, artworkId: h.artwork.id, label: `${h.artwork.title} · ${place.name}`.slice(0, 60), design: last, ...codeMirror(place) });
    live.push({ id: qr.id, artworkId: h.artwork.id, design: last, discountPct: null, active: true, expiresAt: null });
    covered.add(h.artwork.id);
    made++;
  }
  let queued = 0;
  for (const c of live) {
    const design = sanitizeDesign({ ...sanitizeDesign(c.design ?? last), disc: c.discountPct || 0 });
    const item = await addToQueue(artistId, { artworkId: c.artworkId!, qrCodeId: c.id, design, qty: 1 });
    await prisma.printQueueItem.update({ where: { id: item.id }, data: { placeId } });
    queued++;
  }
  return { queued, made, place };
}
