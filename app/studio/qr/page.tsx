import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import QrStudio from "@/components/qr/QrStudio";
import { DEFAULT_DESIGN, cardSVG, qrValue, renderCard, sheetSVG, type ArtInfo } from "@/components/qr/card";
import { loadFonts } from "@/components/qr/text";
import { requireArtist, displayName } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "QR codes" };

export default async function QrPage({ searchParams }: { searchParams: { art?: string } }) {
  const want = typeof searchParams.art === "string" ? searchParams.art : "";
  const artist = await requireArtist(`/studio/qr${want ? `?art=${encodeURIComponent(want)}` : ""}`);

  const rows = await prisma.artwork.findMany({
    where: { artistId: artist.id, status: "APPROVED", slug: { not: null } },
    select: { slug: true, title: true, imageUrl: true, markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true, sensitive: true },
    orderBy: { createdAt: "desc" },
  });
  const name = displayName(artist);
  const arts: ArtInfo[] = rows.map((r) => ({
    slug: r.slug as string,
    title: r.title,
    artist: name,
    imageUrl: r.imageUrl,
    sensitive: r.sensitive,
    markups: { small: r.markupSmall || 0, medium: r.markupMedium || 0, large: r.markupLarge || 0, xl: r.markupXl || 0 },
  }));

  if (!arts.length) {
    return (
      <StudioPage title="QR codes" sub="A code to hang beside each piece.">
        <div className="af-panel grid justify-items-start gap-3 p-6">
          <h2 className="display text-[28px]">No approved art yet</h2>
          <p className="text-[15px] text-ink-2">Codes appear here once a piece is approved.</p>
          <Link href="/studio/art" className="btn btn-blue">Go to my art</Link>
        </div>
      </StudioPage>
    );
  }

  const slug = arts.some((a) => a.slug === want) ? want : arts[0].slug;
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";

  // First paint: the server draws the default card so there's no empty stage while fonts load.
  let initialCard: { svg: string; sheet: string } | null = null;
  try {
    const fonts = await loadFonts();
    const art = arts.find((a) => a.slug === slug)!;
    const card = renderCard(DEFAULT_DESIGN, art, fonts, qrValue(DEFAULT_DESIGN, slug, base));
    initialCard = { svg: cardSVG(card), sheet: sheetSVG(card, DEFAULT_DESIGN.format) };
  } catch (e) {
    console.error("QR first paint failed", e);
  }

  return (
    <StudioPage title="QR codes" sub="Pick a piece. Pick a look. Print. Every code here really scans.">
      <QrStudio arts={arts} initialSlug={slug} initialDesign={DEFAULT_DESIGN} initialCard={initialCard} base={base} />
    </StudioPage>
  );
}
