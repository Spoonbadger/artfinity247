import * as React from "react";
import { CTA, EmailLayout, H1, P } from "./_layout";

// "Confirm your email" for new password sign-ups and email changes. The link works for 7 days.
export default function ConfirmEmail({ link, firstName }: { link: string; firstName?: string | null }) {
  return (
    <EmailLayout preview="Confirm your email so we can send your sales and pay you out.">
      <H1>Confirm your email address</H1>
      {firstName ? <P>Hi {firstName},</P> : null}
      <P>Please confirm this is your email address. We use it to tell you about sales and to send your payouts.</P>
      <CTA href={link}>Confirm email address</CTA>
      <P muted small style={{ margin: 0 }}>
        This link expires in 7 days. If you didn&apos;t create an Artfinity account, you can ignore this email.
      </P>
    </EmailLayout>
  );
}
