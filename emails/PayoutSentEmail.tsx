import * as React from "react";
import { SITE_URL } from "@/lib/urls";
import { C, CTA, EmailLayout, H1, P } from "./_layout";

export default function PayoutSentEmail({
  artistName,
  month,
  amountCents,
  via,
}: {
  artistName: string;
  month: string;
  amountCents: number;
  /** "stripe": sent to their bank through Stripe. Left out only when re-sending the email for an old payout made outside Stripe. */
  via?: "stripe";
}) {
  const amount = (amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <EmailLayout preview={`Your ${month} payout of ${amount} is on its way.`} footer="You're getting this because you sell prints on Artfinity.">
      <H1>Your payout is on its way</H1>
      <P>Hi {artistName},</P>
      <P>We&apos;ve sent your payout for <strong>{month}</strong>.</P>
      <P style={{ margin: "0 0 16px", fontSize: 32, lineHeight: "38px", fontWeight: 700, color: C.ink }}>{amount}</P>
      {via === "stripe" && <P muted>It&apos;s going to your bank through Stripe and usually arrives within 2 business days.</P>}
      <CTA href={`${SITE_URL}/studio/money`} secondary>View payouts</CTA>
      <P muted small style={{ margin: 0 }}>Thank you for being part of Artfinity.</P>
    </EmailLayout>
  );
}
