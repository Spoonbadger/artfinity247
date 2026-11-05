import Link from "next/link";
import type { Metadata } from "next";
import { Download, PenLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PaintChip } from "@/components/af/Brush";
import { StudioPage } from "@/components/studio/StudioPage";
import HelpLink from "@/components/help/HelpLink";
import FollowersTabs from "@/components/followers/FollowersTabs";
import FollowerImport from "@/components/followers/FollowerImport";
import { followerCounts } from "@/lib/followers";
import { artistPath } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Followers" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "confirmed", label: "Confirmed" },
  { id: "pending", label: "Pending" },
  { id: "unsubscribed", label: "Unsubscribed" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const SOURCE: Record<string, string> = { page: "Your page", checkout: "At checkout", links: "Links page", import: "Imported" };
const SHOW = 500;

export default async function FollowersPage({ searchParams }: { searchParams: { show?: string } }) {
  const artist = await requireArtist("/studio/followers");
  const show: Filter = (FILTERS.find((f) => f.id === searchParams.show)?.id ?? "all") as Filter;
  const where = {
    artistId: artist.id,
    ...(show === "confirmed" ? { confirmedAt: { not: null }, unsubscribedAt: null } : {}),
    ...(show === "pending" ? { confirmedAt: null, unsubscribedAt: null } : {}),
    ...(show === "unsubscribed" ? { unsubscribedAt: { not: null } } : {}),
  };
  const [counts, rows, total, fromCheckout] = await Promise.all([
    followerCounts(artist.id),
    prisma.follower.findMany({ where, orderBy: { createdAt: "desc" }, take: SHOW }),
    prisma.follower.count({ where }),
    prisma.follower.count({ where: { artistId: artist.id, source: "checkout", unsubscribedAt: null } }),
  ]);
  const any = counts.confirmed + counts.pending + counts.unsubscribed > 0;

  return (
    <StudioPage
      title="Followers"
      sub={counts.confirmed ? `${counts.confirmed} ${counts.confirmed === 1 ? "person gets" : "people get"} your new work by email. The list is yours.` : "People who want your new work, by email. The list is yours."}
      actions={
        <>
          <HelpLink href="/help/growing/followers-newsletter" />
          {any && (
            <a href="/api/studio/followers" download className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">
              <Download className="h-4 w-4" aria-hidden="true" />Export CSV
            </a>
          )}
          <Link href="/studio/newsletter" className="btn btn-blue btn-sm min-h-[44px] md:min-h-0">
            <PenLine className="h-4 w-4" aria-hidden="true" />Write a newsletter
          </Link>
        </>
      }
    >
      <FollowersTabs active="/studio/followers" />

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <PaintChip color="#2b37f0" value={counts.confirmed} label="confirmed" note="Ultramarine" />
        <PaintChip color="#ffd43b" value={counts.pending} label="waiting to confirm" note="Hansa yellow" />
        <PaintChip color="#c98a5a" value={fromCheckout} label="joined at checkout" note="Raw sienna" />
        <PaintChip color="#c9c4b8" value={counts.unsubscribed} label="unsubscribed" note="Paynes grey, thinned" />
      </section>

      {!any ? (
        <div className="grid justify-items-center gap-3 rounded-[4px] border-2 border-dashed border-line bg-wall px-6 py-14 text-center">
          <h2 className="display text-[34px]">No followers yet.</h2>
          <p className="max-w-[46ch] text-ink-2">The Follow button on your page, every buy page and your links page now collects emails. Buyers can tick a box at checkout too.</p>
          {artist.slug && <Link href={artistPath(artist.slug)} className="btn btn-blue">See your Follow button</Link>}
        </div>
      ) : (
        <section aria-labelledby="list-h" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="list-h" className="text-[20px] font-bold">Your list</h2>
            <nav aria-label="Filter" className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <Link
                  key={f.id}
                  href={f.id === "all" ? "/studio/followers" : `/studio/followers?show=${f.id}`}
                  aria-current={show === f.id ? "true" : undefined}
                  className={cn("btn btn-sm min-h-[40px] px-3.5 md:min-h-0", show === f.id ? "bg-ink text-white" : "btn-ghost")}
                >
                  {f.label}
                </Link>
              ))}
            </nav>
          </div>
          {rows.length === 0 ? (
            <p className="af-panel p-4 text-[14px] text-ink-2">Nobody here.</p>
          ) : (
            <ul className="af-panel grid divide-y divide-line">
              {rows.map((f) => {
                const status = f.unsubscribedAt ? "Unsubscribed" : f.confirmedAt ? "Confirmed" : "Pending";
                return (
                  <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_140px_110px_110px]">
                    <span className="min-w-0">
                      <b className="block truncate text-[15px]">{f.email}</b>
                      {f.name && <span className="block truncate text-[13px] text-ink-2">{f.name}</span>}
                    </span>
                    <span className="text-[13px] text-ink-2 sm:order-none">{SOURCE[f.source] ?? f.source}</span>
                    <span className={cn("text-[13px] font-semibold", f.unsubscribedAt ? "text-ink-2" : f.confirmedAt ? "text-earned" : "text-ink")}>
                      <i className="paint-dab mr-1.5 h-2.5 w-2.5 align-[-1px]" style={{ ["--dab" as string]: f.unsubscribedAt ? "#c9c4b8" : f.confirmedAt ? "var(--af-earned)" : "#ffd43b" }} aria-hidden="true" />
                      {status}
                    </span>
                    <span className="num text-right text-[13px] text-ink-2">{f.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {total > SHOW && <p className="text-[13px] text-ink-2">Showing the newest {SHOW} of {total}. Export CSV for all of them.</p>}
        </section>
      )}

      <FollowerImport />
    </StudioPage>
  );
}
