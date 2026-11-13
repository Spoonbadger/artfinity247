"use client";
// The artist page's Reviews tab: the summary stars, a remembered sort, then the list.
import ReviewStars from "@/components/reviews/ReviewStars";
import SortableReviews, { ReviewSortPill, useReviewSort } from "@/components/reviews/SortableReviews";
import type { PublicReview } from "@/components/reviews/format";

export default function ArtistReviews({ reviews, average, count, artistName }: { reviews: PublicReview[]; average: number; count: number; artistName: string }) {
  const [sort, setSort] = useReviewSort();
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReviewStars average={average} count={count} size="lg" />
        {reviews.length > 1 && <ReviewSortPill value={sort} onChange={setSort} />}
      </div>
      <SortableReviews reviews={reviews} sort={sort} artistName={artistName} showArtwork />
    </div>
  );
}
