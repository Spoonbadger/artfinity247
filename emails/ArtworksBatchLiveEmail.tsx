import * as React from "react"
import type { BatchPiece } from "@/lib/artworkLive"

// One email for a batch upload (lib/artworkLive.ts announceBatch), instead of one "your artwork is live" per piece.
export default function ArtworksBatchLiveEmail({
  artistName,
  pieces,
  codesUrl,
}: {
  artistName: string;
  pieces: BatchPiece[];
  codesUrl: string;
}) {
  const live = pieces.filter((p) => p.status === "live");
  const review = pieces.filter((p) => p.status === "review");
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ margin: 0, color: "#b05c5c" }}>
        {live.length === 1 ? "Your artwork is live 🎉" : `${live.length} new pieces are live 🎉`}
      </h2>

      <p style={{ marginTop: 16 }}>Hi {artistName},</p>

      <p style={{ marginTop: 12, lineHeight: 1.6 }}>
        {live.length === 1 ? "This piece is" : "These pieces are"} now on your page and ready for people to order prints:
      </p>

      <ul style={{ paddingLeft: 18, lineHeight: 1.8 }}>
        {live.map((p) => (
          <li key={p.url}>
            <a href={p.url} style={{ color: "#b05c5c", textDecoration: "underline" }}>{p.title}</a>
          </li>
        ))}
      </ul>

      {review.length > 0 && (
        <p style={{ marginTop: 12, lineHeight: 1.6 }}>
          {review.length === 1 ? "One more piece is" : `${review.length} more pieces are`} getting a quick look first ({review.map((p) => p.title).join(", ")}).
          We&apos;ll email you when {review.length === 1 ? "it goes" : "each one goes"} live.
        </p>
      )}

      <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid #eee" }} />

      <h3 style={{ margin: 0 }}>Print their QR cards</h3>

      <p style={{ marginTop: 12, lineHeight: 1.6 }}>
        Print all your codes on one sheet from My art, then hang each one beside its painting so people can scan and order.
      </p>

      <div style={{ marginTop: 20 }}>
        <a
          href={codesUrl}
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
          Print all codes
        </a>
      </div>

      <p style={{ marginTop: 24 }}>— The Artfinity Team</p>

      <p style={{ marginTop: 20, fontSize: 12, opacity: 0.7 }}>
        One email for the whole upload, so your inbox stays quiet.
      </p>
    </div>
  );
}
