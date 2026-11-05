// Closing and reopening an artist account. Server only.
// Closing takes the page and art offline but keeps payouts, orders and sales, so unpaid
// earnings are still paid on the normal schedule (admin payouts are built from orders).
import { prisma } from "@/lib/prisma";

/** flaggedReason on artworks hidden by a close: "account_closed:APPROVED", or "account_closed:APPROVED|<earlier flag>". */
export const CLOSED_TAG = "account_closed:";

export async function closeArtistAccount(artistId: string, now = new Date()) {
  await prisma.$transaction(async (tx) => {
    const arts = await tx.artwork.findMany({
      where: { artistId, status: { not: "REJECTED" } },
      select: { id: true, status: true, flaggedReason: true },
    });
    // Keep the old status and any existing flag so a reopen can put them back.
    const byReason = new Map<string, string[]>();
    for (const a of arts) {
      const reason = CLOSED_TAG + a.status + (a.flaggedReason ? "|" + a.flaggedReason : "");
      byReason.set(reason, [...(byReason.get(reason) || []), a.id]);
    }
    for (const [reason, ids] of Array.from(byReason)) {
      await tx.artwork.updateMany({ where: { id: { in: ids } }, data: { status: "REJECTED", flaggedReason: reason, flaggedBy: "system" } });
    }
    // Printed codes stop resolving because /q checks closedAt. A pending Venmo change is dropped.
    await tx.artist.update({
      where: { id: artistId },
      data: { closedAt: now, venmoPending: null, venmoPendingToken: null, venmoPendingAt: null },
    });
  });
}

/** Undo a close: art hidden by it goes back to its old status. */
export async function reopenArtistAccount(artistId: string) {
  await prisma.$transaction(async (tx) => {
    const arts = await tx.artwork.findMany({
      where: { artistId, flaggedReason: { startsWith: CLOSED_TAG } },
      select: { id: true, flaggedReason: true },
    });
    for (const a of arts) {
      const [prev, ...old] = a.flaggedReason!.slice(CLOSED_TAG.length).split("|");
      const oldReason = old.join("|") || null;
      await tx.artwork.update({
        where: { id: a.id },
        data: { status: prev === "PENDING" ? "PENDING" : "APPROVED", flaggedReason: oldReason, flaggedBy: oldReason ? "system" : null },
      });
    }
    await tx.artist.update({ where: { id: artistId }, data: { closedAt: null } });
  });
}
