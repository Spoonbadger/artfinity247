import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../_components/gate";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artworks" };

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "In review", cls: "bg-sticker text-ink" },
  APPROVED: { label: "Live", cls: "bg-scan-soft text-scan" },
  REJECTED: { label: "Rejected", cls: "bg-coral/15 text-coral" },
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
      where, orderBy: { createdAt: "desc" }, take: 200,
      select: { id: true, title: true, slug: true, imageUrl: true, status: true, createdAt: true, flaggedReason: true, editionSize: true, artist: { select: { id: true, slug: true, artist_name: true, name: true } }, _count: { select: { OrderItem: { where: { order: { paymentStatus: "paid" } } } } } },
    }),
    prisma.artwork.count({ where }),
  ]);
  const field = "w-full min-w-0 min-h-[40px] rounded-lg border-[1.5px] border-line bg-white px-2.5 text-[14px] text-ink";

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">{total} {total === 1 ? "piece" : "pieces"}{total > rows.length ? `, newest ${rows.length} shown` : ""}</p>
        <h1 className="display text-[44px] sm:text-[56px]">Artworks</h1>
      </div>
      <form method="get" className="af-card flex flex-wrap items-end gap-3 p-4">
        <label className="grid min-w-[220px] flex-1 gap-1 text-[12.5px] font-semibold">Search
          <input name="q" defaultValue={q} placeholder="Title, slug or artist" className={field} />
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold">Status
          <select name="status" defaultValue={status || ""} className={field}>
            <option value="">Any</option><option value="APPROVED">Live</option><option value="PENDING">In review</option><option value="REJECTED">Rejected</option>
          </select>
        </label>
        <button type="submit" className="btn btn-blue btn-sm">Filter</button>
        {(q || status) && <Link href="/admin/artworks" className="btn btn-ghost btn-sm">Clear</Link>}
        <Link href="/admin/moderation" className="btn btn-ghost btn-sm ml-auto">Moderation queue →</Link>
      </form>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-4 py-14 text-center text-ink-2">No artworks match.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((w) => (
            <li key={w.id} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-line bg-white p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.imageUrl} alt="" loading="lazy" className="h-[80px] w-[64px] rounded-[3px] object-cover" />
              <div className="min-w-0 text-[13.5px]">
                <Link href={`/admin/artworks/${w.id}/edit`} className="block truncate text-[15px] font-semibold text-ink hover:text-scan">{w.title}</Link>
                <Link href={`/admin/artists/${w.artist.id}`} className="block truncate text-ink-2 hover:text-scan">{w.artist.artist_name || w.artist.name}</Link>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
                  <span className={cn("rounded-full px-2 py-px text-[11.5px] font-bold", STATUS[w.status].cls)}>{STATUS[w.status].label}</span>
                  {w._count.OrderItem} sold{w.editionSize ? ` · /${w.editionSize}` : ""} · {w.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                {w.flaggedReason && <span className="block truncate text-[11.5px] text-coral">{w.flaggedReason}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
