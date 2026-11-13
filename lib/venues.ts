// Venue partner program: the cafés, bars, shops and markets that hang artists' codes. Server only (Prisma).
//
// A QrCode hangs at a Venue when QrCode.venueId is set (the artist picks it in My codes / QR Studio, or an admin
// links a venue name). Sales are credited to a venue through OrderItem.qrCodeId → QrCode.venueId.
//
// Money (all CENTS), the same math as the admin dashboard and lib/bookkeeping.ts:
//   Artfinity profit on a line = companyShare from lib/sales.ts itemBreakdown (profit − artist share)
//   Refunded lines (lib/refunds.ts: an active "order.refund" AdminAction) are left out of sales and profit.
//   Venue share owed for a month = round(Venue.sharePct × Artfinity profit on that month's lines).
// Lines are booked to the order's UTC calendar month ("2026-10"), like artist payouts.
//
// Paying a venue is recorded in the admin audit log (no schema of its own): a "venue.payout_paid" AdminAction
// (targetType "venue", details { month, amountCents }) marks the month paid; a later "venue.payout_unpaid" for the
// same month clears it. The newest row per month wins.
import { prisma } from "@/lib/prisma";
import { itemBreakdown } from "@/lib/sales";
import { activeRefunds } from "@/lib/refunds";
import { isLive } from "@/lib/shortlinks";
import { PUBLIC_ART, toCard, type CardArt } from "@/components/browse/data";
import { QR_END_DATES } from "@/lib/features";

export const VENUE_PAID_ACTION = "venue.payout_paid";
export const VENUE_UNPAID_ACTION = "venue.payout_unpaid";
export const VENUE_STATEMENT_ACTION = "venue.statement_emailed";

/** Highest share an admin can set, as a fraction of Artfinity's profit. */
export const MAX_SHARE_PCT = 0.5;

export function slugifyVenue(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "venue"
  );
}

/** A slug not used by another venue: "lumen-cafe", then "lumen-cafe-2", ... */
export async function uniqueVenueSlug(name: string, exceptId?: string) {
  const base = slugifyVenue(name);
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const hit = await prisma.venue.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === exceptId) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** "Lumen Café" → "lumen cafe": how free-text venue names on codes are grouped. */
export const venueKey = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

