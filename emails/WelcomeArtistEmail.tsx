import * as React from "react";

export default function WelcomeArtistEmail({
  artistName,
}: {
  artistName: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ margin: 0, color: "#b05c5c" }}>
        Welcome to Artfinity
      </h2>

      <p style={{ marginTop: 16 }}>
        Hi {artistName},
      </p>

      <p style={{ marginTop: 12, lineHeight: 1.6 }}>
        Your artist account has been successfully created.
      </p>

      <p style={{ marginTop: 12, lineHeight: 1.6 }}>
        You can now upload your artwork and start offering premium fine art
        prints to customers across your local scene.
      </p>

      <p style={{ marginTop: 12, lineHeight: 1.6 }}>
        We handle printing, fulfillment, and shipping — you focus on creating.
      </p>

      <p style={{ marginTop: 20 }}>
        If you have any questions, reach us at{" "}
        <strong>contact@theartfinity.com</strong>.
      </p>

      <p style={{ marginTop: 24 }}>
        — The Artfinity
      </p>

      <p style={{ marginTop: 20, fontSize: 12, opacity: 0.7 }}>
        This is an automated message confirming your registration.
      </p>
    </div>
  );
}
