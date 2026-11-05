import { ReactNode, Suspense } from "react";
import type { Metadata } from "next";
import StudioShell from "@/components/studio/StudioShell";
import { requireArtist, displayName, currentPath } from "./_lib/data";
import { getArtistPlan } from "@/components/pro/plan.server";
import SuspendedBanner from "./_lib/SuspendedBanner";
import VerifyEmailBanner from "./_lib/VerifyEmailBanner";
import BillingBanner from "./_lib/BillingBanner";
import ScanPayBanner from "./_lib/ScanPayBanner";
import { prisma } from "@/lib/prisma";
import { getBillingState } from "@/lib/billing";
import { isPaymentFailing } from "@/lib/billingStatus";
import { queueCount } from "@/lib/printQueue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio · Artfinity" },
  robots: { index: false, follow: false },
};

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const artist = await requireArtist();
  const [plan, billing, queued] = await Promise.all([getArtistPlan(artist.id), getBillingState(artist.id).catch(() => null), queueCount(artist.id)]);
  // A painting scan we confirmed that's waiting for payment (app/studio/scanning has its own pay button).
  const scanToPay = currentPath().startsWith("/studio/scanning")
    ? null
    : await prisma.scanBooking.findFirst({ where: { artistId: artist.id, status: "confirmed", priceCents: { gt: 0 } }, orderBy: { confirmedAt: "desc" }, select: { id: true, priceCents: true, scheduledFor: true } }).catch(() => null);
  return (
    <StudioShell artist={{ name: displayName(artist), slug: artist.slug, profileImage: artist.profileImage, pro: plan.active }} badges={{ "/studio/qr/queue": queued }}>
      {artist.suspendedAt && <SuspendedBanner since={artist.suspendedAt} reason={artist.suspendedReason} />}
      {isPaymentFailing(billing) && <BillingBanner until={plan.active ? plan.proUntil : null} />}
      {scanToPay && <ScanPayBanner id={scanToPay.id} priceCents={scanToPay.priceCents ?? 0} date={scanToPay.scheduledFor} />}
      <Suspense fallback={null}>
        <VerifyEmailBanner email={artist.email} verified={!!artist.emailVerifiedAt} />
      </Suspense>
      {children}
    </StudioShell>
  );
}
