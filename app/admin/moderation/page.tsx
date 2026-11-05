import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../_components/gate";
import { cn } from "@/lib/utils";
import ModerationList, { type ModArtwork } from "../_components/ModerationList";
import { duplicateOfId, hamming } from "@/lib/imageHash";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Moderation" };

const TABS = [
  { id: "queue", label: "To review" },
  { id: "sensitive", label: "Sensitive" },
  { id: "rejected", label: "Rejected" },
  { id: "live", label: "Live" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function ModerationPage({ searchParams }: { searchParams: { tab?: string } }) {
  await adminOrRedirect("/admin/moderation");
  const tab: TabId = (TABS.find((t) => t.id === searchParams.tab)?.id ?? "queue") as TabId;

  const [queue, sensitive, rejected, live] = await Promise.all([
    prisma.artwork.count({ where: { OR: [{ status: "PENDING" }, { status: "APPROVED", flaggedReason: { not: null } }] } }),
    prisma.artwork.count({ where: { NOT: { sensitive: { isEmpty: true } } } }),
    prisma.artwork.count({ where: { status: "REJECTED" } }),
    prisma.artwork.count({ where: { status: "APPROVED" } }),
  ]);
  const counts: Record<TabId, number> = { queue, sensitive, rejected, live };

  const where =
    tab === "queue" ? { OR: [{ status: "PENDING" as const }, { status: "APPROVED" as const, flaggedReason: { not: null } }] }
    : tab === "sensitive" ? { NOT: { sensitive: { isEmpty: true } } }
    : tab === "rejected" ? { status: "REJECTED" as const }
    : { status: "APPROVED" as const };

  const rows = await prisma.artwork.findMany({
    where,
    orderBy: { createdAt: tab === "queue" ? "asc" : "desc" },
    take: 120,
    select: {
      id: true, title: true, slug: true, imageUrl: true, createdAt: true, status: true,
      sensitive: true, flaggedReason: true, description: true, imageHash: true,
      artist: { select: { slug: true, artist_name: true, name: true, email: true, createdAt: true, verification: true } },
    },
  });

  // Possible duplicates (lib/imageHash.ts): load the piece each one resembles, for the side-by-side.
  const dupIds = Array.from(new Set(rows.map((r) => duplicateOfId(r.flaggedReason)).filter((x): x is string => !!x)));
  const originals = dupIds.length
    ? await prisma.artwork.findMany({
        where: { id: { in: dupIds } },
        select: {
          id: true, title: true, slug: true, imageUrl: true, createdAt: true, status: true, imageHash: true,
          artist: { select: { slug: true, artist_name: true, name: true, email: true, createdAt: true, verification: true } },
        },
      })
    : [];
  const originalById = new Map(originals.map((o) => [o.id, o]));
  const since = (d: Date) => d.toISOString();

  const artworks: ModArtwork[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    imageUrl: r.imageUrl,
    createdAt: r.createdAt.toISOString(),
    status: r.status,
    sensitive: r.sensitive ?? [],
    flaggedReason: r.flaggedReason,
    description: r.description,
    artistName: r.artist.artist_name || r.artist.name,
    artistSlug: r.artist.slug,
    artistEmail: r.artist.email,
    artistSince: since(r.artist.createdAt),
    artistVerified: r.artist.verification === "VERIFIED",
    duplicateOf: (() => {
      const id = duplicateOfId(r.flaggedReason);
      if (!id) return null;
      const o = originalById.get(id);
      if (!o) return { id, missing: true as const };
      return {
        id: o.id,
        title: o.title,
        slug: o.slug,
        imageUrl: o.imageUrl,
        createdAt: since(o.createdAt),
        status: o.status,
        artistName: o.artist.artist_name || o.artist.name,
        artistSlug: o.artist.slug,
        artistEmail: o.artist.email,
        artistSince: since(o.artist.createdAt),
        artistVerified: o.artist.verification === "VERIFIED",
        distance: r.imageHash && o.imageHash ? hamming(r.imageHash, o.imageHash) : null,
      };
    })(),
  }));

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">{queue === 0 ? "All clear" : `${queue} waiting`}</p>
        <h1 className="display text-[44px] sm:text-[56px]">Moderation</h1>
      </div>

      <nav aria-label="Moderation views" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "queue" ? "/admin/moderation" : `/admin/moderation?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "rounded-full border-[1.5px] px-3.5 py-1.5 text-[14px] font-semibold no-underline transition",
              tab === t.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
            )}
          >
            {t.label} <span className="num ml-1 opacity-70">{counts[t.id]}</span>
          </Link>
        ))}
      </nav>

      <ModerationList key={tab} artworks={artworks} tab={tab} />
    </div>
  );
}
