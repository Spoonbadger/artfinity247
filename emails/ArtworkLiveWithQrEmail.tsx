import * as React from "react"

export default function ArtworkLiveWithQrEmail({
  artistName,
  title,
  artworkUrl,
  qrDownloadUrl,
}: {
  artistName: string;
  title: string;
  artworkUrl: string;
  qrDownloadUrl: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ margin: 0, color: "#b05c5c" }}>
        Your artwork is live 🎉
      </h2>

      <p style={{ marginTop: 16 }}>
        Hi {artistName},
      </p>

      <p style={{ marginTop: 12, lineHeight: 1.6 }}>
        <strong>{title}</strong> is now live on Artfinity and ready for customers
        to view and order prints.
      </p>

      <p style={{ marginTop: 12 }}>
        View your artwork:
      </p>

      <p>
        <a
          href={artworkUrl}
          style={{ color: "#b05c5c", textDecoration: "underline" }}
        >
          {artworkUrl}
        </a>
      </p>

      <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid #eee" }} />

      <h3 style={{ margin: 0 }}>Print Your QR Card</h3>

      <p style={{ marginTop: 12, lineHeight: 1.6 }}>
        Download your branded QR card below. Print it and place it next to your
        artwork so visitors can scan and order instantly.
      </p>

      <div style={{ marginTop: 20 }}>
        <a
          href={qrDownloadUrl}
          style={{
            backgroundColor: "#b05c5c",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            display: "inline-block",
          }}
        >
          Download QR Card (PDF)
        </a>
      </div>

      <p style={{ marginTop: 20, fontSize: 13, opacity: 0.8 }}>
        Tip: Print on thick paper or card stock for best results.
      </p>

      <p style={{ marginTop: 24 }}>
        — The Artfinity Team
      </p>

      <p style={{ marginTop: 20, fontSize: 12, opacity: 0.7 }}>
        This is an automated message confirming your artwork upload.
      </p>
    </div>
  );
}