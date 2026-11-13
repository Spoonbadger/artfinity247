import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../_components/gate";
import { day } from "../_components/util";
import { PageHead, Pill, type Tone } from "../_components/ui";
import { DataTable, type Row } from "../_components/table";
import { EmptyState } from "@/components/studio/EmptyState";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artworks" };

const STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "In review", tone: "amber" },
  APPROVED: { label: "Live", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
};

export default async function AdminArtworksPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  await adminOrRedirect("/admin/artworks");
  const q = searchParams.q?.trim() || "";
  const status = ["PENDING", "APPROVED", "REJECTED"].includes(searchParams.status || "") ? (searchParams.status as "PENDING" | "APPROVED" | "REJECTED") : null;
  const where: Prisma.ArtworkWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }, { artist: { OR: [{ artist_name: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.artwork.findMany({
      where, orderBy: { createdAt: "desc" }, take: 1000,
      select: { id: true, title: true, slug: true, imageUrl: true, status: true, createdAt: true, flaggedReason: true, editionSize: true, artist: { select: { id: true, slug: true, artist_name: true, name: true } }, _count: { select: { OrderItem: { where: { order: { paymentStatus: "paid" } } } } } },
    }),
    prisma.artwork.count({ where }),
  ]);
  const tableRows: Row[] = rows.map((w) => ({
    id: w.id,
    status: w.status,
    date: w.createdAt.toISOString(),
    search: `${w.title} ${w.slug ?? ""} ${w.artist.artist_name ?? ""} ${w.artist.name} ${w.artist.slug}`,
    sort: { title: w.title.toLowerCase(), artist: (w.artist.artist_name || w.artist.name).toLowerCase(), status: STATUS[w.status].label, sold: w._count.OrderItem, date: w.createdAt.toISOString() },
    cells: {
      title: (
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={w.imageUrl} alt="" loading="lazy" className="h-[50px] w-[40px] shrink-0 rounded-[3px] object-cover" />
          <div className="min-w-0">
            <Link href={`/admin/artworks/${w.id}/edit`} className="block truncate font-semibold text-ink hover:text-scan">{w.title}</Link>
            {w.flaggedReason && <span className="block truncate text-[13px] text-coral">{w.flaggedReason}</span>}
          </div>
        </div>
      ),
      artist: <Link href={`/admin/artists/${w.artist.id}`} className="text-ink hover:text-scan">{w.artist.artist_name || w.artist.name}</Link>,
      status: <Pill tone={STATUS[w.status].tone}>{STATUS[w.status].label}</Pill>,
      sold: <>{w._count.OrderItem}{w.editionSize ? <span className="text-ink-2"> /{w.editionSize}</span> : null}</>,
      date: day(w.createdAt),
    },
  }));

  return (
    <div className="grid gap-5">
      <PageHead
        title="Artworks"
        sub={`${total} ${total === 1 ? "piece" : "pieces"}${total > rows.length ? `, newest ${rows.length} shown` : ""}`}
        action={<Link href="/admin/moderation" className="btn btn-ghost btn-sm">Moderation queue</Link>}
      />
      <DataTable
        id="artworks"
        caption="Artworks"
        minWidth={680}
        defaultSort={{ key: "date", dir: "desc" }}
        search="Title, slug or artist"
        statuses={[{ value: "APPROVED", label: "Live" }, { value: "PENDING", label: "In review" }, { value: "REJECTED", label: "Rejected" }]}
        dates
        columns={[
          { key: "title", label: "Artwork" },
          { key: "artist", label: "Artist" },
          { key: "status", label: "Status" },
          { key: "sold", label: "Sold", align: "right" },
          { key: "date", label: "Uploaded", align: "right" },
        ]}
        rows={tableRows}
        empty={<EmptyState dab="var(--af-edge-strong)" title="No artworks yet" body="Uploads from artists show up here." />}
      />
    </div>
  );
}
