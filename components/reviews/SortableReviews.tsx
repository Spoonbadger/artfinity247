"use client";
// ReviewList with a sort menu (Newest, Oldest, Highest, Lowest, Photos first). The choice is remembered per browser.
import { useMemo } from "react";
import ReviewList from "./ReviewList";
import SortPill, { useSavedSort } from "@/components/art/SortPill";
import type { PublicReview } from "./format";

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "high", label: "Highest rated" },
  { key: "low", label: "Lowest rated" },
  { key: "photos", label: "With photos first" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];
const KEYS = SORTS.map((s) => s.key) as SortKey[];

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
  return useSavedSort<SortKey>("reviews", KEYS, "newest");
}

export function ReviewSortPill({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  return <SortPill options={[...SORTS]} value={value} onChange={onChange} />;
}

export default function SortableReviews({ reviews, sort, ...rest }: React.ComponentProps<typeof ReviewList> & { sort: SortKey }) {
  const sorted = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);
  return <ReviewList reviews={sorted} {...rest} />;
}
