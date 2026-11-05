"use client";

// /studio/rooms with no piece picked: every piece as it hangs in its first room, with a sort.
import Link from "next/link";
import { RoomScene } from "@/components/rooms/RoomScene";
import { scenesForArt } from "@/lib/scenes/client";
import { SortMenu, useSortPref, type SortOption } from "./SortMenu";

export type RoomsArt = { slug: string; title: string; imageUrl: string; roomScenes: number[]; sensitive: string[]; status: string; createdAt: string };

type SortKey = "newest" | "title" | "auto";
const SORTS: SortOption<SortKey>[] = [
  { value: "newest", label: "Newest" },
  { value: "title", label: "Title A–Z" },
  { value: "auto", label: "Not picked yet" },
];

export default function RoomsIndex({ arts }: { arts: RoomsArt[] }) {
  const [sort, setSort] = useSortPref<SortKey>("studio-rooms", "newest", SORTS.map((s) => s.value));
  const list = [...arts].sort((a, b) =>
    sort === "title" ? a.title.localeCompare(b.title, "en", { sensitivity: "base" })
    : sort === "auto" ? a.roomScenes.length - b.roomScenes.length || b.createdAt.localeCompare(a.createdAt)
    : b.createdAt.localeCompare(a.createdAt),
  );
  return (
    <div className="grid gap-4">
      {arts.length > 1 && <div><SortMenu label="Sort" value={sort} onChange={setSort} options={SORTS} /></div>}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => {
          const scenes = scenesForArt(a);
          return (
            <li key={a.slug}>
              <Link href={`/studio/rooms?art=${encodeURIComponent(a.slug)}`} className="af-card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(21,22,27,.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-scan motion-reduce:transition-none">
                <RoomScene scene={scenes[0]} slug={a.slug} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" imageUrl={a.imageUrl} size="large" frame="black" blur={a.sensitive.length > 0} />
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-bold">{a.title}</span>
                    <span className="text-[13px] text-ink-2">{a.roomScenes.length ? `${a.roomScenes.length} ${a.roomScenes.length === 1 ? "room" : "rooms"} picked` : "We pick for you"}</span>
                  </span>
                  <span className="text-[13.5px] font-bold text-scan">{a.roomScenes.length ? "Edit" : "Pick"}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
