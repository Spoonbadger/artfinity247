import { StudioPage } from "@/components/studio/StudioPage";
import HelpLink from "@/components/help/HelpLink";
import PlacesBoard, { type PlaceCard } from "@/components/places/PlacesBoard";
import { NewPlaceButton } from "@/components/places/PlaceForm";
import { placeList } from "@/lib/artistPlaces";
import { placeDates, placeStatus } from "@/lib/placeRules";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Places" };

export default async function PlacesPage() {
  const artist = await requireArtist("/studio/places");
  const [rows, venues] = await Promise.all([
    placeList(artist.id),
    prisma.venue.findMany({ where: { active: true }, select: { id: true, name: true, neighborhood: true }, orderBy: { name: "asc" } }),
  ]);
  const now = new Date();
  const places: PlaceCard[] = rows.map((p) => ({
    id: p.id, name: p.name, kind: p.kind, area: p.area, partner: p.venue?.name ?? null, createdAt: p.createdAt.toISOString(),
    status: placeStatus(p, now), dates: placeDates(p),
    paintings: p.paintings, codes: p.codes, liveCodes: p.liveCodes, scans: p.scans, scans30: p.scans30, sales: p.sales, sales30: p.sales30,
  }));
  return (
    <StudioPage
      title="Places"
      sub={places.length ? "Where your art hangs: cafés, galleries, markets, shows." : undefined}
      actions={<><HelpLink href="/help/qr-codes/places" /><NewPlaceButton partners={venues} /></>}
    >
      <PlacesBoard places={places} />
    </StudioPage>
  );
}
