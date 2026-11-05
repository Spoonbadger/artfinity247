import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import HelpLink from "@/components/help/HelpLink";
import Waitlist from "@/components/scanning/Waitlist";
import ScanStudio, { type ScanArt, type ScanBookingView } from "@/components/scanning/ScanStudio";
import { splitOriginal } from "@/lib/originalSize";
import { ACTIVE, artworksFor, bookingsFor, limitedSizes, readScanSettings, verifyScanSession } from "@/lib/scanning.server";
import { bandFor, careTextFor } from "@/lib/scanning";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painting scans" };

const HELP = "/help/selling/painting-scans";

export default async function StudioScanningPage({ searchParams }: { searchParams: { art?: string; booking?: string; paid?: string; session_id?: string } }) {
  const artist = await requireArtist("/studio/scanning");
  // Back from Stripe Checkout: mark it paid now if the webhook hasn't yet.
  if (searchParams.session_id) await verifyScanSession(artist.id, searchParams.session_id);

  const [s, rows, bookings, waiting] = await Promise.all([
    readScanSettings(),
    prisma.artwork.findMany({
      where: { artistId: artist.id, status: { not: "REJECTED" }, slug: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, title: true, imageUrl: true, printableSizes: true, description: true },
    }),
    bookingsFor(artist.id),
    prisma.scanWaitlist.findFirst({ where: { OR: [{ artistId: artist.id }, { email: artist.email.toLowerCase() }] }, select: { id: true } }),
  ]);
  const arts = await artworksFor(bookings);
  const busy = new Set(bookings.filter((b) => (ACTIVE as string[]).includes(b.status)).flatMap((b) => b.items.map((i) => i.artworkId).filter(Boolean) as string[]));

  const scanArts: ScanArt[] = rows.map((r) => {
    const { original } = splitOriginal(r.description);
    return {
      id: r.id, slug: r.slug!, title: r.title, imageUrl: r.imageUrl, printableSizes: r.printableSizes,
      limited: limitedSizes(r.printableSizes), busy: busy.has(r.id),
      original: original ? `${original.w} × ${original.h} in` : null,
      band: original ? bandFor(original.w, original.h, s.bands) : null,
    };
  });
  const views: ScanBookingView[] = bookings.map((b) => ({
    id: b.id, status: b.status as ScanBookingView["status"], handoff: b.handoff === "pickup" ? "pickup" : "dropoff", pickupAddress: b.pickupAddress,
    preferredDates: b.preferredDates, notes: b.notes, estimateCents: b.estimateCents, priceCents: b.priceCents,
    scheduledFor: b.scheduledFor?.toISOString() ?? null, dropoffInfo: b.dropoffInfo, createdAt: b.createdAt.toISOString(),
    receivedAt: b.receivedAt?.toISOString() ?? null, paidAt: b.paidAt?.toISOString() ?? null, deliveredAt: b.deliveredAt?.toISOString() ?? null,
    returnedAt: b.returnedAt?.toISOString() ?? null, cancelReason: b.cancelReason, test: !!b.stripeSessionId?.startsWith("dev_"),
    items: b.items.map((i) => {
      const a = i.artworkId ? arts.get(i.artworkId) : undefined;
      return { id: i.id, band: i.band, title: a?.title ?? i.title, slug: a?.slug ?? null, imageUrl: a?.imageUrl ?? null, printableSizes: i.scanUrl ? i.printableSizes : a?.printableSizes ?? [], delivered: !!i.scanUrl };
    }),
  }));
  const preselect = searchParams.art ? scanArts.find((a) => a.slug === searchParams.art)?.id ?? null : null;

  return (
    <StudioPage
      title="Painting scans"
      sub={s.enabled ? "We scan your originals in NYC and put the files straight onto your artworks, so every print size is sharp." : "Coming soon: we scan your originals in NYC so every print size is sharp."}
      actions={<><HelpLink href={HELP} /><Link href="/scanning" className="btn btn-ghost btn-sm">How it works</Link></>}
    >
      {!s.enabled && (
        <EmptyState
          dab="var(--af-scan)"
          title="Coming soon — join the waitlist"
          body={<>Phone photo too small for big prints? We&apos;ll scan the original, high-res and colour-accurate, and the file goes straight onto your artwork. Scanning isn&apos;t open yet: {waiting ? "you're on the list, and we'll email you when it opens." : "leave your email and we'll tell you the day it opens."}</>}
          secondary={{ label: "See how it works", href: "/scanning" }}
          help={{ label: "Getting your paintings scanned", href: HELP }}
        >
          {!waiting && <Waitlist source="studio" defaultEmail={artist.email} className="mt-1 w-full" />}
        </EmptyState>
      )}
      <ScanStudio
        enabled={s.enabled}
        arts={scanArts}
        bookings={views}
        preselect={preselect}
        focus={searchParams.booking || searchParams.paid || null}
        justPaid={searchParams.paid || (searchParams.session_id ? views.find((v) => v.paidAt && v.id === searchParams.booking)?.id : undefined) || null}
        settings={{ bands: s.bands, pickupFeeCents: s.pickupFeeCents, turnaroundDays: s.turnaroundDays, returnDays: s.returnDays, care: careTextFor(s) }}
      />
    </StudioPage>
  );
}
