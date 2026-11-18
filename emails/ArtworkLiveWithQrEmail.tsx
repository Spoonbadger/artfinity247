import * as React from "react";
import { Img, Link } from "@react-email/components";
import { SITE_URL } from "@/lib/urls";
import { A, C, CTA, Divider, EmailLayout, H1, H2, P } from "./_layout";

export default function ArtworkLiveWithQrEmail({
  artistName,
  title,
  artworkUrl,
  qrDownloadUrl,
  imageUrl,
}: {
  artistName: string;
  title: string;
  artworkUrl: string;
  /** Signed link, works for 7 days (lib/artworkLive.ts). */
  qrDownloadUrl: string;
  /** Absolute image URL of the piece. */
  imageUrl?: string | null;
}) {
  return (
    <EmailLayout preview={`${title} is on your page and ready for print orders.`} footer="You're getting this because a piece on your Artfinity page went live.">
      {imageUrl ? (
        <Link href={artworkUrl}>
          <Img
            src={imageUrl}
            alt={title}
            width="200"
            style={{ display: "block", width: 200, maxWidth: "100%", height: "auto", margin: "0 0 24px", border: `1px solid ${C.line}`, borderRadius: 4 }}
          />
        </Link>
      ) : null}
      <H1>{title} is live</H1>
      <P>Hi {artistName},</P>
      <P>Your piece is on your page now, and people can order prints of it.</P>
      <CTA href={artworkUrl}>View artwork</CTA>

      <Divider />

      <H2>Hang a QR card beside it</H2>
      <P>Print the card and place it next to the original so visitors can scan it and order on the spot. Card stock works best.</P>
      <CTA href={qrDownloadUrl} secondary>Print its QR code</CTA>
      <P muted small style={{ margin: 0 }}>
        Pick a label, sticker or tag and how many. Print it any time from <A href={`${SITE_URL}/studio/art`}>My art</A>.
      </P>
    </EmailLayout>
  );
}
