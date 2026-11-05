import { StudioPage } from "@/components/studio/StudioPage";
import DesignEditor from "@/components/artist/DesignEditor";
import { parseTheme } from "@/components/artist/theme";
import { getArtistTrust } from "@/lib/artistTrust";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Design your page" };

export default async function DesignPage() {
  const artist = await requireArtist("/studio/design");
  const [row, works, trust] = await Promise.all([
    prisma.artist.findUnique({ where: { id: artist.id }, select: { pageTheme: true } }),
    prisma.artwork.findMany({
      where: { artistId: artist.id, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, imageUrl: true, sensitive: true },
    }),
    getArtistTrust(artist.id),
  ]);
  const theme = parseTheme(row?.pageTheme, works.map((w) => w.id));

  return (
    <StudioPage title="Design your page" sub="See changes in the preview before you save.">
      <DesignEditor slug={artist.slug} initial={theme} works={works.map((w) => ({ ...w, sensitive: w.sensitive ?? [] }))} hasMedal={!!trust.earned} />
    </StudioPage>
  );
}
