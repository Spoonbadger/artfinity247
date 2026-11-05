import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import RoomPicker from "@/components/rooms/RoomPicker";
import { RoomScene } from "@/components/rooms/RoomScene";
import { scenesForArt } from "@/lib/scenes/client";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rooms" };

export default async function RoomsPage({ searchParams }: { searchParams: { art?: string } }) {
  const want = typeof searchParams.art === "string" ? searchParams.art : "";
  const artist = await requireArtist(`/studio/rooms${want ? `?art=${encodeURIComponent(want)}` : ""}`);

  const rows = await prisma.artwork.findMany({
    where: { artistId: artist.id, slug: { not: null }, status: { not: "REJECTED" } },
    select: { slug: true, title: true, imageUrl: true, roomScenes: true, sensitive: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  const arts = rows.map((r) => ({ slug: r.slug as string, title: r.title, imageUrl: r.imageUrl, roomScenes: r.roomScenes ?? [], sensitive: r.sensitive ?? [], status: r.status }));

  if (!arts.length) {
    return (
      <StudioPage title="Rooms" sub="Your art, on real walls.">
        <div className="af-panel grid justify-items-start gap-3 p-6">
          <h2 className="display text-[28px]">No art yet</h2>
          <p className="text-[15px] text-ink-2">Upload a piece, then pick its rooms.</p>
          <Link href="/studio/art/new" className="btn btn-blue">Add art</Link>
        </div>
      </StudioPage>
    );
  }

  const art = arts.find((a) => a.slug === want);
  if (!art) {
    return (
      <StudioPage title="Rooms" sub="Pick the rooms buyers see your print in.">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {arts.map((a) => {
            const scenes = scenesForArt(a);
            return (
              <li key={a.slug}>
                <Link href={`/studio/rooms?art=${encodeURIComponent(a.slug)}`} className="af-card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(21,22,27,.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-scan">
                  <RoomScene scene={scenes[0]} slug={a.slug} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" imageUrl={a.imageUrl} size="large" frame="black" blur={a.sensitive.length > 0} />
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-bold">{a.title}</span>
                      <span className="text-[13px] text-ink-2">{a.roomScenes.length ? `${a.roomScenes.length} rooms picked` : "Auto rooms"}</span>
                    </span>
                    <span className="paint-dab" style={{ ["--dab" as string]: a.roomScenes.length ? "#0f7a55" : "#ffd43b" }} aria-hidden />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </StudioPage>
    );
  }

  return (
    <StudioPage title="Rooms" sub="Pick up to 5. Buyers see a different one each visit.">
      <RoomPicker art={art} arts={arts.map(({ slug, title, imageUrl }) => ({ slug, title, imageUrl }))} />
    </StudioPage>
  );
}
