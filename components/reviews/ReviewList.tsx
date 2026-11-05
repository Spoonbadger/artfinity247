// Review cards: dabs, words, wall photo, "Verified buyer · Asheville · Oct 2026", and the artist's reply.
// No hooks, so it renders in server or client components. Extra reviews fold into a <details>, no JS needed.
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Dabs } from "./ReviewStars";
import { RATING_WORDS, reviewMonth, type PublicReview } from "./format";

function ReviewCard({ r, artistName, showArtwork }: { r: PublicReview; artistName?: string; showArtwork?: boolean }) {
  return (
    <li className="af-panel grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex shrink-0 items-center gap-2">
          <Dabs value={r.rating} size="sm" />
          <span className="sr-only">{r.rating} out of 5</span>
          <span className="whitespace-nowrap text-[13px] font-semibold text-ink-2">{RATING_WORDS[r.rating]}</span>
        </span>
        {showArtwork && r.artwork && (
          r.artwork.slug ? (
            <Link href={`/art/${r.artwork.slug}`} className="min-w-0 truncate text-[13px] font-semibold text-ink-2 no-underline hover:text-scan">{r.artwork.title}</Link>
          ) : (
            <span className="min-w-0 truncate text-[13px] font-semibold text-ink-2">{r.artwork.title}</span>
          )
        )}
      </div>

      {r.body && <p className="whitespace-pre-line text-[16px] leading-relaxed text-ink">{r.body}</p>}

      {r.photoUrl && (
        <a href={r.photoUrl} target="_blank" rel="noopener" className="block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={r.photoUrl}
            alt={`${r.buyerName}'s print${r.artwork ? ` of ${r.artwork.title}` : ""} on their wall`}
            loading="lazy"
            className="h-40 w-auto max-w-full rotate-[-1deg] rounded-[3px] border-4 border-white object-cover shadow-[0_8px_20px_-10px_rgba(21,22,27,.5)] sm:h-48"
          />
        </a>
      )}

      <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-2">
        <b className="font-semibold text-ink">{r.buyerName}</b>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1 font-semibold text-earned">
          <i className="paint-dab !h-2.5 !w-2.5" style={{ ["--dab" as string]: "var(--af-earned)" }} aria-hidden="true" />
          Verified buyer
        </span>
        {r.buyerCity && <><span aria-hidden="true">·</span><span>{r.buyerCity}</span></>}
        <span aria-hidden="true">·</span>
        <time dateTime={r.createdAt}>{reviewMonth(r.createdAt)}</time>
      </p>

      {r.artistReply && (
        <div className="relative ml-3 rounded-xl border-l-[3px] border-[color:var(--accent,var(--af-sticker))] bg-wall px-3.5 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">{artistName ? `${artistName} replied` : "The artist replied"}</p>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-ink">{r.artistReply}</p>
        </div>
      )}
    </li>
  );
}

export default function ReviewList({
  reviews,
  artistName,
  showArtwork = false,
  initial = 6,
  emptyText = "No reviews yet.",
  className,
}: {
  reviews: PublicReview[];
  /** Shown as "Maya Okafor replied" above replies. */
  artistName?: string;
  /** Show which artwork each review is about (artist page). Leave off on a single artwork's page. */
  showArtwork?: boolean;
  /** Cards shown before "More reviews". */
  initial?: number;
  emptyText?: string;
  className?: string;
}) {
  if (!reviews.length) return <p className={cn("text-[15px] text-ink-2", className)}>{emptyText}</p>;
  const first = reviews.slice(0, initial);
  const rest = reviews.slice(initial);
  const grid = "grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4";
  return (
    <div className={cn("grid gap-3 md:gap-4", className)}>
      <ul className={grid}>
        {first.map((r) => <ReviewCard key={r.id} r={r} artistName={artistName} showArtwork={showArtwork} />)}
      </ul>
      {rest.length > 0 && (
        <details className="group grid gap-3">
          <summary className="btn btn-ghost btn-sm w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">More reviews ({rest.length})</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className={cn(grid, "mt-3")}>
            {rest.map((r) => <ReviewCard key={r.id} r={r} artistName={artistName} showArtwork={showArtwork} />)}
          </ul>
        </details>
      )}
    </div>
  );
}
