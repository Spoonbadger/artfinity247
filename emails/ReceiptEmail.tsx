import * as React from "react";

type Item = {
  title: string | null;
  imageUrl: string | null;
  size: string | null;
  quantity: number | null;
  unitPrice: number | null; // cents
};

export default function ReceiptEmail({
  orderId,
  email,
  totalCents,
  currency = "usd",
  shippingName,
  shippingAddressLine,
  items,
}: {
  orderId: string;
  email: string;
  totalCents: number;
  currency?: string;
  shippingName?: string | null;
  shippingAddressLine?: string | null;
  items: Item[];
}) {
  const fmt = (cents?: number | null) =>
    (cents ?? 0 / 100).toLocaleString("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    });

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", color: "#222" }}>
      <h2 style={{ margin: 0, color: "#b05c5c" }}>Thank you for your order!</h2>
      <p style={{ margin: "8px 0 16px" }}>Receipt sent to: {email}</p>

      {shippingName || shippingAddressLine ? (
        <div style={{ margin: "12px 0 20px" }}>
          <div style={{ fontSize: 20, color: "#b05c5c" }}>Shipping To</div>
          <div>{shippingName}</div>
          <div>{shippingAddressLine}</div>
        </div>
      ) : null}

      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 18, color: "#b05c5c", marginBottom: 8 }}>Order summary</div>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? "1px solid #f2f2f2" : "none" }}>
            {it.imageUrl ? (
              <img src={it.imageUrl} alt="" width={56} height={56} style={{ borderRadius: 6, objectFit: "cover" }} />
            ) : null}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{it.title}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Size: {it.size} • Qty: {it.quantity ?? 1}
              </div>
            </div>
            <div style={{ whiteSpace: "nowrap" }}>{fmt((it.unitPrice ?? 0) * (it.quantity ?? 1))}</div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontWeight: 700 }}>
          <span>Total</span>
          <span>{fmt(totalCents)}</span>
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.8 }}>
        Order ID: {orderId}
      </p>
    </div>
  );
}
