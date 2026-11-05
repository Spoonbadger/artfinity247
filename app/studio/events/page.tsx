import EventsBoard from "@/components/studio/EventsBoard";
import { StudioPage } from "@/components/studio/StudioPage";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Events" };

export default async function EventsPage() {
  const artist = await requireArtist("/studio/events");
  const rows = await prisma.studioEvent.findMany({
    where: { artistId: artist.id },
    orderBy: [{ start: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, venue: true, start: true, end: true, createdAt: true },
  });
  const events = rows.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }));
  return (
    <StudioPage title="Events" sub="Markets, shows, open studios.">
      <EventsBoard initial={events} />
    </StudioPage>
  );
}
