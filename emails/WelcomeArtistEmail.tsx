import * as React from "react";
import { SITE_URL } from "@/lib/urls";
import { A, CTA, EmailLayout, H1, P } from "./_layout";

export default function WelcomeArtistEmail({
  artistName,
  pageUrl,
}: {
  artistName: string;
  /** Their public page, e.g. https://theartfinity.com/@handle. */
  pageUrl?: string;
}) {
  const shown = pageUrl?.replace(/^https?:\/\//, "");
  return (
    <EmailLayout preview="Your artist page is ready. Upload a piece to start selling prints." footer="You're getting this because you created an Artfinity artist account.">
      <H1>Welcome to Artfinity</H1>
      <P>Hi {artistName},</P>
      <P>
        Your artist page is ready{pageUrl ? <> at <A href={pageUrl}>{shown}</A></> : null}. Upload a piece and people can order
        fine art prints of it right away.
      </P>
      <P>We print, pack and ship every order. You get paid for each sale once a month.</P>
      <CTA href={`${SITE_URL}/studio/art/new`}>Upload your first piece</CTA>
      <P muted small style={{ margin: 0 }}>
        Everything else (your page, QR codes, sales and payouts) lives in your <A href={`${SITE_URL}/studio`}>Studio</A>.
      </P>
    </EmailLayout>
  );
}
