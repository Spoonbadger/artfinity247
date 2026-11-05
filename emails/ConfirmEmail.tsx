import * as React from "react";

// "Confirm your email" for new password sign-ups and email changes. The link works for 7 days.
export default function ConfirmEmail({ link, firstName }: { link: string; firstName?: string | null }) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ color: "#b05c5c" }}>Confirm your email</h2>
      <p>{firstName ? `Hi ${firstName}, one` : "One"} quick step: confirm this is your email so we can send your sales and pay you out.</p>
      <p>
        <a href={link} style={{ display: "inline-block", padding: "12px 16px", borderRadius: "6px", textDecoration: "none", background: "#b05c5c", color: "#fff" }}>
          Confirm my email
        </a>
      </p>
      <p style={{ fontSize: 12, opacity: 0.8 }}>This link works for 7 days. If you didn&apos;t sign up for Artfinity, ignore this email.</p>
      <p style={{ marginTop: 16 }}>— Artfinity</p>
    </div>
  );
}
