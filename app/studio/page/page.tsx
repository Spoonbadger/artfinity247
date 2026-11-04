import ProfileEditor from "@/components/studio/ProfileEditor";
import { StudioPage } from "@/components/studio/StudioPage";
import { prisma } from "@/lib/prisma";
import { requireArtist, displayName } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "My page" };

export default async function MyPageEditor() {
  const artist = await requireArtist("/studio/page");
  const art = await prisma.artwork.findMany({
    where: { artistId: artist.id, status: { not: "REJECTED" } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, title: true, imageUrl: true, sensitive: true },
  });
  return (
    <StudioPage title="My page" sub="What buyers see when they scan.">
      <ProfileEditor
        initial={{ name: displayName(artist), city: artist.city || "", bio: artist.bio || "", profileImage: artist.profileImage, venmoHandle: artist.venmoHandle || "" }}
        slug={artist.slug}
        art={art}
      />
    </StudioPage>
  );
}
