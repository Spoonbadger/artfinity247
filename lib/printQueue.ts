// Shared print helpers, server only: an artwork row as card art, and the artist's newest saved look.
// (Named for the old print queue, retired Nov 2026 for Print codes: lib/printJob.ts, /studio/print.)
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_DESIGN, FORMATS, sanitizeDesign, type ArtInfo, type Design, type FormatKey } from "@/components/qr/card";

export const queueArtSelect = {
  id: true, slug: true, title: true, imageUrl: true, status: true, sensitive: true, editionSize: true,
  markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true,
  artist: { select: { name: true, artist_name: true } },
} as const;

type ArtRow = { slug: string | null; title: string; imageUrl: string; sensitive: string[]; editionSize: number | null; markupSmall: number | null; markupMedium: number | null; markupLarge: number | null; markupXl: number | null; artist: { name: string; artist_name: string | null } | null };

export function artInfoOf(r: ArtRow): ArtInfo {
  return {
    slug: r.slug || "",
    title: r.title,
    artist: r.artist?.artist_name || r.artist?.name || "",
    imageUrl: r.imageUrl,
    sensitive: r.sensitive,
    edition: r.editionSize,
    markups: { small: r.markupSmall || 0, medium: r.markupMedium || 0, large: r.markupLarge || 0, xl: r.markupXl || 0 },
  };
}

export const isFormat = (v: unknown): v is FormatKey => typeof v === "string" && v in FORMATS;

/** A look without venue, discount or end date: those live on the code record, and a plain code has none. */
export const plainDesign = (d: Design): Design => ({ ...d, disc: 0, coupon: "", ev: "", evPrint: false, end: "never" });

/** The artist's newest saved look (from their newest designed code), without venue or discount. */
export async function lastLook(artistId: string): Promise<Design> {
  const c = await prisma.qrCode.findFirst({ where: { artistId, design: { not: Prisma.DbNull } }, orderBy: { createdAt: "desc" }, select: { design: true } });
  return plainDesign(c?.design ? sanitizeDesign(c.design) : DEFAULT_DESIGN);
}
