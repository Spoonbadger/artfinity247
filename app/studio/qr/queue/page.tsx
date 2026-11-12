import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import HelpLink from "@/components/help/HelpLink";
import PrintQueue, { type QueueGroup, type QueueOrder } from "@/components/qr/PrintQueue";
import { FORMATS, cardSVG, freeDesign, mixedSheetSVG, renderCard, sanitizeDesign, sheetLayout, type Card } from "@/components/qr/card";
import { loadFonts } from "@/components/qr/text";
import { jobsByFormat, loadQueue } from "@/lib/printQueue";
import { codePrintPricing, confirmFromSession, isInfinity, orderItems, summaryOf } from "@/lib/codePrints";
import { PAPER, perSheet, sheetsFor, type ShipAddress } from "@/lib/printQueueFormat";
import { requireArtist, displayName } from "../../_lib/data";
import PaymentReturn from "@/components/payments/PaymentReturn";
import { codeOrderNumber } from "@/lib/printQueueFormat";
import QueuePlaceTag from "@/components/places/QueuePlaceTag";
import { partnerChoices, placeOptions } from "@/lib/artistPlaces";

/** The Place every queued item is tagged to, when they all share one. */
async function queuePlace(artistId: string, ids: string[]) {
  const tags = await prisma.printQueueItem.findMany({ where: { artistId, id: { in: ids } }, select: { place: { select: { id: true, name: true } } } });
  const first = tags[0]?.place;
  return first && tags.every((t) => t.place?.id === first.id) ? first : null;
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Print queue" };

const MAX_SHEET_PREVIEWS = 6;
/** A card's SVG for a thumbnail: no fixed inch size, no own label (the list item names it). */
const thumb = (svg: string) => svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"').replace(/ width="[^"]*in" height="[^"]*in"/, "");

export default async function PrintQueuePage({ searchParams }: { searchParams: { paid?: string; session_id?: string; canceled?: string } }) {
  const artist = await requireArtist("/studio/qr/queue");

  // Back from Stripe: confirm the payment now in case the webhook hasn't arrived yet.
  if (searchParams.paid && searchParams.session_id) await confirmFromSession(searchParams.paid, searchParams.session_id, artist.id).catch(() => false);

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";
  const [rows, pricing, infinity, orders, pieces] = await Promise.all([
    loadQueue(artist.id),
    codePrintPricing(),
    isInfinity(artist.id),
    prisma.codePrintOrder.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.artwork.count({ where: { artistId: artist.id, status: { in: ["APPROVED", "PENDING"] }, slug: { not: null } } }),
  ]);

  let fonts: Awaited<ReturnType<typeof loadFonts>> | null = null;
  try { fonts = await loadFonts(); } catch (e) { console.error("print queue: fonts failed", e); }

  const groups: QueueGroup[] = [];
  for (const [format, list] of Array.from(jobsByFormat(rows, base).entries())) {
    if (!list.length) continue;
    const cards = new Map<string, Card>();
    const items = list.map((g, i) => {
      let svg = "";
      if (fonts) {
        try {
          // Same as the PDF: on Free, an Infinity look shows (and prints) as the closest free look.
          const c = renderCard(infinity ? g.job.design : freeDesign(g.job.design), g.job.art, fonts, g.job.qrText, `q-${format}-${i}`);
          cards.set(g.row.id, c);
          svg = thumb(cardSVG(c));
        } catch (e) { console.error("print queue: card failed", e); }
      }
      const d = sanitizeDesign(g.row.design);
      return {
        id: g.row.id, qty: g.qty, title: g.row.artwork.title, slug: g.row.artwork.slug || "", imageUrl: g.row.artwork.imageUrl,
        code: g.row.qrCode.code, preset: d.preset, venue: g.row.qrCode.venue, discountPct: g.row.qrCode.discountPct,
        live: g.row.qrCode.active, inReview: g.row.artwork.status === "PENDING", svg,
      };
    });
    // The sheets exactly as they'll print: each piece repeated qty times, packed in order.
    const flat: Card[] = [];
    for (const g of list) { const c = cards.get(g.row.id); if (c) for (let k = 0; k < g.qty; k++) flat.push(c); }
    const per = sheetLayout(format).slots.length;
    const sheets: string[] = [];
    for (let s = 0; s * per < flat.length && s < MAX_SHEET_PREVIEWS; s++) sheets.push(thumb(mixedSheetSVG(flat.slice(s * per, s * per + per), format, `${format}-${s}`)));
    const total = list.reduce((n, g) => n + g.qty, 0);
    groups.push({ format, name: FORMATS[format].name, size: `${FORMATS[format].w} × ${FORMATS[format].h} in`, perSheet: perSheet(format), sheetCount: sheetsFor(format, total), paper: PAPER[format], items, sheets });
  }

  const last = orders.find((o) => o.status !== "canceled") || orders[0];
  const address: ShipAddress = last
    ? { name: last.shipName, line1: last.shipLine1, line2: last.shipLine2 || "", city: last.shipCity, state: last.shipState, zip: last.shipZip }
    : { name: displayName(artist), line1: "", line2: "", city: artist.city || "", state: "NY", zip: "" }; // Artfinity artists are in NYC

  const history: QueueOrder[] = orders.map((o) => ({
    id: o.id, status: o.status, createdAt: o.createdAt.toISOString(), paidAt: o.paidAt?.toISOString() ?? null, shippedAt: o.shippedAt?.toISOString() ?? null, deliveredAt: o.deliveredAt?.toISOString() ?? null,
    summary: summaryOf(orderItems(o.items)), totalCents: o.totalCents, carrier: o.carrier, trackingNumber: o.trackingNumber, trackingUrl: o.trackingUrl, refundNote: o.refundNote,
  }));
  const { placeholder: _p, ...prices } = pricing;
  const paid = searchParams.paid ? history.find((o) => o.id === searchParams.paid) ?? null : null;
  const canceled = searchParams.canceled ? history.find((o) => o.id === searchParams.canceled && o.status === "pending") ?? null : null;

  return (
    <StudioPage
      title="Print queue"
      sub="Print your codes at home on label sheets, or we mail them laminated."
      actions={<><HelpLink href="/help/qr-codes/print-queue" /><Link href="/studio/codes" className="btn btn-ghost btn-sm">My codes</Link><Link href="/studio/qr" className="btn btn-ghost btn-sm">QR Studio</Link></>}
    >
      {paid && paid.status !== "pending" && <PaymentReturn kind="paid" message={`Paid. Order ${codeOrderNumber(paid.id)} is in`} description="Receipt sent to your email." strip={["paid", "session_id"]} />}
      {canceled && <PaymentReturn kind="canceled" message="Nothing was charged" description="Your codes are still in the queue." strip={["canceled"]} />}
      {/* Places hook: tag the whole batch to one Place (lib/artistPlaces.ts). */}
      {rows.length > 0 && (
        <QueuePlaceTag places={await placeOptions(artist.id)} partners={await partnerChoices(artist.id)} current={await queuePlace(artist.id, rows.map((r) => r.id))} />
      )}
      <PrintQueue groups={groups} pricing={prices} infinity={infinity} orders={history} address={address} pieces={pieces} paid={paid} canceled={canceled} testMode={!process.env.STRIPE_SECRET_KEY} />
    </StudioPage>
  );
}
