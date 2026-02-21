import * as React from "react";

type Item = {
  title: string;
  size: string;
  quantity: number;
  lineTotal: number;
};

export default function ArtistSaleNotificationEmail({
  artistName,
  items,
  totalCents,
}: {
  artistName: string;
  items: Item[];
  totalCents: number;
}) {
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ color: "#b05c5c" }}>Your artwork sold!</h2>

      <p>Hi {artistName},</p>
      <p>You’ve just made a sale on Artfinity.</p>

      <hr style={{ margin: "16px 0" }} />

      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <strong>{item.title}</strong><br />
          Size: {item.size} • Qty: {item.quantity}<br />
          Sale Amount: {fmt(item.lineTotal)}
        </div>
      ))}

      <hr style={{ margin: "16px 0" }} />

      <p>
        This will be included in your next monthly payout.
      </p>

      <p style={{ marginTop: 16 }}>
        — Artfinity
      </p>
    </div>
  )
}