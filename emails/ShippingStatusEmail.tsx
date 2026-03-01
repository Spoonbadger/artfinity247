import * as React from "react";

type Item = {
  title: string;
  size: string;
  quantity: number;
  imageUrl: string | null;
};

export default function ShippingStatusEmail({
  name,
  status,
  orderId,
  items,
}: {
  name: string;
  status: "shipped" | "delivered";
  orderId: string;
  items: Item[];
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ color: "#b05c5c" }}>
        {status === "shipped"
          ? "Your Artfinity order has shipped!"
          : "Your Artfinity order was delivered!"}
      </h2>

      <p>Hi {name},</p>

      <p>
        Order reference: <strong>{orderId}</strong>
      </p>

      <hr style={{ margin: "16px 0" }} />

      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.title}
              style={{ width: 120, borderRadius: 6 }}
            />
          )}
          <div style={{ marginTop: 6 }}>
            <strong>{item.title}</strong><br />
            Size: {item.size} • Qty: {item.quantity}
          </div>
        </div>
      ))}

      <hr style={{ margin: "16px 0" }} />

      {status === "shipped" ? (
        <p>Your print is on its way and should arrive soon.</p>
      ) : (
        <p>Your print has been delivered. We hope you love it.</p>
      )}

      <p style={{ marginTop: 16 }}>
        Thank you for supporting independent artists.
      </p>

      <p style={{ marginTop: 16 }}>
        — Artfinity
      </p>
    </div>
  )
}