import * as React from "react";

type Item = {
  title: string | null;
  size: string | null;
  quantity: number;
  unitPrice: number;
};

export default function NewSaleNotificationEmail({
  orderId,
  buyerEmail,
  totalCents,
  items,
}: {
  orderId: string;
  buyerEmail: string;
  totalCents: number;
  items: Item[];
}) {
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ color: "#b05c5c" }}>💰 New Sale</h2>

      <p><strong>Order ID:</strong> {orderId}</p>
      <p><strong>Buyer:</strong> {buyerEmail}</p>
      <p><strong>Total:</strong> {fmt(totalCents)}</p>

      <hr style={{ margin: "16px 0" }} />

      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <strong>{item.title}</strong><br />
          Size: {item.size} • Qty: {item.quantity}<br />
          Line: {fmt(item.unitPrice * item.quantity)}
        </div>
      ))}
    </div>
  )
}