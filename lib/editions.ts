// Limited print runs. Artwork.editionSize: null = open edition, N = only N prints in total
// (all sizes, framed or not), numbered 1..N. "Sold" = quantities on paid OrderItems for the
// artwork, bulk orders included (an artist's own prints use up numbers too).
//
// OrderItem.editionNumber holds the FIRST number of the line: a line of 3 that starts at 8
// is prints 8, 9 and 10. Numbers are handed out inside a DB transaction that locks the
// artwork row, so two buyers can never get the same number.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export { EDITION_MIN, EDITION_MAX, LAST_FEW, editionOf, editionLabel, type Edition } from "@/lib/editionFormat";
import { editionOf, type Edition } from "@/lib/editionFormat";

type Db = Prisma.TransactionClient | typeof prisma;

/** Prints sold per artwork (paid orders, retail and bulk). */
export async function soldByArtwork(ids: string[], db: Db = prisma): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db.orderItem.groupBy({
    by: ["artworkId"],
    where: { artworkId: { in: ids }, order: { paymentStatus: "paid" } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.artworkId as string, r._sum.quantity ?? 0]));
}

export async function soldCount(artworkId: string, db: Db = prisma) {
  return (await soldByArtwork([artworkId], db)).get(artworkId) ?? 0;
}

/** Edition info for a list of artworks (only the limited ones get an entry). */
export async function editionsFor(arts: { id: string; editionSize: number | null }[]): Promise<Map<string, Edition>> {
  const limited = arts.filter((a) => a.editionSize);
  const sold = await soldByArtwork(limited.map((a) => a.id));
  return new Map(limited.map((a) => [a.id, editionOf(a.editionSize, sold.get(a.id) ?? 0)!]));
}

export type Shortfall = { artworkId: string; title?: string; left: number; wanted: number };

/**
 * Inside a transaction: lock each limited artwork, then give every line its first edition
 * number. Lines over what's left get null and are reported in `shortfalls` (callers either
 * refuse the order or, after Stripe already took payment, log it for a refund).
 * Call this BEFORE the order's own items exist, so they aren't counted as sold.
 */
export async function claimEditionNumbers(
  tx: Prisma.TransactionClient,
  lines: { artworkId: string | null; quantity: number }[],
): Promise<{ numbers: (number | null)[]; shortfalls: Shortfall[]; sizes: Map<string, number> }> {
  const ids = Array.from(new Set(lines.map((l) => l.artworkId).filter(Boolean) as string[])).sort(); // fixed order: no deadlocks
  const sizes = new Map<string, number>();
  const titles = new Map<string, string>();
  for (const id of ids) {
    const row = await tx.$queryRaw<{ editionSize: number | null; title: string }[]>`
      SELECT "editionSize", title FROM "Artwork" WHERE id = ${id} FOR UPDATE`;
    if (row[0]?.editionSize) { sizes.set(id, row[0].editionSize); titles.set(id, row[0].title); }
  }
  const sold = await soldByArtwork(Array.from(sizes.keys()), tx);
  const shortfalls: Shortfall[] = [];
  const numbers = lines.map((l) => {
    const size = l.artworkId ? sizes.get(l.artworkId) : undefined;
    if (!l.artworkId || !size) return null;
    const have = sold.get(l.artworkId) ?? 0;
    if (have + l.quantity > size) {
      shortfalls.push({ artworkId: l.artworkId, title: titles.get(l.artworkId), left: Math.max(0, size - have), wanted: l.quantity });
      return null;
    }
    sold.set(l.artworkId, have + l.quantity);
    return have + 1;
  });
  return { numbers, shortfalls, sizes };
}

export class EditionSoldOutError extends Error {
  constructor(public shortfalls: Shortfall[]) {
    super(editionMessage(shortfalls));
  }
}

export function editionMessage(s: Shortfall[]) {
  const f = s[0];
  if (!f) return "";
  const name = f.title ? `${f.title}` : "That piece";
  return f.left === 0 ? `${name} is sold out.` : `Only ${f.left} ${f.left === 1 ? "print" : "prints"} of ${name} left.`;
}

/** Quick pre-check outside a transaction: lines wanting more prints than are left (lines for one artwork added up). */
export async function editionShortfalls(lines: { artworkId: string; title: string; editionSize: number | null; quantity: number }[]): Promise<Shortfall[]> {
  const limited = lines.filter((l) => l.editionSize);
  if (!limited.length) return [];
  const sold = await soldByArtwork(limited.map((l) => l.artworkId));
  const want = new Map<string, number>();
  for (const l of limited) want.set(l.artworkId, (want.get(l.artworkId) ?? 0) + l.quantity);
  const out: Shortfall[] = [];
  for (const [id, wanted] of Array.from(want)) {
    const l = limited.find((x) => x.artworkId === id)!;
    const left = Math.max(0, l.editionSize! - (sold.get(id) ?? 0));
    if (wanted > left) out.push({ artworkId: id, title: l.title, left, wanted });
  }
  return out;
}
