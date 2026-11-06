import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { earliestRestore, parseDetails } from "@/lib/reports";
import { adminOrRedirect } from "../_components/gate";
import { PageHead } from "../_components/ui";
import ReportsQueue, { type ReportRow } from "./ReportsQueue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports" };

const TABS = [
  { id: "queue", label: "To review", status: ["open"] },
  { id: "removed", label: "Taken down", status: ["removed"] },
  { id: "closed", label: "Dismissed or restored", status: ["dismissed", "restored"] },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function ReportsPage({ searchParams }: { searchParams: { tab?: string } }) {
  await adminOrRedirect("/admin/reports");
  const tab = TABS.find((t) => t.id === searchParams.tab) ?? TABS[0];

  const [open, removed, closed] = await Promise.all(TABS.map((t) => prisma.artReport.count({ where: { status: { in: [...t.status] } } })));
  const counts: Record<TabId, number> = { queue: open, removed, closed };

  const rows = await prisma.artReport.findMany({
    where: { status: { in: [...tab.status] } },
    orderBy: { createdAt: tab.id === "queue" ? "asc" : "desc" },
    take: 200,
    include: {
      artwork: {
        select: { id: true, slug: true, title: true, imageUrl: true, status: true, artistId: true, artist: { select: { slug: true, artist_name: true, name: true, email: true } } },
      },
    },
  });

  // Repeat-infringer signal: copyright takedowns per artist.
  const artistIds = Array.from(new Set(rows.map((r) => r.artwork?.artistId).filter(Boolean))) as string[];
  const strikes = new Map<string, number>();
  if (artistIds.length) {
    const removedCopyright = await prisma.artReport.findMany({
      where: { status: "removed", reason: "copyright", artwork: { artistId: { in: artistIds } } },
      select: { artworkId: true, artwork: { select: { artistId: true } } },
      distinct: ["artworkId"],
    });
    for (const r of removedCopyright) if (r.artwork) strikes.set(r.artwork.artistId, (strikes.get(r.artwork.artistId) ?? 0) + 1);
  }

  const items: ReportRow[] = rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    notice: parseDetails(r.details),
    name: r.name,
    email: r.email,
    isRightsHolder: r.isRightsHolder,
    status: r.status,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    restoreAfter: r.reason === "counter" ? earliestRestore(r.createdAt).toISOString() : null,
    artworkUrl: r.artworkUrl,
    art: r.artwork
      ? {
          slug: r.artwork.slug,
          title: r.artwork.title,
          imageUrl: r.artwork.imageUrl,
          status: r.artwork.status,
          artistName: r.artwork.artist.artist_name || r.artwork.artist.name,
          artistSlug: r.artwork.artist.slug,
          artistEmail: r.artwork.artist.email,
          strikes: strikes.get(r.artwork.artistId) ?? 0,
        }
      : null,
  }));

  return (
    <div className="grid gap-5">
      <PageHead title="Reports" sub={`${open === 0 ? "All clear" : `${open} waiting`} · reply within 2 business days`} />

      <nav aria-label="Report views" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "queue" ? "/admin/reports" : `/admin/reports?tab=${t.id}`}
            aria-current={tab.id === t.id ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[40px] items-center rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold no-underline transition",
              tab.id === t.id ? "border-ink bg-ink text-white" : "border-edge-strong bg-white text-ink hover:border-ink"
            )}
          >
            {t.label} <span className="num ml-1 opacity-70">{counts[t.id]}</span>
          </Link>
        ))}
      </nav>

      <ReportsQueue key={tab.id} rows={items} tab={tab.id} />
    </div>
  );
}
