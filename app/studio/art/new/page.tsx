import ArtworkForm from "@/components/studio/ArtworkForm";
import { StudioPage } from "@/components/studio/StudioPage";
import { artistSplitNow, requireArtist } from "../../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload art" };

export default async function NewArtPage() {
  const artist = await requireArtist("/studio/art/new");
  const split = await artistSplitNow(artist.id);
  return (
    <StudioPage title="Upload art" sub="One piece, a few prices, done.">
      <ArtworkForm split={split} handle={artist.slug} />
    </StudioPage>
  );
}
