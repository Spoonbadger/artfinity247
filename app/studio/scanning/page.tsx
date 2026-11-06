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
import { usd } from "@/lib/scanning";
import PaymentReturn from "@/components/payments/PaymentReturn";
import ScanPayButton from "@/components/scanning/ScanPayButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painting scans" };

const HELP = "/help/selling/painting-scans";

export default async function StudioScanningPage({ searchParams }: { searchParams: { art?: string; booking?: string; paid?: string; session_id?: string; canceled?: string } }) {
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
  // Back from Stripe: paid (the notice in ScanStudio says what's next), or left without paying.
  const justPaid = searchParams.paid || (searchParams.session_id ? views.find((v) => v.paidAt && v.id === searchParams.booking)?.id : undefined) || null;
  const paidView = justPaid ? views.find((v) => v.id === justPaid && v.paidAt) : undefined;
  const canceledView = searchParams.canceled && searchParams.booking ? views.find((v) => v.id === searchParams.booking && v.status === "confirmed" && v.priceCents != null) : undefined;

  return (
    <StudioPage
      title="Painting scans"
      sub={s.enabled ? "We scan your originals in NYC so every print size is sharp." : undefined}
      actions={<HelpLink href={HELP} />}
    >
      {paidView && <PaymentReturn kind="paid" message={`Paid ${usd(paidView.priceCents ?? 0)}${paidView.test ? " (test)" : ""}`} description="Your scan date is locked in. We emailed the details." strip={["paid", "session_id"]} />}
      {canceledView && (
        <>
          <PaymentReturn kind="canceled" message="Nothing was charged" strip={["canceled"]} />
          <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-scan/30 bg-scan-soft px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="t-card">Nothing was charged</p>
              <p className="t-small">You left Stripe before paying. Paying locks in your date.</p>
            </div>
            <ScanPayButton id={canceledView.id} priceCents={canceledView.priceCents!} />
          </div>
        </>
      )}
      {!s.enabled && (
        <EmptyState
          dab="var(--af-scan)"
          title="Painting scans are coming soon"
          body={<>Phone photo too small for big prints? We&apos;ll scan the original in NYC and put the file straight onto your artwork. {waiting ? "You're on the list. We'll email you when it opens." : "Leave your email and we'll tell you the day it opens."}</>}
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
        justPaid={justPaid}
        settings={{ bands: s.bands, pickupFeeCents: s.pickupFeeCents, turnaroundDays: s.turnaroundDays, returnDays: s.returnDays, care: careTextFor(s), testMode: !process.env.STRIPE_SECRET_KEY }}
      />
    </StudioPage>
  );
}
