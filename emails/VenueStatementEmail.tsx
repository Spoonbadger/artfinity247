import * as React from "react";

/** Monthly statement for a venue partner: what sold off their walls and their share of Artfinity's profit. */
export default function VenueStatementEmail({
  venueName,
  contactName,
  monthLabel,
  sharePct,
  sales,
  grossCents,
  owedCents,
  paid,
  pageUrl,
  lines,
}: {
  venueName: string;
  contactName?: string | null;
  monthLabel: string;
  /** e.g. "5%"; null when the venue has no share (recognition only). */
  sharePct: string | null;
  sales: number;
  grossCents: number;
  owedCents: number;
  paid: boolean;
  pageUrl: string;
  lines: { date: string; title: string; artist: string; amount: string }[];
}) {
  const fmt = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #e6e6e2", fontSize: 14 };
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#15161b", maxWidth: 560 }}>
      <h2 style={{ margin: "0 0 4px" }}>{venueName} · {monthLabel}</h2>
      <p style={{ marginTop: 0, color: "#55575f" }}>Your Artfinity venue statement</p>
      <p>Hi {contactName || "there"},</p>
      <p>
        Thank you for hanging local art. In {monthLabel}, <strong>{sales}</strong> {sales === 1 ? "print" : "prints"} sold from codes on your walls,
        for {fmt(grossCents)} in sales.
      </p>
      {lines.length > 0 && (
        <table cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", width: "100%", margin: "12px 0" }}>
          <thead>
            <tr>
              <th align="left" style={td}>Date</th>
              <th align="left" style={td}>Artwork</th>
              <th align="right" style={td}>Sale</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td style={td}>{l.date}</td>
                <td style={td}>{l.title}{l.artist ? ` · ${l.artist}` : ""}</td>
                <td align="right" style={td}>{l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sharePct && (
        <p style={{ fontSize: 16 }}>
          <strong>Your share ({sharePct} of Artfinity&apos;s profit): {fmt(owedCents)}</strong>
          {owedCents > 0 ? (paid ? " · paid" : " · on its way") : ""}
        </p>
      )}
      <p>Your venue page: <a href={pageUrl}>{pageUrl}</a></p>
      <p style={{ marginTop: 16 }}>— Artfinity</p>
    </div>
  );
}
