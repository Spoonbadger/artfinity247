// Server only. Is this artist on Infinity right now? For the QR card extras (lib/generateQrPdf.ts falls back to the
// closest free look for Free artists).
import { prisma } from "@/lib/prisma";
import { isProActive } from "@/lib/plans";

export async function artistIsPro(artistId: string | null | undefined): Promise<boolean> {
  if (!artistId) return false;
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { proUntil: true } }).catch(() => null);
  return isProActive(a);
}
