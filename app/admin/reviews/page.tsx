import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { adminOrRedirect } from "../_components/gate";
import ReviewsAdmin, { type AdminReview } from "../_components/ReviewsAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reviews" };

const TABS = [
  { id: "all", label: "Held first" },
  { id: "hidden", label: "Hidden" },
] as const;

const select = {
  id: true, rating: true, body: true, buyerName: true, buyerCity: true, photoUrl: true, status: true, createdAt: true, artistReply: true,
  artwork: { select: { title: true, slug: true } },
  artist: { select: { slug: true, artist_name: true, name: true } },
  orderItem: { select: { orderId: true, order: { select: { email: true } } } },
} as const;

export default async function AdminReviewsPage({ searchParams }: { searchParams: { tab?: string } }) {
  await adminOrRedirect("/admin/reviews");
  const tab = TABS.find((t) => t.id === searchParams.tab)?.id ?? "all";

  const [flaggedCount, hiddenCount, flagged, rest] = await Promise.all([
    prisma.review.count({ where: { status: "flagged" } }),
    prisma.review.count({ where: { status: "hidden" } }),
    tab === "all" ? prisma.review.findMany({ where: { status: "flagged" }, orderBy: { createdAt: "asc" }, select }) : Promise.resolve([]),
    prisma.review.findMany({ where: tab === "hidden" ? { status: "hidden" } : { status: { not: "flagged" } }, orderBy: { createdAt: "desc" }, take: 150, select }),
  ]);

  const reviews: AdminReview[] = [...flagged, ...rest].map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    buyerName: r.buyerName,
    buyerCity: r.buyerCity,
    buyerEmail: r.orderItem.order.email,
    photoUrl: r.photoUrl,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    artistReply: r.artistReply,
    artworkTitle: r.artwork?.title ?? null,
    artworkSlug: r.artwork?.slug ?? null,
    artistName: r.artist.artist_name || r.artist.name,
    artistSlug: r.artist.slug,
    orderId: r.orderItem.orderId,
  }));

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">{flaggedCount === 0 ? "Nothing held" : `${flaggedCount} held for a look`}</p>
        <h1 className="display text-[44px] sm:text-[56px]">Reviews</h1>
        <p className="mt-1 text-[14px] text-ink-2">Reviews with a link or a word from the rough list wait here before they go up.</p>
      </div>
      <nav aria-label="Review views" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "all" ? "/admin/reviews" : `/admin/reviews?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "rounded-full border-[1.5px] px-3.5 py-1.5 text-[14px] font-semibold no-underline transition",
              tab === t.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
            )}
          >
            {t.label}
            {t.id === "hidden" ? <span className="num ml-1.5 opacity-70">{hiddenCount}</span> : flaggedCount > 0 ? <span className="num ml-1.5 rounded-full bg-coral px-1.5 text-[12px] text-white">{flaggedCount}</span> : null}
          </Link>
        ))}
      </nav>
      <ReviewsAdmin key={tab} reviews={reviews} />
    </div>
  );
}
