import * as React from "react";
import { SITE_URL } from "@/lib/urls";
import { HELP_DAYS_AFTER_DELIVERY } from "@/lib/reprintFormat";

const SUPPORT = "support@theartfinity.com";

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

// Artfinity's paint (Garnet Rose): black cherry ink, garnet, a soft gallery wall.
const INK = "#2e1219"; // --af-ink
const INK2 = "#694c54"; // --af-ink-2
const GARNET = "#8b2a4b"; // --af-scan
const LINE = "#ecdcd8"; // --af-line

export default function ReceiptEmail({
  code,
  bulk = false,
  subtotalCents,
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
  /** An artist's own prints at cost (/studio/bulk): no "supports the artist", no collection line. */
  bulk?: boolean;
  /** The prints before tax (and, for bulk, before handling). The difference to totalCents is shown as its own line. */
  subtotalCents?: number;
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
  const extra = subtotalCents != null ? totalCents - subtotalCents : 0;
  const row = (label: string, value: string, bold = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: bold ? "12px 0" : "4px 0", borderTop: bold ? `1px solid ${LINE}` : "none", fontWeight: bold ? 700 : 400, color: bold ? INK : INK2, fontSize: bold ? 16 : 14 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif", color: INK, maxWidth: 560 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: INK2 }}>Order {code}</p>
      <h1 style={{ margin: "6px 0 4px", fontSize: 28, lineHeight: 1.1 }}>{bulk ? "Your bulk prints are ordered" : "It\u2019s yours"}</h1>
      <p style={{ margin: "0 0 20px", fontSize: 16, color: INK2 }}>
        We&apos;re printing {bulk || items.length > 1 ? "them" : "it"} now.{arrives ? <> Arrives <strong style={{ color: INK }}>{arrives}</strong>.</> : null}
        {!bulk && artists.length ? <> Your order supports {artists.join(" and ")}.</> : null}
        {bulk ? <> At cost. Bulk prints don&apos;t count as sales.</> : null}
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
        {subtotalCents != null ? (
          <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 8 }}>
            {row("Prints", fmt(subtotalCents))}
            {bulk ? row("Handling, shipping and tax", fmt(extra)) : (
              <>
                {row("Shipping", "Free")}
                {row("Sales tax", fmt(Math.max(0, extra)))}
              </>
            )}
          </div>
        ) : null}
        {row("Paid", fmt(totalCents), true)}
      </div>

      {shippingName || shippingAddressLine ? (
        <p style={{ margin: "16px 0 0", fontSize: 14, color: INK2 }}>
          Ships to <span style={{ color: INK }}>{[shippingName, shippingAddressLine].filter(Boolean).join(", ")}</span>
        </p>
      ) : null}

      <p style={{ margin: "16px 0 0", fontSize: 14, color: INK2 }}>
        Arrives damaged? We reprint it free within {HELP_DAYS_AFTER_DELIVERY} days of delivery.{" "}
        <a href={`${SITE_URL}/return-policy`} style={{ color: GARNET, fontWeight: 600 }}>Returns</a>
      </p>
      <p style={{ margin: "12px 0 0", fontSize: 14, color: INK2 }}>
        Questions? Reply to this email or write to{" "}
        <a href={`mailto:${SUPPORT}?subject=${encodeURIComponent(`Order ${code}`)}`} style={{ color: GARNET, fontWeight: 600 }}>{SUPPORT}</a> with order {code}.
      </p>
      {!bulk ? (
        <p style={{ margin: "12px 0 0", fontSize: 14, color: INK2 }}>
          <a href={`${SITE_URL}/collector`} style={{ color: GARNET, fontWeight: 600 }}>Track your orders</a> in a free collection{rewards ? " and earn rewards" : ""}. No password.
        </p>
      ) : null}
      <p style={{ margin: "20px 0 0", fontSize: 14 }}>— Artfinity</p>
    </div>
  );
}
