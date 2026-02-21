import * as React from "react";

export default function NewArtworkUploadedEmail({
  artistName,
  title,
  imageUrl,
  city,
  state,
  createdAt,
}: {
  artistName: string;
  title: string;
  imageUrl?: string | null;
  city?: string | null;
  state?: string | null;
  createdAt: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ margin: 0, color: "#b05c5c" }}>
        🖼 New Artwork Uploaded
      </h2>

      <div style={{ marginTop: 16 }}>
        <p><strong>Artist:</strong> {artistName}</p>
        <p><strong>Title:</strong> {title}</p>
        <p><strong>Location:</strong> {city}, {state}</p>
        <p><strong>Uploaded:</strong> {createdAt}</p>
      </div>

      {imageUrl && (
        <div style={{ marginTop: 20 }}>
          <img
            src={imageUrl}
            alt={title}
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: 8,
              objectFit: "cover",
            }}
          />
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 12, opacity: 0.7 }}>
        This is an automated notification from Artfinity.
      </p>
    </div>
  );
}
