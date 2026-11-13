// POST /api/reviews  { orderId, t, itemId, rating, body?, photoUrl?, name?, city? }
// A buyer reviews one item of their order from the signed link in the "how does it look?" email.
// Creates the review, or updates it within the 30-day edit window. Reviews with links or rough words are held as "flagged".
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { alertIfFlagged, canEdit, moderate, notifyArtistOfReview, reviewState, shortName, verifyReview } from "@/lib/reviews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY = 600;
const PHOTO_RE = /^(\/uploads\/reviews\/[\w-]+\/[\w-]+\.jpg|https:\/\/res\.cloudinary\.com\/[\w./-]+)$/;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const input = await req.json().catch(() => null);
  if (!input || typeof input !== "object") return bad("Send the review as JSON.");

  const orderId = typeof input.orderId === "string" ? input.orderId : "";
  if (!verifyReview(orderId, input.t)) return bad("This review link isn't valid. Use the button in your email.", 403);
  // Per link and per address: plenty for editing a few items, not enough to spam.
  if (!rateLimit(`review:${orderId}`, 20, 10 * 60_000) || !rateLimit(`review-ip:${ip}`, 40, 10 * 60_000)) {
    return bad("That's a lot of saves. Try again in a few minutes.", 429);
  }

  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad("Pick 1 to 5.");
  const body = String(input.body ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_BODY);
  const photoUrl = typeof input.photoUrl === "string" && input.photoUrl ? input.photoUrl : null;
  if (photoUrl && !PHOTO_RE.test(photoUrl)) return bad("That photo didn't upload properly. Try adding it again.");

  const item = await prisma.orderItem.findUnique({
    where: { id: String(input.itemId || "") },
    select: {
      id: true, orderId: true, artworkId: true,
      artwork: { select: { artistId: true } },
      order: { select: { kind: true, paymentStatus: true, shippingStatus: true, createdAt: true, shippingName: true } },
      review: { select: { id: true, createdAt: true, status: true } },
    },
  });
  if (!item || item.orderId !== orderId) return bad("That print isn't part of this order.", 404);
  if (!item.artwork) return bad("This piece is no longer listed, so it can't be reviewed.", 410);
  const state = reviewState(item.order);
  if (state === "never") return bad("This order can't be reviewed.", 403);
  if (state === "waiting") return bad("Your print is on its way. We'll ask once it arrives.", 409);

  const buyerName = shortName(typeof input.name === "string" && input.name.trim() ? input.name : item.order.shippingName);
  const buyerCity = typeof input.city === "string" && input.city.trim() ? input.city.trim().slice(0, 40) : null;
  const status = moderate(`${body} ${buyerName} ${buyerCity || ""}`);

  if (item.review) {
    if (!canEdit(item.review.createdAt)) return bad("Reviews can be changed for 30 days. This one is set now.", 403);
    // A review admin hid stays hidden when edited.
    const review = await prisma.review.update({
      where: { id: item.review.id },
      data: { rating, body, photoUrl, buyerName, buyerCity, status: item.review.status === "hidden" ? "hidden" : status },
      select: { id: true, status: true },
    });
    await alertIfFlagged({ ...review, rating, buyerName });
    return NextResponse.json({ ok: true, review, edited: true });
  }

  const review = await prisma.review.create({
    data: { orderItemId: item.id, artworkId: item.artworkId, artistId: item.artwork.artistId, rating, body, photoUrl, buyerName, buyerCity, status },
    select: { id: true, status: true },
  });
  await notifyArtistOfReview(review.id).catch((err) => console.error("Review email to artist failed", err));
  await alertIfFlagged({ ...review, rating, buyerName });
  return NextResponse.json({ ok: true, review, edited: false });
}