/** Plain Google Maps search link (no embed, no API key). */
export function mapsUrl(v: { name: string; address?: string | null; neighborhood?: string | null }) {
  const q = [v.name, v.address || v.neighborhood, v.address ? null : "New York, NY"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export const pctLabel = (frac: number) => `${+(frac * 100).toFixed(2)}%`;

export const monthOf = (d: Date) => d.toISOString().slice(0, 7);

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Active venues for the artist's picker (name + neighborhood). `include` keeps a code's current venue listed even if paused. */
export async function venueOptions(include?: string | null) {
  const rows = await prisma.venue.findMany({
    where: include ? { OR: [{ active: true }, { id: include }] } : { active: true },
    select: { id: true, name: true, neighborhood: true },
    orderBy: [{ name: "asc" }],
  });
  return rows.map((v) => ({ id: v.id, name: v.name, neighborhood: v.neighborhood }));
}
export type VenueOption = Awaited<ReturnType<typeof venueOptions>>[number];

// ---------------- money ----------------

export type VenueLine = {
  id: string;
  orderId: string;
  date: Date;
  month: string;
  code: string;
  title: string;
  artist: string;
  size: string | null;
  quantity: number;
  grossCents: number;
  profitCents: number;
  artistShareCents: number;
  /** Artfinity's profit on the line (profit − artist share). 0 when refunded. */
  artfinityCents: number;
  refunded: boolean;
};

export type VenueMonth = {
  month: string;
  sales: number;
  prints: number;
  grossCents: number;
  artfinityCents: number;
  refundedLines: number;
  refundedCents: number;
  /** round(sharePct × artfinityCents) */
  owedCents: number;
  paid: { amountCents: number; at: Date; adminEmail: string } | null;
};

/** Sales credited to the venue's codes (paid buyer orders), with refunds applied. Optional month filter. */
export async function venueLines(venueId: string, month?: string): Promise<VenueLine[]> {
  let range: { gte: Date; lt: Date } | undefined;
  if (month && isMonth(month)) {
    const [y, m] = month.split("-").map(Number);
    range = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
  }
  const items = await prisma.orderItem.findMany({
    where: {
      qrCodeId: { not: null },
      order: { paymentStatus: "paid", kind: { notIn: ["bulk", "reprint"] }, ...(range ? { createdAt: range } : {}) },
    },
    select: {
      id: true, orderId: true, qrCodeId: true, lineTotal: true, unitPrice: true, quantity: true, size: true, frameChosen: true, artistSplit: true,
      title: true, artistName: true,
      order: { select: { createdAt: true } },
    },
    orderBy: { order: { createdAt: "asc" } },
  });
  // OrderItem.qrCodeId has no relation in the schema, so look the codes up separately.
  const codeIds = Array.from(new Set(items.map((i) => i.qrCodeId!)));
  const codes = codeIds.length ? await prisma.qrCode.findMany({ where: { id: { in: codeIds }, venueId }, select: { id: true, code: true } }) : [];
  const codeById = new Map(codes.map((c) => [c.id, c.code]));
  const mine = items.filter((i) => codeById.has(i.qrCodeId!));
  const refunds = await activeRefunds(Array.from(new Set(mine.map((i) => i.orderId))));
  return mine.map((i) => {
    const b = itemBreakdown({ ...i, orderDate: i.order.createdAt });
    const refunded = refunds.has(i.id);
    return {
      id: i.id,
      orderId: i.orderId,
      date: i.order.createdAt,
      month: monthOf(i.order.createdAt),
      code: codeById.get(i.qrCodeId!)!,
      title: i.title || "Print",
      artist: i.artistName || "",
      size: i.size,
      quantity: b.quantity,
      grossCents: b.lineTotal,
      profitCents: b.profit,
      artistShareCents: b.artistShare,
      artfinityCents: refunded ? 0 : b.companyShare,
      refunded,
    };
  });
}

/** Months marked paid for a venue: month → newest payout record (unpaid rows clear it). */
export async function venuePayouts(venueId: string) {
  const rows = await prisma.adminAction.findMany({
    where: { targetType: "venue", targetId: venueId, action: { in: [VENUE_PAID_ACTION, VENUE_UNPAID_ACTION] } },
    orderBy: { createdAt: "asc" },
    select: { action: true, details: true, createdAt: true, adminEmail: true },
  });
  const out = new Map<string, { amountCents: number; at: Date; adminEmail: string }>();
  for (const r of rows) {
    const d = (r.details ?? {}) as { month?: unknown; amountCents?: unknown };
    if (!isMonth(d.month)) continue;
    if (r.action === VENUE_UNPAID_ACTION) out.delete(d.month);
    else out.set(d.month, { amountCents: Number(d.amountCents) || 0, at: r.createdAt, adminEmail: r.adminEmail });
  }
  return out;
}

export const owedFor = (sharePct: number, artfinityCents: number) => Math.max(0, Math.round((sharePct || 0) * artfinityCents));

/** Per-month totals, newest first. */
export function monthsFrom(lines: VenueLine[], sharePct: number, paid: Map<string, { amountCents: number; at: Date; adminEmail: string }>): VenueMonth[] {
  const by = new Map<string, VenueMonth>();
  const get = (month: string) => {
    let m = by.get(month);
    if (!m) by.set(month, (m = { month, sales: 0, prints: 0, grossCents: 0, artfinityCents: 0, refundedLines: 0, refundedCents: 0, owedCents: 0, paid: paid.get(month) ?? null }));
    return m;
  };
  for (const l of lines) {
    const m = get(l.month);
    if (l.refunded) {
      m.refundedLines++;
      m.refundedCents += l.grossCents;
      continue;
    }
    m.sales++;
    m.prints += l.quantity;
    m.grossCents += l.grossCents;
    m.artfinityCents += l.artfinityCents;
  }
  // A paid month with no sales left (all refunded later) still shows.
  for (const k of Array.from(paid.keys())) get(k);
  for (const m of Array.from(by.values())) m.owedCents = owedFor(sharePct, m.artfinityCents);
  return Array.from(by.values()).sort((a, b) => b.month.localeCompare(a.month));
}

/** The admin venue page: codes hanging there with scans and sales, money by month. */
export async function venueReport(venueId: string) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) return null;
  const codes = await prisma.qrCode.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, code: true, label: true, venue: true, active: true, expiresAt: true, createdAt: true,
      artist: { select: { id: true, slug: true, name: true, artist_name: true } },
      artwork: { select: { id: true, title: true, slug: true, imageUrl: true } },
    },
  });
  const ids = codes.map((c) => c.id);
  const [scanGroups, lines, paid] = await Promise.all([
    ids.length ? prisma.scanEvent.groupBy({ by: ["qrCodeId"], where: { qrCodeId: { in: ids } }, _count: { _all: true } }) : Promise.resolve([]),
    venueLines(venueId),
    venuePayouts(venueId),
  ]);
  const scans = new Map(scanGroups.map((g) => [g.qrCodeId, g._count._all]));
  const now = new Date();
  const codeRows = codes.map((c) => {
    const ls = lines.filter((l) => l.code === c.code && !l.refunded);
    return {
      ...c,
      live: isLive(c, now),
      artistName: c.artist.artist_name || c.artist.name,
      scans: scans.get(c.id) ?? 0,
      sales: ls.length,
      grossCents: ls.reduce((n, l) => n + l.grossCents, 0),
      artfinityCents: ls.reduce((n, l) => n + l.artfinityCents, 0),
    };
  });
  const months = monthsFrom(lines, venue.sharePct, paid);
  const counted = lines.filter((l) => !l.refunded);
  const totals = {
    codes: codes.length,
    liveCodes: codeRows.filter((c) => c.live).length,
    scans: codeRows.reduce((n, c) => n + c.scans, 0),
    sales: counted.length,
    grossCents: counted.reduce((n, l) => n + l.grossCents, 0),
    artfinityCents: counted.reduce((n, l) => n + l.artfinityCents, 0),
    owedCents: months.reduce((n, m) => n + m.owedCents, 0),
    paidCents: months.reduce((n, m) => n + (m.paid?.amountCents ?? 0), 0),
    unpaidCents: months.filter((m) => !m.paid).reduce((n, m) => n + m.owedCents, 0),
    refundedLines: lines.length - counted.length,
  };
  return { venue, codes: codeRows, months, totals, lines };
}

