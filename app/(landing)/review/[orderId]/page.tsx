// /review/[orderId]?t=<sig> — where the "how does it look on your wall?" email lands.
// The signed link stands in for a buyer account (lib/reviews.ts). Reviews open once the order is delivered,
// or shipped and two weeks old; until then the page just says the print is on its way.
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canEdit, cityFromAddress, reviewState, shortName, verifyReview } from "@/lib/reviews";
import { sizeWords } from "@/lib/artistEmails";
import { BrushStroke } from "@/components/af/Brush";
import ReviewForm, { type ReviewFormItem } from "@/components/reviews/ReviewForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leave a review", robots: { index: false, follow: false } };

type Props = { params: { orderId: string }; searchParams: { t?: string } };

function Note({ title, children, items }: { title: string; children: React.ReactNode; items?: { id: string; imageUrl: string; title: string }[] }) {
  return (
    <div className="mx-auto grid max-w-[520px] justify-items-center gap-4 px-4 py-16 text-center sm:py-24">
      {items && items.length > 0 && (
        <div className="flex justify-center -space-x-3 pb-2">
          {items.slice(0, 3).map((it, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={it.id} src={it.imageUrl} alt={it.title} className="h-24 w-[76px] rounded-[2px] border-4 border-white object-cover shadow-[0_10px_24px_-12px_rgba(21,22,27,.6)]" style={{ transform: `rotate(${[-5, 3, -2][i]}deg)` }} />
          ))}
        </div>
      )}
      <h1 className="t-page">{title}</h1>
      <div className="t-body text-ink-2">{children}</div>
    </div>
  );
}

export default async function ReviewPage({ params, searchParams }: Props) {
  const orderId = params.orderId;
  const ok = verifyReview(orderId, searchParams.t);
  const order = ok
    ? await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true, kind: true, paymentStatus: true, shippingStatus: true, createdAt: true, shippingName: true, shippingAddress: true,
          items: {
            orderBy: { id: "asc" },
            select: {
              id: true, title: true, imageUrl: true, artistName: true, size: true,
              artwork: { select: { title: true, imageUrl: true, artist: { select: { slug: true, artist_name: true, name: true } } } },
              review: { select: { rating: true, body: true, photoUrl: true, status: true, createdAt: true } },
            },
          },
        },
      })
    : null;

  if (!order) {
    return (
      <Note title="This link doesn't look right">
        <p>Use the button in your email from Artfinity. If it still won&apos;t open, <Link href="/contact" className="font-semibold text-ink underline underline-offset-4">write to us</Link> and we&apos;ll sort it.</p>
      </Note>
    );
  }

  const thumbs = order.items.map((i) => ({ id: i.id, imageUrl: i.artwork?.imageUrl || i.imageUrl || "", title: i.artwork?.title || i.title || "Your print" }));
  const state = reviewState(order);
  if (state === "never") {
    return <Note title="Nothing to review here">This order doesn&apos;t take reviews.</Note>;
  }
  if (state === "waiting") {
    return (
      <Note title="Your print is on its way" items={thumbs}>
        <p>We&apos;ll ask once it arrives.</p>
      </Note>
    );
  }

  const items: ReviewFormItem[] = order.items.map((i) => ({
    id: i.id,
    title: i.artwork?.title || i.title || "Your print",
    imageUrl: i.artwork?.imageUrl || i.imageUrl || "",
    sizeLabel: sizeWords(i.size).split(",")[0],
    artistName: i.artwork ? i.artwork.artist.artist_name || i.artwork.artist.name : i.artistName || "the artist",
    artistSlug: i.artwork?.artist.slug ?? null,
    listed: !!i.artwork,
    existing: i.review
      ? { rating: i.review.rating, body: i.review.body, photoUrl: i.review.photoUrl, status: i.review.status, editable: canEdit(i.review.createdAt) }
      : null,
  }));
  const first = shortName(order.shippingName, "").split(" ")[0];
  const reviewed = items.filter((i) => i.existing).length;

  return (
    <div className="bg-wall">
      <div className="mx-auto grid max-w-[620px] gap-6 px-4 pb-20 pt-8 sm:pt-12">
        <header className="grid gap-2">
          <span className="eyebrow">{reviewed && reviewed === items.length ? "Thanks for reviewing" : "Verified buyer"}</span>
          <h1 className="t-page">
            {first ? `${first}, how` : "How"} does it look on your{" "}
            <span className="relative z-0 whitespace-nowrap">
              wall?
              <BrushStroke className="absolute -bottom-1 -left-1 -z-10 h-3 w-[calc(100%+8px)]" />
            </span>
          </h1>
          <p className="t-body mt-1 text-ink-2">
            {items.length > 1 ? "Rate each print. " : ""}A few words or a photo helps the artist more than you&apos;d think.
          </p>
        </header>

        <ReviewForm
          orderId={order.id}
          token={String(searchParams.t)}
          items={items}
          defaultName={order.shippingName?.trim() || ""}
          defaultCity={cityFromAddress(order.shippingAddress)}
        />
      </div>
    </div>
  );
}
