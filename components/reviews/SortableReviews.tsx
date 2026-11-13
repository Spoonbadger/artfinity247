"use client";
// ReviewList with a sort menu (Newest, Oldest, Highest, Lowest, Photos first). The choice is remembered per browser.
import { useMemo } from "react";
import ReviewList from "./ReviewList";
import { SortMenu, useSortPref } from "@/components/studio/SortMenu";
import type { PublicReview } from "./format";

type SortKey = "newest" | "oldest" | "high" | "low" | "photos";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "high", label: "Highest rated" },
  { value: "low", label: "Lowest rated" },
  { value: "photos", label: "With photos first" },
];
const KEYS = SORTS.map((s) => s.value);

const time = (r: PublicReview) => new Date(r.createdAt).getTime() || 0;

export function sortReviews(list: PublicReview[], by: SortKey) {
  const out = [...list];
  const newest = (a: PublicReview, b: PublicReview) => time(b) - time(a);
  if (by === "oldest") out.sort((a, b) => time(a) - time(b));
  else if (by === "high") out.sort((a, b) => b.rating - a.rating || newest(a, b));
  else if (by === "low") out.sort((a, b) => a.rating - b.rating || newest(a, b));
  else if (by === "photos") out.sort((a, b) => Number(!!b.photoUrl) - Number(!!a.photoUrl) || newest(a, b));
  else out.sort(newest);
  return out;
}

/** The sort pill on its own, for a section header; pair with `useReviewSort`. */
export function useReviewSort() {
  return useSortPref<SortKey>("buyer.reviews", "newest", KEYS);
}

export function ReviewSortPill({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  return <SortMenu label="Sort reviews" value={value} onChange={onChange} options={SORTS} />;
}

export default function SortableReviews({ reviews, sort, ...rest }: React.ComponentProps<typeof ReviewList> & { sort: SortKey }) {
  const sorted = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);
  return <ReviewList reviews={sorted} {...rest} />;
}