/** One month's statement: the venue, its lines and totals. */
export async function venueStatement(venueId: string, month: string) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue || !isMonth(month)) return null;
  const [lines, paid] = await Promise.all([venueLines(venueId, month), venuePayouts(venueId)]);
  const m = monthsFrom(lines, venue.sharePct, new Map(paid.has(month) ? [[month, paid.get(month)!]] : []))[0] ?? {
    month, sales: 0, prints: 0, grossCents: 0, artfinityCents: 0, refundedLines: 0, refundedCents: 0, owedCents: 0, paid: null,
  };
  return { venue, month, lines, totals: m };
}

const usd = (c: number) => (c / 100).toFixed(2);
const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function statementCsv(s: NonNullable<Awaited<ReturnType<typeof venueStatement>>>) {
  const t = s.totals;
  const rows: (string | number)[][] = [
    ["Artfinity venue statement", s.venue.name, monthLabel(s.month)],
    ["Venue share", pctLabel(s.venue.sharePct), "of Artfinity's profit on sales from codes hanging at the venue"],
    [],
    ["date", "order", "code", "artwork", "artist", "size", "qty", "sale", "artfinity_profit", "refunded"],
    ...s.lines.map((l) => [l.date.toISOString().slice(0, 10), l.orderId, l.code, l.title, l.artist, l.size || "", l.quantity, usd(l.grossCents), usd(l.artfinityCents), l.refunded ? "yes" : ""]),
    [],
    ["Sales (not refunded)", t.sales],
    ["Sales total", usd(t.grossCents)],
    ["Refunded lines", t.refundedLines, usd(t.refundedCents)],
    ["Artfinity profit", usd(t.artfinityCents)],
    ["Venue share owed", usd(t.owedCents)],
    ["Status", t.paid ? `Paid ${t.paid.at.toISOString().slice(0, 10)} (${usd(t.paid.amountCents)})` : "Unpaid"],
  ];
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

/** Every venue with its headline numbers, for /admin/venues. One pass over code-credited sales. */
export async function venueList() {
  const venues = await prisma.venue.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { codes: { select: { id: true, active: true, expiresAt: true } } } });
  const codeToVenue = new Map<string, string>();
  for (const v of venues) for (const c of v.codes) codeToVenue.set(c.id, v.id);
  const items = codeToVenue.size
    ? await prisma.orderItem.findMany({
        where: { qrCodeId: { in: Array.from(codeToVenue.keys()) }, order: { paymentStatus: "paid", kind: { notIn: ["bulk", "reprint"] } } },
        select: { id: true, orderId: true, qrCodeId: true, lineTotal: true, unitPrice: true, quantity: true, size: true, frameChosen: true, artistSplit: true, order: { select: { createdAt: true } } },
      })
    : [];
  const [refunds, payRows] = await Promise.all([
    activeRefunds(Array.from(new Set(items.map((i) => i.orderId)))),
    prisma.adminAction.findMany({
      where: { targetType: "venue", action: { in: [VENUE_PAID_ACTION, VENUE_UNPAID_ACTION] } },
      orderBy: { createdAt: "asc" },
      select: { targetId: true, action: true, details: true },
    }),
  ]);
  // venueId → month → paid?
  const paid = new Map<string, Set<string>>();
  for (const r of payRows) {
    const m = (r.details as { month?: unknown } | null)?.month;
    if (!r.targetId || !isMonth(m)) continue;
    const set = paid.get(r.targetId) ?? new Set<string>();
    if (r.action === VENUE_UNPAID_ACTION) set.delete(m);
    else set.add(m);
    paid.set(r.targetId, set);
  }
  // venueId → month → Artfinity profit
  const byVenue = new Map<string, { sales: number; grossCents: number; artfinityCents: number; months: Map<string, number> }>();
  for (const i of items) {
    if (refunds.has(i.id)) continue;
    const vId = codeToVenue.get(i.qrCodeId!)!;
    const b = itemBreakdown({ ...i, orderDate: i.order.createdAt });
    const agg = byVenue.get(vId) ?? { sales: 0, grossCents: 0, artfinityCents: 0, months: new Map<string, number>() };
    agg.sales++;
    agg.grossCents += b.lineTotal;
    agg.artfinityCents += b.companyShare;
    const m = monthOf(i.order.createdAt);
    agg.months.set(m, (agg.months.get(m) ?? 0) + b.companyShare);
    byVenue.set(vId, agg);
  }
  const now = new Date();
  return venues.map((v) => {
    const agg = byVenue.get(v.id);
    const paidMonths = paid.get(v.id) ?? new Set<string>();
    const unpaidCents = agg ? Array.from(agg.months).filter(([m]) => !paidMonths.has(m)).reduce((n, [, cents]) => n + owedFor(v.sharePct, cents), 0) : 0;
    const { codes, ...rest } = v;
    return {
      ...rest,
      codes: codes.length,
      liveCodes: codes.filter((c) => isLive(c, now)).length,
      sales: agg?.sales ?? 0,
      grossCents: agg?.grossCents ?? 0,
      artfinityCents: agg?.artfinityCents ?? 0,
      unpaidCents,
    };
  });
}

