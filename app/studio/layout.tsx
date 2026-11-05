import { ReactNode, Suspense } from "react";
import type { Metadata } from "next";
import StudioShell from "@/components/studio/StudioShell";
import { requireArtist, displayName } from "./_lib/data";
import { getArtistPlan } from "@/components/pro/plan.server";
import SuspendedBanner from "./_lib/SuspendedBanner";
import VerifyEmailBanner from "./_lib/VerifyEmailBanner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio · Artfinity" },
  robots: { index: false, follow: false },
};

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const artist = await requireArtist();
  const plan = await getArtistPlan(artist.id);
  return (
    <StudioShell artist={{ name: displayName(artist), slug: artist.slug, profileImage: artist.profileImage, pro: plan.active }}>
      {artist.suspendedAt && <SuspendedBanner since={artist.suspendedAt} reason={artist.suspendedReason} />}
      <Suspense fallback={null}>
        <VerifyEmailBanner email={artist.email} verified={!!artist.emailVerifiedAt} />
      </Suspense>
      {children}
    </StudioShell>
  );
}
