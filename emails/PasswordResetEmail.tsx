import * as React from "react";
import { CTA, EmailLayout, H1, P } from "./_layout";

export default function PasswordResetEmail({
  resetLink,
}: {
  resetLink: string;
}) {
  return (
    <EmailLayout preview="Use this link to choose a new password. It expires in 30 minutes.">
      <H1>Reset your password</H1>
      <P>We got a request to reset the password for your Artfinity account. Choose a new one with the button below.</P>
      <CTA href={resetLink}>Reset password</CTA>
      <P muted small style={{ margin: 0 }}>
        This link expires in 30 minutes. If you didn&apos;t ask to reset your password, you can ignore this email.
      </P>
    </EmailLayout>
  );
}
