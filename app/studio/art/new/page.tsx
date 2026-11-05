import NewArtwork from "@/components/studio/NewArtwork";
import { StudioPage } from "@/components/studio/StudioPage";
import { prisma } from "@/lib/prisma";
import { mockImportAllowed } from "@/lib/cloudImport/sources";
import { artistSplitNow, requireArtist } from "../../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload art" };

export default async function NewArtPage() {
  const artist = await requireArtist("/studio/art/new");
  const [split, count] = await Promise.all([artistSplitNow(artist.id), prisma.artwork.count({ where: { artistId: artist.id } })]);
  // A first upload stays one piece; after that the form also takes several files or a whole folder.
  const canQueue = count > 0;
  return (
    <StudioPage title="Upload art">
      {/* mockImport: the dev-only "Sample files" import button (ALLOW_MOCK_IMPORT=1, never in production). */}
      <NewArtwork split={split} handle={artist.slug} canQueue={canQueue} mockImport={mockImportAllowed()} />
    </StudioPage>
  );
}
