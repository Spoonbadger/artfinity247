// Sort and filter choices for the public lists. No server imports, so client controls can use them too.
import { basePrices } from "@/lib/artwork_price";

export type ArtSort = "newest" | "popular" | "price-asc" | "price-desc";
export const ART_SORTS: { value: ArtSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];
export const artSort = (v: string | undefined): ArtSort => (ART_SORTS.some((s) => s.value === v) ? (v as ArtSort) : "newest");

/** Price filter on the "from" price (the smallest print). Bounds in cents. */
export const PRICE_BANDS = [
  { value: "under-50", label: "Under $50", max: 5000 },
  { value: "50-75", label: "$50 to $75", min: 5000, max: 7500 },
  { value: "75-up", label: "$75 and up", min: 7500 },
] as const satisfies readonly { value: string; label: string; min?: number; max?: number }[];
export type PriceBand = (typeof PRICE_BANDS)[number]["value"];
export const priceBand = (v: string | undefined) => PRICE_BANDS.find((b) => b.value === v);

export const PRINT_SIZE_KEYS = Object.keys(basePrices) as (keyof typeof basePrices)[];

export type ArtistSort = "popular" | "newest" | "az";
export const ARTIST_SORTS: { value: ArtistSort; label: string }[] = [
  { value: "popular", label: "Most work" },
  { value: "newest", label: "Newest" },
  { value: "az", label: "A to Z" },
];
export const artistSort = (v: string | undefined): ArtistSort => (ARTIST_SORTS.some((s) => s.value === v) ? (v as ArtistSort) : "popular");

