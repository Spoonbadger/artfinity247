// Old artist handles keep working after an admin renames one: /@old 308s to /@new.
// Artwork links already redirect on their own (the art slug finds the piece, then the page fixes the handle), and
// printed codes use short codes, so only the artist pages themselves need this. Each rename is an AdminAction row
// ("artist.handle_change", details { from, to }); the latest row for an old handle wins. Server only.
import { prisma } from "@/lib/prisma";

export const HANDLE_CHANGE_ACTION = "artist.handle_change";

/** The current handle of the artist who used to be @old, or null. Only call when no artist has @old now. */
export async function movedHandle(old: string): Promise<string | null> {
  const from = decodeURIComponent(old || "").replace(/^@/, "").toLowerCase();
  if (!from) return null;
  try {
    const row = await prisma.adminAction.findFirst({
      where: { action: HANDLE_CHANGE_ACTION, targetType: "artist", details: { path: ["from"], equals: from } },
      orderBy: { createdAt: "desc" },
      select: { targetId: true },
    });
    if (!row?.targetId) return null;
    const a = await prisma.artist.findUnique({ where: { id: row.targetId }, select: { slug: true } });
    return a && a.slug.toLowerCase() !== from ? a.slug : null;
  } catch {
    return null;
  }
}
