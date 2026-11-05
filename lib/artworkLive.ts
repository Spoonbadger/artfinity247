// What happens when a piece goes live (at upload, or when an admin approves it from review):
// the referral reward and the "your artwork is live" email with its QR download link. Server-only.
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { artUrl } from "@/lib/urls";
import { resend } from "@/lib/resend";
import { rewardReferralOnUpload } from "@/lib/referrals";
import ArtworkLiveWithQrEmail from "@/emails/ArtworkLiveWithQrEmail";
import ArtworksBatchLiveEmail from "@/emails/ArtworksBatchLiveEmail";
import NewArtworksBatchEmail from "@/emails/NewArtworksBatchEmail";
import { DUPLICATE_PREFIX } from "@/lib/imageHash";

/** New artworks go live right away only for verified artists or ones with 3+ approved pieces. */
export const AUTO_APPROVE_AFTER = 3;

export async function initialArtworkStatus(artistId: string): Promise<"APPROVED" | "PENDING"> {
  const artist = await prisma.artist.findUnique({
    where: { id: artistId },
    select: { verification: true, role: true, _count: { select: { artworks: { where: { status: "APPROVED" } } } } },
  });
  if (!artist) return "PENDING";
  if (artist.role === "ADMIN" || artist.verification === "VERIFIED" || artist._count.artworks >= AUTO_APPROVE_AFTER) return "APPROVED";
  return "PENDING";
}

/** `email: false` skips the artist's email (a batch upload sends one summary instead, see announceBatch). */
export async function announceArtworkLive(artworkId: string, { email = true }: { email?: boolean } = {}) {
  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    select: { slug: true, title: true, artistId: true, status: true, artist: { select: { slug: true, artist_name: true, name: true, email: true, role: true } } },
  });
  if (!artwork?.slug || artwork.status !== "APPROVED") return;

  // A referred artist's first approved upload earns their referrer Infinity months (once).
  try {
    await rewardReferralOnUpload(artwork.artistId);
  } catch (err) {
    console.error("Referral reward failed", err);
  }
  if (!email) return;

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";
    const qrToken = await new SignJWT({ slug: artwork.slug, artistId: artwork.artistId, role: artwork.artist?.role || "ARTIST", type: "qr_download" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
    await resend.emails.send({
      from: "Artfinity <notifications@theartfinity.com>",
      to: artwork.artist.email,
      subject: `Your artwork is live – ${artwork.title}`,
      react: ArtworkLiveWithQrEmail({
        artistName: artwork.artist.artist_name || artwork.artist.name || "",
        title: artwork.title,
        artworkUrl: artUrl(artwork.artist.slug, artwork.slug!, base),
        qrDownloadUrl: `${base}/api/artworks/${artwork.slug}/qr?download=1&token=${qrToken}`,
      }),
    });
  } catch (err) {
    console.error("Artist QR email failed", err);
  }
}

export type BatchPiece = { title: string; url: string; imageUrl: string; status: "live" | "review"; duplicate: boolean };

/**
 * One email for a batch of uploads instead of one per piece: the artist hears which pieces are live (and which wait
 * for review, those still get their own email on approval), and the team gets one list to look over.
 * Only the artist's own pieces from the last day count, so a replayed call can't mail anything else.
 */
export async function announceBatch(artistId: string, ids: string[]): Promise<{ live: number; review: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.artwork.findMany({
    where: { id: { in: ids.slice(0, 100) }, artistId, createdAt: { gte: since }, slug: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { slug: true, title: true, imageUrl: true, status: true, flaggedReason: true },
  });
  const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { slug: true, artist_name: true, name: true, email: true, city: true, state: true } });
  if (!artist || !rows.length) return { live: 0, review: 0 };
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";
  const pieces: BatchPiece[] = rows
    .filter((r) => r.status === "APPROVED" || r.status === "PENDING")
    .map((r) => ({
      title: r.title,
      url: artUrl(artist.slug, r.slug!, base),
      imageUrl: r.imageUrl.startsWith("/") ? base + r.imageUrl : r.imageUrl,
      status: r.status === "APPROVED" ? "live" : "review",
      duplicate: !!r.flaggedReason?.startsWith(DUPLICATE_PREFIX),
    }));
  const live = pieces.filter((p) => p.status === "live").length;
  const review = pieces.length - live;
  const name = artist.artist_name || artist.name || "";

  if (live) {
    try {
      await resend.emails.send({
        from: "Artfinity <notifications@theartfinity.com>",
        to: artist.email,
        subject: live === 1 ? `Your artwork is live – ${pieces.find((p) => p.status === "live")!.title}` : `${live} new pieces are live on Artfinity`,
        react: ArtworksBatchLiveEmail({ artistName: name, pieces, codesUrl: `${base}/studio/art` }),
      });
    } catch (err) {
      console.error("Batch live email failed", err);
    }
  }
  if (pieces.length) {
    try {
      const dups = pieces.filter((p) => p.duplicate).length;
      await resend.emails.send({
        from: "Artfinity <notifications@theartfinity.com>",
        to: "craig@theartfinity.com",
        subject: `${pieces.length} new artworks from ${name || "an artist"}${review ? ` – ${review} to review` : ""}${dups ? ` (${dups} possible duplicate${dups === 1 ? "" : "s"})` : ""}`,
        react: NewArtworksBatchEmail({ artistName: name, city: artist.city, state: artist.state, pieces }),
      });
    } catch (err) {
      console.error("Batch notification email failed", err);
    }
  }
  return { live, review };
}
