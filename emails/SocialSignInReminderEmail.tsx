import * as React from "react";

// Sent instead of a reset link when someone asks to reset the password of an account that signs in with
// Google/Apple/Facebook/Instagram and has no password.
export default function SocialSignInReminderEmail({ providers, loginLink }: { providers: string[]; loginLink: string }) {
  const list = providers.length > 1 ? `${providers.slice(0, -1).join(", ")} or ${providers[providers.length - 1]}` : providers[0];
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ color: "#b05c5c" }}>You sign in with {list}</h2>

      <p>Someone (hopefully you) asked to reset the password for your Artfinity account. Your account doesn&apos;t have a password: you signed up with {list}.</p>

      <p>To log in, open the log-in page and choose <b>Continue with {providers[0]}</b>.</p>

      <p>
        <a
          href={loginLink}
          style={{ display: "inline-block", padding: "12px 16px", borderRadius: "6px", textDecoration: "none", background: "#b05c5c", color: "#fff" }}
        >
          Go to log in
        </a>
      </p>

      <p style={{ fontSize: 13 }}>Want a password as well? Once you&apos;re logged in, open Studio → My page → Sign-in methods and choose &ldquo;Set a password&rdquo;.</p>

      <p style={{ fontSize: 12, opacity: 0.8 }}>If you didn&apos;t ask for this, you can ignore this email.</p>

      <p style={{ marginTop: 16 }}>— Artfinity</p>
    </div>
  );
}
