import Link from "next/link";
import type { Metadata } from "next";
import { Download, PenLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import FollowersTabs from "@/components/followers/FollowersTabs";
import FollowerImport from "@/components/followers/FollowerImport";
import SortedList from "@/components/crm/SortedList";
import { EmptyState } from "@/components/studio/EmptyState";
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
  const [counts, rows, total] = await Promise.all([
    followerCounts(artist.id),
    prisma.follower.findMany({ where, orderBy: { createdAt: "desc" }, take: SHOW }),
    prisma.follower.count({ where }),
  ]);
  const all = counts.confirmed + counts.pending + counts.unsubscribed;
  const any = all > 0;
  const countFor: Record<Filter, number> = { all, confirmed: counts.confirmed, pending: counts.pending, unsubscribed: counts.unsubscribed };

  const filterNav = (
    <nav aria-label="Filter" className="flex flex-wrap gap-1.5">
      {FILTERS.map((f) => (
        <Link
          key={f.id}
          href={f.id === "all" ? "/studio/followers" : `/studio/followers?show=${f.id}`}
          aria-current={show === f.id ? "true" : undefined}
          className={cn("btn btn-sm min-h-[40px] px-3.5 md:min-h-0", show === f.id ? "bg-ink text-white" : "btn-ghost")}
        >
          {f.label} <span className="num font-normal opacity-70">{countFor[f.id]}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <StudioPage
      title="Followers"
      sub={counts.confirmed ? `${counts.confirmed} ${counts.confirmed === 1 ? "person gets" : "people get"} your new work by email.` : "People who want your new work by email."}
      actions={
        <Link href="/studio/newsletter" className={cn("btn btn-sm min-h-[44px] md:min-h-0", any ? "btn-blue" : "btn-ghost")}>
          <PenLine className="h-4 w-4" aria-hidden="true" />Write a newsletter
        </Link>
      }
    >
      <FollowersTabs active="/studio/followers" />

      {!any ? (
        <EmptyState
          title="No followers yet"
          body={<>People who tap <b>Follow</b> on your page, or tick the box at checkout, land here. Put your link in your bio to start.</>}
          action={{ label: "Share your follow link", href: "/studio/links" }}
          secondary={artist.slug ? { label: "See your Follow button", href: artistPath(artist.slug) } : undefined}
          help={{ label: "How followers work", href: "/help/growing/followers-newsletter" }}
        />
      ) : (
        <section aria-label="Your list" className="grid gap-3">
          {rows.length === 0 ? (
            <>
            {filterNav}
            <EmptyState
              compact
              title={show === "pending" ? "Nobody waiting to confirm" : show === "unsubscribed" ? "Nobody has unsubscribed" : "No confirmed followers yet"}
              body={
                show === "pending"
                  ? "Anyone who hasn't clicked our confirm email yet shows up here."
                  : show === "unsubscribed"
                    ? "Good news. Anyone who leaves your list shows up here."
                    : "Followers count once they click the link in our welcome email."
              }
              action={{ label: "See everyone", href: "/studio/followers" }}
            />
            </>
          ) : (
            <SortedList
              storageKey="followers"
              toolbar={filterNav}
              listClassName="af-panel grid divide-y divide-line"
              listLabel="Followers"
              options={[
                { value: "newest", label: "Newest", by: "joined", desc: true },
                { value: "name", label: "A–Z", by: "name" },
                { value: "source", label: "Where they joined", by: "source" },
              ]}
              items={rows.map((f) => {
                const status = f.unsubscribedAt ? "Unsubscribed" : f.confirmedAt ? "Confirmed" : "Pending";
                return { id: f.id, sort: { joined: f.createdAt.getTime(), name: (f.name || f.email).toLowerCase(), source: SOURCE[f.source] ?? f.source }, node: (
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
                ) };
              })}
            />
          )}
          {total > SHOW && <p className="text-[13px] text-ink-2">Showing the newest {SHOW} of {total}. Export CSV for all of them.</p>}
        </section>
      )}

      <FollowerImport defaultOpen={!any} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px] font-semibold text-ink-2 [&>*]:inline-flex [&>*]:min-h-[40px] [&>*]:items-center">
        {any && (
          <a href="/api/studio/followers" download className="gap-1.5 hover:text-ink">
            <Download className="h-4 w-4" aria-hidden="true" />Export CSV
          </a>
        )}
        <Link href="/help/growing/followers-newsletter" className="underline underline-offset-2 hover:text-ink">How followers work</Link>
      </div>
    </StudioPage>
  );
}
