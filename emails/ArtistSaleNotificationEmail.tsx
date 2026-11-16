import * as React from "react";
import { Column, Row, Section } from "@react-email/components";
import { SITE_URL } from "@/lib/urls";
import { C, CTA, EmailLayout, H1, P } from "./_layout";

type Item = {
  title: string;
  size: string;
  quantity: number;
  lineTotal: number;
}

export default function ArtistSaleNotificationEmail({
  artistName,
  items,
  totalCents,
}: {
  artistName: string;
  items: Item[];
  totalCents: number;
}) {
  const fmt = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const cell = { padding: "12px 16px", verticalAlign: "top" as const };

  return (
    <EmailLayout preview={`You sold ${items.length === 1 ? items[0].title : `${items.length} prints`} on Artfinity.`} footer="You're getting this because you sell prints on Artfinity.">
      <H1>You made a sale</H1>
      <P>Hi {artistName},</P>
      <P>Someone just ordered {items.length === 1 ? "a print" : "prints"} of your work.</P>

      <Section style={{ margin: "0 0 24px", border: `1px solid ${C.line}`, borderRadius: 8 }}>
        {items.map((item, i) => (
          <Row key={i} style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <Column style={cell}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{item.title}</div>
              <div style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>
                {item.size}{item.quantity > 1 ? ` · × ${item.quantity}` : ""}
              </div>
            </Column>
            <Column style={{ ...cell, textAlign: "right", whiteSpace: "nowrap", fontSize: 15, color: C.ink }}>{fmt(item.lineTotal)}</Column>
          </Row>
        ))}
        {items.length > 1 ? (
          <Row style={{ borderTop: `1px solid ${C.line}` }}>
            <Column style={{ ...cell, fontSize: 15, fontWeight: 700, color: C.ink }}>Total</Column>
            <Column style={{ ...cell, textAlign: "right", fontSize: 15, fontWeight: 700, color: C.ink }}>{fmt(totalCents)}</Column>
          </Row>
        ) : null}
      </Section>

      <P>It&apos;ll be included in your next monthly payout.</P>
      <CTA href={`${SITE_URL}/studio/sales`} secondary last>See your sales</CTA>
    </EmailLayout>
  );
}
