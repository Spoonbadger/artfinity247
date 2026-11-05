import * as React from "react";
import { SITE_URL } from "@/lib/urls";

type Item = {
  title: string | null;
  imageUrl: string | null;
  /** Friendly size, e.g. "Medium · 8 × 12 in" (lib/email.ts). */
  size: string | null;
  quantity: number | null;
  unitPrice: number | null; // cents
  edition?: string; // "Print 8 of 25" for limited editions
  artist?: string | null;
  frame?: string | null; // "Black frame"
};

// Artfinity's paint: ink, Scan Blue, a soft gallery wall.
const INK = "#15161b";
const INK2 = "#5a5d6b";
const BLUE = "#2b37f0";
const LINE = "#e1e2da";

export default function ReceiptEmail({
  code,
  totalCents,
  currency = "usd",
  shippingName,
  shippingAddressLine,
  arrives,
  items,
  rewards = false,
}: {
  /** The short order code shown on the thank-you page (e.g. "XX1KP4"). */
  code: string;
  totalCents: number;
  currency?: string;
  shippingName?: string | null;
  shippingAddressLine?: string | null;
  /** Delivery estimate, e.g. "Nov 12–18". */
  arrives?: string | null;
  items: Item[];
  /** Collector rewards are switched on (lib/collectorRewards.ts): mention them in the collection line. */
  rewards?: boolean;
}) {
  const fmt = (cents?: number | null) => ((cents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
  const artists = Array.from(new Set(items.map((i) => i.artist).filter(Boolean))) as string[];

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif", color: INK, maxWidth: 560 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: INK2 }}>Order {code}</p>
      <h1 style={{ margin: "6px 0 4px", fontSize: 28, lineHeight: 1.1 }}>It&apos;s yours. Thank you!</h1>
      <p style={{ margin: "0 0 20px", fontSize: 16, color: INK2 }}>
        We&apos;re printing it now{arrives ? <>. It should arrive <strong style={{ color: INK }}>{arrives}</strong></> : null}.
        {artists.length ? <> Your order supports {artists.join(" and ")}.</> : null}
      </p>

      <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "4px 16px" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: i ? `1px solid ${LINE}` : "none" }}>
            {it.imageUrl ? <img src={it.imageUrl} alt="" width={48} height={60} style={{ objectFit: "cover", borderRadius: 2, border: `1px solid ${LINE}` }} /> : null}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{it.title}</div>
              {it.artist ? <div style={{ fontSize: 13, color: INK2 }}>by {it.artist}</div> : null}
              <div style={{ fontSize: 13, color: INK2 }}>
                {[it.size, it.frame, (it.quantity ?? 1) > 1 ? `× ${it.quantity}` : null].filter(Boolean).join(" · ")}
              </div>
              {it.edition ? <div style={{ fontSize: 13, fontWeight: 600 }}>{it.edition}</div> : null}
            </div>
            <div style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{fmt((it.unitPrice ?? 0) * (it.quantity ?? 1))}</div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${LINE}`, fontWeight: 700 }}>
          <span>Paid</span>
          <span>{fmt(totalCents)}</span>
        </div>
      </div>

      {shippingName || shippingAddressLine ? (
        <p style={{ margin: "16px 0 0", fontSize: 14, color: INK2 }}>
          Ships to <span style={{ color: INK }}>{[shippingName, shippingAddressLine].filter(Boolean).join(", ")}</span>
        </p>
      ) : null}

      <p style={{ margin: "16px 0 0", fontSize: 14, color: INK2 }}>
        Free US shipping. If it arrives damaged, we reprint it free.{" "}
        <a href={`${SITE_URL}/help/buyers`} style={{ color: BLUE, fontWeight: 600 }}>Shipping and returns</a>
      </p>
      <p style={{ margin: "12px 0 0", fontSize: 14, color: INK2 }}>
        Save this to a free collection: track orders, keep a wishlist{rewards ? ", earn rewards" : ""}.{" "}
        <a href={`${SITE_URL}/collector`} style={{ color: BLUE, fontWeight: 600 }}>See your orders any time</a>
      </p>
      <p style={{ margin: "20px 0 0", fontSize: 14 }}>— Artfinity</p>
    </div>
  );
}
