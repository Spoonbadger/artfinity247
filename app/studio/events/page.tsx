import EventsBoard from "@/components/studio/EventsBoard";
import { StudioPage } from "@/components/studio/StudioPage";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Events" };

export default async function EventsPage() {
  await requireArtist("/studio/events");
  return (
    <StudioPage title="Events" sub="Markets, shows, open studios.">
      <EventsBoard />
    </StudioPage>
  );
}
