import Link from "next/link";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import { Problem } from "@/components/studio/Problem";
import { Dabs } from "@/components/reviews/ReviewStars";
import ReplyBox from "@/components/reviews/ReplyBox";
import SortedList from "@/components/crm/SortedList";
import { RATING_WORDS, ratingLabel, reviewMonth } from "@/components/reviews/format";
import { prisma } from "@/lib/prisma";
import { artPath } from "@/lib/urls";
import { getReviewSummary } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "reply", label: "Needs a reply" },
  { id: "photos", label: "With photos" },
] as const;

export default async function StudioReviewsPage({ searchParams }: { searchParams: { show?: string } }) {
  const artist = await requireArtist("/studio/reviews");
  const show = FILTERS.find((f) => f.id === searchParams.show)?.id ?? "all";
  const base = { artistId: artist.id, status: "published" };

  const [summary, needsReply, withPhotos, held, reviews] = await Promise.all([
    getReviewSummary({ artistId: artist.id }),
    prisma.review.count({ where: { ...base, artistReply: null } }),
    prisma.review.count({ where: { ...base, photoUrl: { not: null } } }),
    prisma.review.count({ where: { artistId: artist.id, status: "flagged" } }),
    prisma.review.findMany({
      where: { ...base, ...(show === "reply" ? { artistReply: null } : show === "photos" ? { photoUrl: { not: null } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, rating: true, body: true, buyerName: true, buyerCity: true, photoUrl: true, createdAt: true, artistReply: true,
        artwork: { select: { title: true, slug: true, imageUrl: true } },
      },
    }),
  ]);

  const counts: Record<string, number> = { all: summary.count, reply: needsReply, photos: withPhotos };
  const filterNav = (
    <nav aria-label="Filter reviews" className="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <Link
          key={f.id}
          href={f.id === "all" ? "/studio/reviews" : `/studio/reviews?show=${f.id}`}
          aria-current={show === f.id ? "page" : undefined}
          className={cn(
            "inline-flex min-h-[40px] items-center rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold no-underline transition",
            show === f.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
          )}
        >
          {f.label}
          <span className="num ml-1.5 font-normal opacity-70">{counts[f.id]}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <StudioPage
      title="Reviews"
      sub={summary.count ? `${ratingLabel(summary.average)} average from ${summary.count} ${summary.count === 1 ? "review" : "reviews"}. Reply once to each.` : undefined}
      actions={summary.count ? <Link href={`/@${artist.slug}#reviews`} className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">See them on my page</Link> : undefined}
    >
      {summary.count === 0 ? (
        <>
          <EmptyState
            title="No reviews yet"
            body={
              <>
                Buyers get a review link when their print arrives. Their words and wall photos land here.
                {held > 0 && <> {held === 1 ? "One is" : `${held} are`} already in, waiting on a quick check by us.</>}
              </>
            }
            action={{ label: "Edit the delivery email", href: "/studio/emails" }}
            help={{ label: "How reviews work", href: "/help/growing/reviews" }}
          />
        </>
      ) : (
        <>
          {held > 0 && (
            <Problem tone="info" title={`${held === 1 ? "1 review is" : `${held} reviews are`} waiting on a quick check by Artfinity`} fix={{ label: "How checks work", href: "/help/growing/reviews" }}>
              It had a link or rough language. Nothing for you to do. It shows up here within a day.
            </Problem>
          )}

          {reviews.length === 0 && filterNav}
          {reviews.length === 0 ? (
            show === "reply" ? (
              <EmptyState
                compact
                title="You've replied to everyone"
                body="Nice. New reviews that need a reply show up here."
                action={{ label: "See all reviews", href: "/studio/reviews" }}
                secondary={{ label: "See them on my page", href: `/@${artist.slug}#reviews` }}
              />
            ) : (
              <EmptyState
                compact
                title="No wall photos yet"
                body="Reviews that come with a wall photo show up here."
                action={{ label: "See all reviews", href: "/studio/reviews" }}
                help={{ label: "How reviews work", href: "/help/growing/reviews" }}
              />
            )
          ) : (
            <SortedList
              storageKey="studio.reviews"
              toolbar={filterNav}
              listClassName="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2"
              listLabel="Reviews"
              options={[
                { value: "newest", label: "Newest", by: "date", desc: true },
                { value: "high", label: "Highest rated", by: "rating", desc: true },
                { value: "low", label: "Lowest rated", by: "rating" },
                { value: "reply", label: "Needs a reply first", by: "replied" },
              ]}
              items={reviews.map((r) => ({ id: r.id, sort: { date: r.createdAt.getTime(), rating: r.rating, replied: r.artistReply ? 1 : 0 }, node: (
                <li key={r.id} className="af-panel grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    {r.artwork && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.artwork.imageUrl} alt="" className="h-14 w-11 shrink-0 rounded-[2px] object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Dabs value={r.rating} size="sm" />
                        <span className="t-small font-semibold">{RATING_WORDS[r.rating]}</span>
                      </div>
                      <p className="t-small mt-1 truncate">
                        <b className="font-semibold text-ink">{r.buyerName}</b>
                        {r.buyerCity ? ` · ${r.buyerCity}` : ""} · {reviewMonth(r.createdAt)}
                        {r.artwork ? <> · {r.artwork.slug ? <Link href={artPath(artist.slug, r.artwork.slug)} className="text-ink-2 hover:text-scan">{r.artwork.title}</Link> : r.artwork.title}</> : null}
                      </p>
                    </div>
                  </div>
                  {r.body ? <p className="whitespace-pre-line text-[16px] leading-relaxed">{r.body}</p> : <p className="t-muted italic">Just the rating, no words.</p>}
                  {r.photoUrl && (
                    <a href={r.photoUrl} target="_blank" rel="noopener" className="block w-fit">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.photoUrl} alt={`${r.buyerName}'s wall`} className="h-36 w-auto max-w-full rotate-[-1deg] rounded-[3px] border-4 border-white object-cover shadow-[0_8px_20px_-10px_rgba(21,22,27,.5)]" />
                    </a>
                  )}
                  <ReplyBox reviewId={r.id} initial={r.artistReply} buyerFirst={r.buyerName.split(" ")[0]} />
                </li>
              ) }))}
            />
          )}
        </>
      )}
    </StudioPage>
  );
}