/** Free-text venue names on codes that aren't linked to a partner venue yet, grouped (case and accents ignored). */
export async function unlinkedVenueNames() {
  const rows = await prisma.qrCode.findMany({
    where: { venueId: null, venue: { not: null } },
    select: { venue: true, active: true, artist: { select: { artist_name: true, name: true } } },
  });
  const groups = new Map<string, { key: string; names: Map<string, number>; codes: number; live: number; artists: Set<string> }>();
  for (const r of rows) {
    const text = (r.venue || "").trim();
    const key = venueKey(text);
    if (!key) continue;
    const g = groups.get(key) ?? { key, names: new Map<string, number>(), codes: 0, live: 0, artists: new Set<string>() };
    g.names.set(text, (g.names.get(text) ?? 0) + 1);
    g.codes++;
    if (r.active) g.live++;
    g.artists.add(r.artist.artist_name || r.artist.name);
    groups.set(key, g);
  }
  return Array.from(groups.values())
    .map((g) => ({ key: g.key, text: Array.from(g.names).sort((a, b) => b[1] - a[1])[0][0], spellings: Array.from(g.names.keys()), codes: g.codes, live: g.live, artists: Array.from(g.artists) }))
    .sort((a, b) => b.codes - a.codes || a.text.localeCompare(b.text));
}

// ---------------- public ----------------

/** What's hanging at a venue now: live codes whose artwork (or artist page) is public. Artworks as browse cards, newest code first. */
export async function hangingAt(venueId: string) {
  const now = new Date();
  const codes = await prisma.qrCode.findMany({
    where: { venueId, active: true, ...(QR_END_DATES ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } : {}), artist: { closedAt: null, suspendedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { artworkId: true, artist: { select: { slug: true, name: true, artist_name: true } } },
  });
  const ids = Array.from(new Set(codes.map((c) => c.artworkId).filter((x): x is string => !!x)));
  const rows = ids.length
    ? await prisma.artwork.findMany({
        where: { id: { in: ids }, ...PUBLIC_ART },
        select: {
          id: true, slug: true, title: true, imageUrl: true, sensitive: true, markupSmall: true, markupMedium: true, createdAt: true, editionSize: true,
          artist: { select: { name: true, artist_name: true, slug: true, city: true, state: true, citySlug: true } },
        },
      })
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const artworks: CardArt[] = ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r).map(toCard);
  const artistPages: { slug: string; name: string }[] = [];
  for (const c of codes) {
    if (c.artworkId || artistPages.some((a) => a.slug === c.artist.slug)) continue;
    artistPages.push({ slug: c.artist.slug, name: c.artist.artist_name || c.artist.name });
  }
  return { artworks, artistPages };
}

/** Active venues for the public index, with how many pieces hang at each and up to nine thumbnails. */
export async function publicVenues() {
  const venues = await prisma.venue.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, neighborhood: true, address: true } });
  return Promise.all(venues.map(async (v) => {
    const h = await hangingAt(v.id);
    return { ...v, pieces: h.artworks.length, thumbs: h.artworks.slice(0, 9), artists: Array.from(new Set([...h.artworks.map((a) => a.artist.name), ...h.artistPages.map((a) => a.name)])) };
  }));
}
