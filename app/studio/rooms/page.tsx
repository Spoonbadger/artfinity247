import { EmptyState } from "@/components/studio/EmptyState";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import RoomPicker from "@/components/rooms/RoomPicker";
import RoomsIndex from "@/components/studio/RoomsIndex";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rooms" };

export default async function RoomsPage({ searchParams }: { searchParams: { art?: string } }) {
  const want = typeof searchParams.art === "string" ? searchParams.art : "";
  const artist = await requireArtist(`/studio/rooms${want ? `?art=${encodeURIComponent(want)}` : ""}`);

  const rows = await prisma.artwork.findMany({
    where: { artistId: artist.id, slug: { not: null }, status: { not: "REJECTED" } },
    select: { slug: true, title: true, imageUrl: true, roomScenes: true, sensitive: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const arts = rows.map((r) => ({ slug: r.slug as string, title: r.title, imageUrl: r.imageUrl, roomScenes: r.roomScenes ?? [], sensitive: r.sensitive ?? [], status: r.status, createdAt: r.createdAt.toISOString() }));

  if (!arts.length) {
    return (
      <StudioPage title="Rooms" sub="Your art, on real walls.">
        <EmptyState
          dab="#5bc0be"
          title="Upload art first"
          body="Buyers see each print on a real wall. We pick the rooms, or you can."
          action={{ label: "Upload art", href: "/studio/art/new" }}
        />
      </StudioPage>
    );
  }

  const art = arts.find((a) => a.slug === want);
  if (!art) {
    return (
      <StudioPage title="Rooms" sub="Pick the rooms buyers see each print in.">
        <RoomsIndex arts={arts} />
      </StudioPage>
    );
  }

  return (
    <StudioPage title="Rooms" sub="Pick up to 5. Buyers see a different one each visit.">
      <RoomPicker art={art} arts={arts.map(({ slug, title, imageUrl }) => ({ slug, title, imageUrl }))} />
    </StudioPage>
  );
}
