import Link from "next/link";
import { PaintChip } from "@/components/af/Brush";
import { StudioPage } from "@/components/studio/StudioPage";
import { Dabs } from "@/components/reviews/ReviewStars";
import ReplyBox from "@/components/reviews/ReplyBox";
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

  return (
    <StudioPage
      title="Reviews"
      sub={summary.count ? `What buyers say once the print is on their wall. You can reply once to each.` : undefined}
      actions={summary.count ? <Link href={`/@${artist.slug}#reviews`} className="btn btn-ghost btn-sm">See them on my page</Link> : undefined}
    >
      {summary.count === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-[4px] border-2 border-dashed border-line bg-wall px-6 py-16 text-center">
          <h2 className="display text-[34px]">No reviews yet.</h2>
          <p className="max-w-[44ch] text-ink-2">When a print is delivered, we email the buyer and ask how it looks on their wall. Reviews show up here and on your page.</p>
        </div>
      ) : (
        <>
          <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <PaintChip color="#ffd43b" value={ratingLabel(summary.average)} label="average rating" note="Hansa yellow" />
            <PaintChip color="#e8743b" value={summary.count} label={summary.count === 1 ? "review" : "reviews"} note="Cadmium" />
            <PaintChip color="#5bc0be" value={withPhotos} label={withPhotos === 1 ? "wall photo" : "wall photos"} note="Phthalo turquoise" />
            <PaintChip color="#2b37f0" value={needsReply} label="waiting on a reply" note="Ultramarine" />
          </section>

          {held > 0 && (
            <p className="flex items-center gap-2 text-[14px] text-ink-2">
              <i className="paint-dab" style={{ ["--dab" as string]: "var(--af-coral)" }} aria-hidden="true" />
              {held === 1 ? "1 review is" : `${held} reviews are`} waiting on a quick check by Artfinity (it had a link or rough language).
            </p>
          )}

          <nav aria-label="Filter reviews" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                href={f.id === "all" ? "/studio/reviews" : `/studio/reviews?show=${f.id}`}
                aria-current={show === f.id ? "page" : undefined}
                className={cn(
                  "rounded-full border-[1.5px] px-3.5 py-1.5 text-[14px] font-semibold no-underline transition",
                  show === f.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
                )}
              >
                {f.label}
                {f.id === "reply" && needsReply > 0 && <span className="num ml-1.5 opacity-70">{needsReply}</span>}
              </Link>
            ))}
          </nav>

          {reviews.length === 0 ? (
            <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-ink-2">{show === "reply" ? "You've replied to everyone." : "Nothing here yet."}</p>
          ) : (
            <ul className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.id} className="af-panel grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    {r.artwork && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.artwork.imageUrl} alt="" className="h-14 w-11 shrink-0 rounded-[2px] object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Dabs value={r.rating} size="sm" />
                        <span className="text-[13px] font-semibold text-ink-2">{RATING_WORDS[r.rating]}</span>
                      </div>
                      <p className="mt-1 truncate text-[13.5px] text-ink-2">
                        <b className="font-semibold text-ink">{r.buyerName}</b>
                        {r.buyerCity ? ` · ${r.buyerCity}` : ""} · {reviewMonth(r.createdAt)}
                        {r.artwork ? <> · {r.artwork.slug ? <Link href={artPath(artist.slug, r.artwork.slug)} className="text-ink-2 hover:text-scan">{r.artwork.title}</Link> : r.artwork.title}</> : null}
                      </p>
                    </div>
                  </div>
                  {r.body ? <p className="whitespace-pre-line text-[16px] leading-relaxed">{r.body}</p> : <p className="text-[14px] italic text-ink-2">Just the rating, no words.</p>}
                  {r.photoUrl && (
                    <a href={r.photoUrl} target="_blank" rel="noopener" className="block w-fit">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.photoUrl} alt={`${r.buyerName}'s wall`} className="h-36 w-auto max-w-full rotate-[-1deg] rounded-[3px] border-4 border-white object-cover shadow-[0_8px_20px_-10px_rgba(21,22,27,.5)]" />
                    </a>
                  )}
                  <ReplyBox reviewId={r.id} initial={r.artistReply} buyerFirst={r.buyerName.split(" ")[0]} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </StudioPage>
  );
}
