import * as React from "react";

export default function NewArtistNotificationEmail({
  artistName,
  email,
  city,
  state,
  createdAt,
}: {
  artistName: string;
  email: string;
  city?: string | null;
  state?: string | null;
  createdAt: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ margin: 0, color: "#b05c5c" }}>
        🎨 New Artist Registration
      </h2>

      <div style={{ marginTop: 16, lineHeight: 1.6 }}>
        <p><strong>Name:</strong> {artistName}</p>
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Location:</strong> {city}, {state}</p>
        <p><strong>Registered:</strong> {createdAt}</p>
      </div>

      <p style={{ marginTop: 20, fontSize: 12, opacity: 0.7 }}>
        This is an automated notification from Artfinity.
      </p>
    </div>
  );
}
