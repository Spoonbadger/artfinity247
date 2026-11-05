import * as React from "react"
import type { BatchPiece } from "@/lib/artworkLive"

// The team's one notification for a batch upload (lib/artworkLive.ts announceBatch).
export default function NewArtworksBatchEmail({
  artistName,
  city,
  state,
  pieces,
}: {
  artistName: string;
  city?: string | null;
  state?: string | null;
  pieces: BatchPiece[];
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ margin: 0, color: "#b05c5c" }}>🖼 {pieces.length} New Artworks</h2>

      <div style={{ marginTop: 16 }}>
        <p><strong>Artist:</strong> {artistName || "unknown"}</p>
        <p><strong>Location:</strong> {city}, {state}</p>
      </div>

      <table style={{ marginTop: 16, borderCollapse: "collapse" }}>
        <tbody>
          {pieces.map((p) => (
            <tr key={p.url}>
              <td style={{ padding: "6px 10px 6px 0" }}>
                <img src={p.imageUrl} alt={p.title} width={64} style={{ borderRadius: 4, display: "block" }} />
              </td>
              <td style={{ padding: "6px 0" }}>
                <a href={p.url} style={{ color: "#222", fontWeight: 600 }}>{p.title}</a>
                <div style={{ fontSize: 13, color: p.status === "review" ? "#b05c5c" : "#0f7a55" }}>
                  {p.duplicate ? "Possible duplicate – to review" : p.status === "review" ? "To review" : "Live"}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
