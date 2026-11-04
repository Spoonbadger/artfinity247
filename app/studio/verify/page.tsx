import { StudioPage } from "@/components/studio/StudioPage";
import VerifyPanel from "@/components/artist/VerifyPanel";
import { readEvidence } from "@/components/artist/verification";
import { prisma } from "@/lib/prisma";
import { requireArtist, displayName } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get verified" };

export default async function VerifyPage() {
  const artist = await requireArtist("/studio/verify");
  const v = await prisma.artist.findUnique({
    where: { id: artist.id },
    select: { verification: true, verifiedAt: true, verificationRequestedAt: true, verificationEvidence: true, verificationNote: true },
  });

  return (
    <StudioPage title="Get verified" sub={<>A real person at Artfinity checked this is you and your work.<br />Buyers see a blue seal next to your name.</>}>
      <VerifyPanel
        name={displayName(artist)}
        slug={artist.slug}
        initial={{
          status: v?.verification ?? "NONE",
          verifiedAt: v?.verifiedAt?.toISOString() ?? null,
          requestedAt: v?.verificationRequestedAt?.toISOString() ?? null,
          evidence: readEvidence(v?.verificationEvidence),
          note: v?.verificationNote ?? null,
        }}
      />
    </StudioPage>
  );
}
