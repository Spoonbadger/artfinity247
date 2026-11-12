import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import { Problem } from "@/components/studio/Problem";
import HelpLink from "@/components/help/HelpLink";
import QrStudio from "@/components/qr/QrStudio";
import { DEFAULT_DESIGN, DISCOUNTS, PRESETS, cardSVG, freeDesign, presetLook, qrValue, renderCard, sanitizeDesign, sheetSVG, type ArtInfo, type Design, type PresetKey } from "@/components/qr/card";
import { isProActive } from "@/lib/plans";
import { billingMode } from "@/lib/billing";
import { PLACEHOLDER_CODE, normalizeCode } from "@/lib/shortcode";
import { loadFonts } from "@/components/qr/text";
import { requireArtist, displayName } from "../_lib/data";
import { getArtistSplitFor } from "@/lib/revenue";
import { venueOptions } from "@/lib/venues";
import { partnerChoices, placeOptions } from "@/lib/artistPlaces";
import { queueCount } from "@/lib/printQueue";
import QueueLink from "@/components/qr/QueueLink";
import { QR_END_DATES } from "@/lib/features";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "QR codes" };

export default async function QrPage({ searchParams }: { searchParams: { art?: string; preset?: string; code?: string } }) {
  const artist = await requireArtist("/studio/qr");
  // ?code=K7P2 (from My codes) reopens a saved code: its artwork, look, venue and deal.
  const wantCode = normalizeCode(searchParams.code);
  const saved = wantCode
    ? await prisma.qrCode.findFirst({ where: { code: wantCode, artistId: artist.id }, select: { code: true, label: true, venue: true, venueId: true, placeId: true, discountPct: true, expiresAt: true, design: true, artwork: { select: { slug: true } } } })
    : null;
  const want = saved?.artwork?.slug || (typeof searchParams.art === "string" ? searchParams.art : "");

  const rows = await prisma.artwork.findMany({
    // Pieces in review can get their code now (the upload screen offers it); it works once they're live.
    where: { artistId: artist.id, status: { in: ["APPROVED", "PENDING"] }, slug: { not: null } },
    select: { slug: true, title: true, imageUrl: true, markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true, sensitive: true, editionSize: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  const name = displayName(artist);
  // Each sale pays the artist's real split today (70% on Infinity).
  const plan = await prisma.artist.findUnique({ where: { id: artist.id }, select: { plan: true, proUntil: true } });
  const split = getArtistSplitFor({ orderDate: new Date(), plan: plan?.plan, proUntil: plan?.proUntil });
  // Infinity looks are locked on Free: shown with their real preview, and choosing one starts checkout.
  const pro = isProActive(plan);
  const arts: ArtInfo[] = rows.map((r) => ({
    slug: r.slug as string,
    title: r.title,
    artist: name,
    imageUrl: r.imageUrl,
    sensitive: r.sensitive,
    edition: r.editionSize,
    markups: { small: r.markupSmall || 0, medium: r.markupMedium || 0, large: r.markupLarge || 0, xl: r.markupXl || 0 },
  }));

  if (!arts.length) {
    return (
      <StudioPage title="QR codes" sub="A code to hang beside each piece.">
        <EmptyState
          dab="#ffd43b"
          title="No paintings yet"
          body="Upload your first piece and its code is ready: a wall label, sticker, hang tag or poster. Scanning it opens the piece so people can buy a print."
          action={{ label: "Upload art", href: "/studio/art/new" }}
          help={{ label: "How QR codes work", href: "/help/getting-started/first-qr-code" }}
        />
      </StudioPage>
    );
  }
  const inReview = rows.filter((r) => r.status === "PENDING").map((r) => r.title);

  const slug = arts.some((a) => a.slug === want) ? want : arts[0].slug;
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";
  // ?preset=market (from /studio/bulk "matching QR hang tags") opens on that look.
  const presetKey = typeof searchParams.preset === "string" && searchParams.preset in PRESETS ? (searchParams.preset as PresetKey) : null;
  let design: Design = presetKey ? { ...DEFAULT_DESIGN, ...presetLook(presetKey), preset: presetKey } : DEFAULT_DESIGN;
  const savedCode = saved && saved.artwork?.slug === slug
    ? { code: saved.code, slug, label: saved.label || "", expiresAt: saved.expiresAt ? saved.expiresAt.toISOString() : null, venueId: saved.venueId, placeId: saved.placeId }
    : null;
  if (savedCode && saved) {
    const d = saved.design ? sanitizeDesign(saved.design) : design;
    // The record is the truth for venue and deal; the card's tag can only show the Studio's discount steps.
    const disc = saved.discountPct && DISCOUNTS.includes(saved.discountPct) ? saved.discountPct : saved.discountPct ? d.disc : 0;
    design = { ...d, ev: saved.venue || "", disc, evDate: d.evDate || (QR_END_DATES && saved.expiresAt ? saved.expiresAt.toISOString().slice(0, 10) : "") };
  }
  // A Free artist reopening an Infinity look gets the closest free look (that's also what prints).
  if (!pro) design = freeDesign(design);

  // First paint: the server draws the default card so there's no empty stage while fonts load.
  let initialCard: { svg: string; sheet: string } | null = null;
  try {
    const fonts = await loadFonts();
    const art = arts.find((a) => a.slug === slug)!;
    const card = renderCard(design, art, fonts, qrValue(design, slug, base, null, savedCode?.code ?? PLACEHOLDER_CODE, artist.slug));
    initialCard = { svg: cardSVG(card), sheet: sheetSVG(card, design.format) };
  } catch (e) {
    console.error("QR first paint failed", e);
  }

  return (
    <StudioPage title="QR codes" sub="Every code really scans, and you can change where it goes after printing." actions={<><HelpLink href="/help/qr-codes/qr-templates" /><Link href="/studio/codes" className="btn btn-ghost btn-sm">My codes</Link><QueueLink count={await queueCount(artist.id)} /></>}>
      {inReview.length > 0 && (
        <Problem tone="info" title={inReview.length === 1 ? `${inReview[0]} is in review` : `${inReview.length} pieces are in review`} fix={{ label: "See my art", href: "/studio/art" }}>
          You can print {inReview.length === 1 ? "its code" : "their codes"} now. Scans open the piece once it&apos;s live, usually within a day.
        </Problem>
      )}
      <QrStudio arts={arts} initialSlug={slug} initialDesign={design} initialCard={initialCard} base={base} initialSaved={savedCode} split={split} pro={pro} billing={billingMode()} handle={artist.slug} venues={await venueOptions(savedCode?.venueId)} places={await placeOptions(artist.id)} partners={await partnerChoices(artist.id)} />
    </StudioPage>
  );
}
