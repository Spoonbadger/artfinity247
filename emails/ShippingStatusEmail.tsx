import * as React from "react";
import { Column, Img, Row, Section } from "@react-email/components";
import { SITE_URL } from "@/lib/urls";
import { HELP_DAYS_AFTER_DELIVERY } from "@/lib/reprintFormat";
import { A, C, CTA, EmailLayout, H1, P } from "./_layout";

type Item = {
  title: string;
  /** Friendly size, e.g. "Medium · 8 × 12 in" (lib/orderText.ts). */
  size: string;
  quantity: number;
  imageUrl: string | null;
  artist?: string | null;
};

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
  const shipped = status === "shipped";
  const many = items.length > 1 || items.some((i) => i.quantity > 1);
  const first = name === "Customer" ? "there" : name.trim().split(/\s+/)[0] || name;
  return (
    <EmailLayout
      preview={shipped ? `Order ${code} is with the carrier${tracking ? ` (${tracking.carrier} ${tracking.number})` : ""}.` : `Order ${code} was delivered.`}
      footer={`You're getting this because you placed order ${code} on Artfinity.`}
    >
      <P muted small style={{ margin: "0 0 4px", fontWeight: 600 }}>Order {code}</P>
      <H1>{shipped ? `Your ${many ? "prints are" : "print is"} on the way` : `Your ${many ? "prints were" : "print was"} delivered`}</H1>
      <P>Hi {first},</P>
      <P>{shipped ? "It's with the carrier now and should reach you in a few days." : "We hope it looks great on your wall."}</P>

      <Section style={{ margin: "0 0 24px", border: `1px solid ${C.line}`, borderRadius: 8 }}>
        {items.map((item, i) => (
          <Row key={i} style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
            {item.imageUrl ? (
              <Column style={{ width: 64, padding: "14px 0 14px 16px", verticalAlign: "top" }}>
                <Img src={item.imageUrl} alt="" width="48" height="60" style={{ display: "block", objectFit: "cover", borderRadius: 2, border: `1px solid ${C.line}` }} />
              </Column>
            ) : null}
            <Column style={{ width: "100%", padding: "14px 16px", verticalAlign: "top" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{item.title}</div>
              {item.artist ? <div style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>by {item.artist}</div> : null}
              <div style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>{[item.size, item.quantity > 1 ? `× ${item.quantity}` : null].filter(Boolean).join(" · ")}</div>
            </Column>
          </Row>
        ))}
      </Section>

      {shipped && tracking ? (
        <>
          <P muted small style={{ margin: "0 0 4px" }}>{tracking.carrier} tracking number</P>
          <P style={{ fontWeight: 600, margin: tracking.url ? "0 0 8px" : "0 0 24px" }}>{tracking.number}</P>
          {tracking.url ? <CTA href={tracking.url}>Track your package</CTA> : null}
        </>
      ) : null}

      {certificates.map((c) => (
        <P key={c.url}>
          <strong>{c.title}</strong> is a numbered edition. <A href={c.url}>Print its certificate of authenticity</A>.
        </P>
      ))}

      {helpUrl ? (
        <P muted small>
          Something wrong with it? <A href={helpUrl}>Send us a photo</A> within {HELP_DAYS_AFTER_DELIVERY} days of delivery and we&apos;ll take a look.
        </P>
      ) : null}
      <P muted small style={{ margin: 0 }}>
        See all your orders any time in <A href={`${SITE_URL}/collector`}>your collection</A>.
      </P>
    </EmailLayout>
  );
}
