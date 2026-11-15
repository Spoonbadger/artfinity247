import * as React from "react";
import { Column, Img, Row, Section } from "@react-email/components";
import { SITE_URL } from "@/lib/urls";
import { HELP_DAYS_AFTER_DELIVERY } from "@/lib/reprintFormat";
import { A, C, EmailLayout, H1, P } from "./_layout";

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
  const row = (label: string, value: string, total = false) => (
    <Row style={{ borderTop: total ? `1px solid ${C.line}` : "none" }}>
      <Column style={{ padding: total ? "12px 16px" : "4px 16px", fontSize: total ? 16 : 14, fontWeight: total ? 700 : 400, color: total ? C.ink : C.ink2 }}>{label}</Column>
      <Column style={{ padding: total ? "12px 16px" : "4px 16px", fontSize: total ? 16 : 14, fontWeight: total ? 700 : 400, color: total ? C.ink : C.ink2, textAlign: "right", whiteSpace: "nowrap" }}>{value}</Column>
    </Row>
  );
  const ships = [shippingName, shippingAddressLine].filter(Boolean).join(", ");

  return (
    <EmailLayout
      preview={bulk ? `Order ${code}: your bulk prints are being printed.` : `Order ${code}: we're printing it now${arrives ? `, arriving ${arrives}` : ""}.`}
      footer={`You're getting this because you placed order ${code} on Artfinity.`}
    >
      <P muted small style={{ margin: "0 0 4px", fontWeight: 600 }}>Order {code}</P>
      <H1>{bulk ? "Your bulk prints are ordered" : "Thank you for your order"}</H1>
      <P>
        We&apos;re printing {bulk || items.length > 1 ? "them" : "it"} now.{arrives ? <> Expected to arrive <strong>{arrives}</strong>.</> : null}
        {!bulk && artists.length ? <> Your order supports {artists.join(" and ")}.</> : null}
        {bulk ? <> At cost. Bulk prints don&apos;t count as sales.</> : null}
      </P>

      <Section style={{ margin: "8px 0 24px", border: `1px solid ${C.line}`, borderRadius: 8 }}>
        {items.map((it, i) => (
          <Row key={i} style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
            {it.imageUrl ? (
              <Column style={{ width: 64, padding: "14px 0 14px 16px", verticalAlign: "top" }}>
                <Img src={it.imageUrl} alt="" width="48" height="60" style={{ display: "block", objectFit: "cover", borderRadius: 2, border: `1px solid ${C.line}` }} />
              </Column>
            ) : null}
            <Column style={{ width: "100%", padding: "14px 16px", verticalAlign: "top" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{it.title}</div>
              {it.artist ? <div style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>by {it.artist}</div> : null}
              <div style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>
                {[it.size, it.frame, (it.quantity ?? 1) > 1 ? `× ${it.quantity}` : null].filter(Boolean).join(" · ")}
              </div>
              {it.edition ? <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 2 }}>{it.edition}</div> : null}
            </Column>
            <Column style={{ padding: "14px 16px", verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap", fontSize: 15, fontWeight: 600, color: C.ink }}>
              {fmt((it.unitPrice ?? 0) * (it.quantity ?? 1))}
            </Column>
          </Row>
        ))}
        {subtotalCents != null ? (
          <Section style={{ borderTop: `1px solid ${C.line}`, padding: "8px 0" }}>
            {row("Prints", fmt(subtotalCents))}
            {bulk ? row("Handling, shipping and tax", fmt(extra)) : (
              <>
                {row("Shipping", "Free")}
                {row("Sales tax", fmt(Math.max(0, extra)))}
              </>
            )}
          </Section>
        ) : null}
        {row("Paid", fmt(totalCents), true)}
      </Section>

      {ships ? <P muted small>Ships to <span style={{ color: C.ink }}>{ships}</span></P> : null}
      {!bulk ? (
        <P muted small>
          <A href={`${SITE_URL}/collector`}>Track your orders</A> in a free collection{rewards ? " and earn rewards" : ""}. No password needed.
        </P>
      ) : null}
      <P muted small style={{ margin: 0 }}>
        Arrived damaged? We reprint it free within {HELP_DAYS_AFTER_DELIVERY} days of delivery (<A href={`${SITE_URL}/return-policy`}>returns policy</A>).
        For anything else, reply or write to{" "}
        <A href={`mailto:${SUPPORT}?subject=${encodeURIComponent(`Order ${code}`)}`}>{SUPPORT}</A> with order {code}.
      </P>
    </EmailLayout>
  );
}
