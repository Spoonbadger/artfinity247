import * as React from "react";
import { CTA, EmailLayout, H1, P } from "./_layout";

// Sent instead of a reset link when someone asks to reset the password of an account that signs in with
// Google/Apple/Facebook/Instagram and has no password.
export default function SocialSignInReminderEmail({ providers, loginLink }: { providers: string[]; loginLink: string }) {
  const list = providers.length > 1 ? `${providers.slice(0, -1).join(", ")} or ${providers[providers.length - 1]}` : providers[0];
  return (
    <EmailLayout preview={`Your Artfinity account signs in with ${list}, so there's no password to reset.`}>
      <H1>You sign in with {list}</H1>
      <P>We got a request to reset the password for your Artfinity account. Your account doesn&apos;t have a password: you signed up with {list}.</P>
      <P>To log in, open the log-in page and choose <b>Continue with {providers[0]}</b>.</P>
      <CTA href={loginLink}>Go to log in</CTA>
      <P muted small>Want a password as well? Once you&apos;re logged in, open Studio → My page → Sign-in methods and choose &ldquo;Set a password&rdquo;.</P>
      <P muted small style={{ margin: 0 }}>If you didn&apos;t ask for this, you can ignore this email.</P>
    </EmailLayout>
  );
}
