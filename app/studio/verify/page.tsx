import { StudioPage } from "@/components/studio/StudioPage";
import { Problem } from "@/components/studio/Problem";
import HelpLink from "@/components/help/HelpLink";
import VerifyPanel from "@/components/artist/VerifyPanel";
import { readEvidence } from "@/components/artist/verification";
import { prisma } from "@/lib/prisma";
import { uploadReviewNote } from "@/lib/trust/artwork.server";
import { trustSettings } from "@/lib/trust/settings";
import { verifyCode } from "@/lib/trust/verifyCode";
import { instagramSignInAvailable } from "@/lib/trust/instagram";
import { requireArtist, displayName } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get verified" };

export default async function VerifyPage() {
  const artist = await requireArtist("/studio/verify");
  const [v, liveArt] = await Promise.all([
    prisma.artist.findUnique({
      where: { id: artist.id },
      select: { verification: true, verifiedAt: true, verificationRequestedAt: true, verificationEvidence: true, verificationNote: true },
    }),
    prisma.artwork.count({ where: { artistId: artist.id, status: { not: "REJECTED" } } }),
  ]);
  // Whether their uploads wait for a person today (lib/trust): verifying skips that.
  const [review, trust] = await Promise.all([uploadReviewNote(artist.id), trustSettings()]);
  const status = v?.verification ?? "NONE";

  return (
    <StudioPage
      title={status === "VERIFIED" ? "Verified" : "Get verified"}
      sub="A blue seal by your name tells buyers we checked you."
      actions={<HelpLink href="/help/trust/verification-badge" label="How verification works" />}
    >
      {liveArt === 0 && status !== "VERIFIED" && (
        <Problem tone="info" title="Add a piece first" fix={{ label: "Add your first piece", href: "/studio/art/new" }}>
          We check that the work is yours. You can still send this now.
        </Problem>
      )}
      <VerifyPanel
        name={displayName(artist)}
        slug={artist.slug}
        skipsReview={review.reviewed}
        auto={trust.autoVerify && trust.verifyReady ? { code: verifyCode(artist.id), minDays: trust.minAccountDays, instagram: instagramSignInAvailable() } : null}
        initial={{
          status,
          verifiedAt: v?.verifiedAt?.toISOString() ?? null,
          requestedAt: v?.verificationRequestedAt?.toISOString() ?? null,
          evidence: readEvidence(v?.verificationEvidence),
          note: v?.verificationNote ?? null,
        }}
      />
    </StudioPage>
  );
}
