import * as React from "react";

export default function PayoutSentEmail({
  artistName,
  month,
  amountCents,
}: {
  artistName: string;
  month: string;
  amountCents: number;
}) {
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ color: "#b05c5c" }}>
        Your Artfinity payout has been sent
      </h2>

      <p>Hi {artistName},</p>

      <p>
        Your payout for <strong>{month}</strong> has been processed.
      </p>

      <hr style={{ margin: "16px 0" }} />

      <p>
        <strong>Amount sent:</strong> {fmt(amountCents)}
      </p>

      <hr style={{ margin: "16px 0" }} />

      <p>
        Thank you for being part of Artfinity.
      </p>

      <p style={{ marginTop: 16 }}>
        — Artfinity
      </p>
    </div>
  )
}