// Server helpers shared by the QR print routes.
import { prisma } from "@/lib/prisma";
import type { ArtInfo } from "@/components/qr/card";

export const artSelect = {
  id: true, slug: true, title: true, imageUrl: true, artistId: true, status: true, sensitive: true,
  markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true,
  artist: { select: { name: true, artist_name: true } },
} as const;

type Row = NonNullable<Awaited<ReturnType<typeof findArt>>>;
export function findArt(slug: string) {
  return prisma.artwork.findUnique({ where: { slug }, select: artSelect });
}

export function toArtInfo(r: Row): ArtInfo {
  return {
    slug: r.slug as string,
    title: r.title,
    artist: r.artist?.artist_name || r.artist?.name || "",
    imageUrl: r.imageUrl,
    sensitive: r.sensitive,
    markups: { small: r.markupSmall || 0, medium: r.markupMedium || 0, large: r.markupLarge || 0, xl: r.markupXl || 0 },
  };
}

/** Public base URL for codes: the configured app URL, else this request's origin. */
export function baseUrl(req: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "theartfinity.com";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const pdfHeaders = (name: string, mode: "attachment" | "inline" = "attachment") => ({
  "Content-Type": "application/pdf",
  "Content-Disposition": `${mode}; filename="${name.replace(/[^a-z0-9._-]+/gi, "-")}"`,
  "Cache-Control": "no-store",
});
