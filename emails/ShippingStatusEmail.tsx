import * as React from "react";
import { SITE_URL } from "@/lib/urls";

type Item = {
  title: string;
  /** Friendly size, e.g. "Medium · 8 × 12 in" (lib/orderText.ts). */
  size: string;
  quantity: number;
  imageUrl: string | null;
  artist?: string | null;
};

// Artfinity's paint: ink, Scan Blue.
const INK = "#15161b";
const INK2 = "#5a5d6b";
const BLUE = "#2b37f0";
const LINE = "#e1e2da";

export default function ShippingStatusEmail({
  name,
  status,
  code,
  items,
  tracking,
  helpUrl,
  certificates = [],
}: {
  name: string;
  status: "shipped" | "delivered";
  /** The short order code shown on the thank-you page and in the receipt. */
  code: string;
  items: Item[];
  tracking?: { carrier: string; number: string; url: string | null } | null;
  /** Signed link to report a damaged or wrong print (lib/reprints.ts). */
  helpUrl?: string;
  /** Limited-edition prints: signed links to their certificates of authenticity (lib/certificates.ts). */
  certificates?: { title: string; url: string }[];
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif", color: INK, maxWidth: 560 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: INK2 }}>Order {code}</p>
      <h1 style={{ margin: "6px 0 12px", fontSize: 26, lineHeight: 1.15 }}>{status === "shipped" ? "Your print is on its way" : "Your print was delivered"}</h1>

      <p style={{ margin: "0 0 16px" }}>Hi {name},</p>

      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${LINE}` : "none" }}>
          {item.imageUrl && <img src={item.imageUrl} alt="" width={48} height={60} style={{ objectFit: "cover", borderRadius: 2, border: `1px solid ${LINE}` }} />}
          <div>
            <strong>{item.title}</strong>
            {item.artist ? <div style={{ fontSize: 13, color: INK2 }}>by {item.artist}</div> : null}
            <div style={{ fontSize: 13, color: INK2 }}>{[item.size, item.quantity > 1 ? `× ${item.quantity}` : null].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
      ))}

      {status === "shipped" ? (
        <>
          <p style={{ margin: "16px 0 0" }}>It&apos;s with the carrier. Expect it in a few days.</p>
          {tracking && (
            <p style={{ margin: "12px 0 0" }}>
              <strong>{tracking.carrier} tracking:</strong> {tracking.number}
              {tracking.url && (
                <>
                  <br />
                  <a href={tracking.url} style={{ display: "inline-block", marginTop: 8, padding: "10px 16px", borderRadius: 999, background: BLUE, color: "#fff", fontWeight: 600, textDecoration: "none" }}>
                    Track your package
                  </a>
                </>
              )}
            </p>
          )}
        </>
      ) : (
        <p style={{ margin: "16px 0 0" }}>We hope you love it.</p>
      )}

      {certificates.map((c) => (
        <p key={c.url} style={{ margin: "12px 0 0" }}>
          <strong>{c.title}</strong> is a numbered edition.{" "}
          <a href={c.url} style={{ color: BLUE, fontWeight: 600 }}>Print the certificate</a>
        </p>
      ))}

      {helpUrl && (
        <p style={{ margin: "16px 0 0", fontSize: 14, color: INK2 }}>
          Something wrong?{" "}
          <a href={helpUrl} style={{ color: BLUE, fontWeight: 600 }}>Send us a photo</a> within 14 days of delivery and we&apos;ll reprint it free.
        </p>
      )}

      <p style={{ margin: "16px 0 0", fontSize: 14, color: INK2 }}>
        <a href={`${SITE_URL}/collector`} style={{ color: BLUE, fontWeight: 600 }}>Your orders</a>, any time.
      </p>

      <p style={{ margin: "16px 0 0", fontSize: 14 }}>— Artfinity</p>
    </div>
  );
}
