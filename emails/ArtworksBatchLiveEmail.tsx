import * as React from "react";
import { Column, Img, Link, Row, Section } from "@react-email/components";
import type { BatchPiece } from "@/lib/artworkLive";
import { C, CTA, Divider, EmailLayout, H1, H2, P } from "./_layout";

// One email for a batch upload (lib/artworkLive.ts announceBatch), instead of one "your artwork is live" per piece.
export default function ArtworksBatchLiveEmail({
  artistName,
  pieces,
  codesUrl,
}: {
  artistName: string;
  pieces: BatchPiece[];
  codesUrl: string;
}) {
  const live = pieces.filter((p) => p.status === "live");
  const review = pieces.filter((p) => p.status === "review");
  const one = live.length === 1;
  const heading = one ? `${live[0].title} is live` : `${live.length} new pieces are live`;
  return (
    <EmailLayout preview={one ? "Your piece is on your page and ready for print orders." : "Your new pieces are on your page and ready for print orders."} footer="You're getting this because pieces on your Artfinity page went live.">
      <H1>{heading}</H1>
      <P>Hi {artistName},</P>
      <P>{one ? "This piece is" : "These pieces are"} on your page now, and people can order prints:</P>

      <Section style={{ margin: "0 0 24px", border: `1px solid ${C.line}`, borderRadius: 8 }}>
        {live.map((p, i) => (
          <Row key={p.url} style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <Column style={{ width: 64, padding: "12px 0 12px 12px", verticalAlign: "middle" }}>
              <Link href={p.url}>
                <Img src={p.imageUrl} alt="" width="48" height="48" style={{ display: "block", objectFit: "cover", borderRadius: 4, border: `1px solid ${C.line}` }} />
              </Link>
            </Column>
            <Column style={{ width: "100%", padding: "12px 12px 12px 14px", verticalAlign: "middle" }}>
              <Link href={p.url} style={{ color: C.ink, fontSize: 15, fontWeight: 600, textDecoration: "none" }}>{p.title}</Link>
            </Column>
            <Column style={{ padding: "12px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
              <Link href={p.url} style={{ color: C.garnet, fontSize: 14, textDecoration: "underline" }}>View</Link>
            </Column>
          </Row>
        ))}
      </Section>

      {review.length > 0 && (
        <P muted>
          {review.length === 1 ? "One more piece is" : `${review.length} more pieces are`} getting a quick review first ({review.map((p) => p.title).join(", ")}).
          We&apos;ll email you when {review.length === 1 ? "it goes" : "each one goes"} live.
        </P>
      )}

      <Divider />

      <H2>Print their QR cards</H2>
      <P>Print all your codes on one sheet, then hang each one beside its piece so visitors can scan and order.</P>
      <CTA href={codesUrl} secondary last>Print all codes</CTA>
    </EmailLayout>
  );
}
