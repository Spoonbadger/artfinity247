// Pure review helpers and types, safe for client and server. Server queries live in lib/reviews.ts.

/** A published review as the public components need it. Dates are ISO strings so it can cross into client components. */
export type PublicReview = {
  id: string;
  rating: number;
  body: string;
  buyerName: string;
  buyerCity: string | null;
  photoUrl: string | null;
  createdAt: string;
  artistReply: string | null;
  artistReplyAt: string | null;
  artwork: { title: string; slug: string | null; imageUrl: string } | null;
};

export type ReviewSummary = { average: number; count: number };

export const RATING_WORDS = ["", "Not for me", "It's fine", "Good", "Love it", "Can't stop looking"] as const;

/** "sam rivera" -> "Sam R.", "Prince" -> "Prince". Never the full last name. */
export function shortName(full: string | null | undefined, fallback = "A buyer") {
  const parts = String(full || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (!parts.length) return fallback;
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const first = cap(parts[0]).slice(0, 30);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

/** "Oct 2026" */
export function reviewMonth(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** "4.8" (one decimal, no trailing ".0" on whole numbers above 0). */
export function ratingLabel(avg: number) {
  return avg ? avg.toFixed(1) : "0";
}
