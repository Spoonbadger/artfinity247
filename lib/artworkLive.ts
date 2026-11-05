// What happens when a piece goes live (at upload, or when an admin approves it from review):
// the referral reward and the "your artwork is live" email with its QR download link. Server-only.
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { artUrl } from "@/lib/urls";
import { resend } from "@/lib/resend";
import { rewardReferralOnUpload } from "@/lib/referrals";
import ArtworkLiveWithQrEmail from "@/emails/ArtworkLiveWithQrEmail";

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

export async function announceArtworkLive(artworkId: string) {
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
