import { StudioPage } from "@/components/studio/StudioPage";
import { Problem } from "@/components/studio/Problem";
import HelpLink from "@/components/help/HelpLink";
import VerifyPanel from "@/components/artist/VerifyPanel";
import { readEvidence } from "@/components/artist/verification";
import { prisma } from "@/lib/prisma";
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
  const status = v?.verification ?? "NONE";

  return (
    <StudioPage
      title={status === "VERIFIED" ? "Verified" : "Get verified"}
      sub="Buyers see a blue seal next to your name."
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
