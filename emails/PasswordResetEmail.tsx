import * as React from "react";

export default function PasswordResetEmail({
  resetLink,
}: {
  resetLink: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ color: "#8b2a4b" }}>Reset your password</h2>

      <p>You requested a password reset for your Artfinity account.</p>

      <p>
        <a
          href={resetLink}
          style={{
            display: "inline-block",
            padding: "12px 16px",
            borderRadius: "6px",
            textDecoration: "none",
            background: "#8b2a4b",
            color: "#fff",
          }}
        >
          Reset Password
        </a>
      </p>

      <p style={{ fontSize: 12, opacity: 0.8 }}>
        This link expires in 30 minutes.
      </p>

      <p style={{ marginTop: 16 }}>— Artfinity</p>
    </div>
  );
}