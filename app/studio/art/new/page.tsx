import ArtworkForm from "@/components/studio/ArtworkForm";
import { StudioPage } from "@/components/studio/StudioPage";
import { requireArtist } from "../../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload art" };

export default async function NewArtPage() {
  await requireArtist("/studio/art/new");
  return (
    <StudioPage title="Upload art" sub="One piece, a few prices, done.">
      <ArtworkForm />
    </StudioPage>
  );
}
