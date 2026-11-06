import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminRoleOrRedirect } from "../../_components/gate";
import ActionButton from "../../_components/ActionButton";
import { usd } from "../../_components/util";
import { FORMATS, cardSVG, renderCard, sanitizeDesign, type ArtInfo } from "@/components/qr/card";
import { loadFonts } from "@/components/qr/text";
import { countsOf, orderItems } from "@/lib/codePrints";
import { CARRIERS } from "@/lib/tracking";
import { FORMAT_ORDER, PAPER, STATUS_DAB, STATUS_LABEL, cardWords, codeOrderNumber, isOrderStatus, sheetsFor } from "@/lib/printQueueFormat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Code order" };

const when = (d: Date | null) => (d ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : null);
const thumb = (svg: string) => svg.replace(/ width="[^"]*in" height="[^"]*in"/, "");

export default async function CodeOrderPage({ params }: { params: { id: string } }) {
  await adminRoleOrRedirect(`/admin/code-orders/${params.id}`);
  const o = await prisma.codePrintOrder.findUnique({ where: { id: params.id } });
  if (!o) notFound();
  const items = orderItems(o.items);
  const counts = countsOf(items);
  const st = isOrderStatus(o.status) ? o.status : "pending";
  const no = codeOrderNumber(o.id);
  const paid = !["pending", "canceled"].includes(st);
  const audit = await prisma.adminAction.findMany({ where: { targetType: "code_order", targetId: o.id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, adminEmail: true, summary: true, createdAt: true } });

  let fonts: Awaited<ReturnType<typeof loadFonts>> | null = null;
  try { fonts = await loadFonts(); } catch { /* thumbnails fall back to the painting */ }
  const thumbs = items.map((i, k) => {
    if (!fonts) return "";
    try { return thumb(cardSVG(renderCard({ ...sanitizeDesign(i.design), format: i.format }, i.art as ArtInfo, fonts, i.qrText, `a${k}`))); } catch { return ""; }
  });

  const steps: [string, Date | null][] = [["Ordered", o.createdAt], ["Paid", o.paidAt], ["Printing", o.printingAt], ["Shipped", o.shippedAt], ["Delivered", o.deliveredAt]];

  return (
    <div className="grid max-w-[980px] gap-6">
      <div>
        <Link href="/admin/code-orders" className="text-[13.5px] font-semibold text-scan">← Code orders</Link>
        <h1 className="display mt-1 text-[40px] sm:text-[52px]">{no}</h1>
        <p className="flex flex-wrap items-center gap-2 text-[14.5px] text-ink-2">
          <span className="inline-flex items-center gap-1.5 font-bold text-ink"><i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: STATUS_DAB[st] }} aria-hidden="true" />{STATUS_LABEL[st]}</span>
          · {o.cards} cards · {usd(o.totalCents)} ·{" "}
          {o.artistId ? <Link href={`/admin/artists/${o.artistId}`} className="font-semibold text-scan">{o.artistName || o.email}</Link> : (o.artistName || o.email)}
        </p>
      </div>

      <section aria-labelledby="todo-h" className="af-card grid gap-4 p-4 sm:p-5">
        <h2 id="todo-h" className="t-card">Print and ship</h2>
        {!paid && <p className="rounded-xl bg-wall p-3 text-[14px]">{st === "pending" ? "Not paid yet. Nothing to print until the artist finishes checkout." : "The artist canceled before paying."}</p>}
        <ol className="grid gap-3 text-[14.5px]">
          <li className="grid gap-2">
            <b>1. Download the print-ready PDFs</b>
            <div className="flex flex-wrap gap-2">
              {FORMAT_ORDER.filter((f) => counts[f]).map((f) => (
                <a key={f} href={`/api/admin/code-orders/${o.id}/pdf?format=${f}`} className="btn btn-blue btn-sm">
                  {FORMATS[f].name}s PDF · {cardWords(f, counts[f]!)} · {sheetsFor(f, counts[f]!)} {sheetsFor(f, counts[f]!) === 1 ? "sheet" : "sheets"}
                </a>
              ))}
            </div>
            <span className="text-[13px] text-ink-2">US Letter, 100% scale, crop marks on every sheet, order number in the footer. Laminate, then cut on the marks. {FORMAT_ORDER.filter((f) => counts[f]).map((f) => `${FORMATS[f].name}s: ${PAPER[f].buy}.`).join(" ")}</span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <b>2.</b>
            <ActionButton url={`/api/admin/code-orders/${o.id}`} body={{ action: "printing" }} label="Mark printing" title={`Mark ${no} printing?`} confirm="The artist sees “Printing” on their print queue." confirmLabel="Mark printing" done="Marked printing" need="orders" disabled={!paid || st !== "paid"} />
            <ActionButton
              url={`/api/admin/code-orders/${o.id}`} body={{ action: "shipped" }} tone="blue" need="orders" disabled={!paid || st === "delivered"}
              label={st === "shipped" ? "Fix tracking" : "Mark shipped"} title={`Ship ${no}`} confirmLabel="Save and email the artist" done="Shipped. The artist has the tracking link."
              confirm={<>Emails {o.email} the tracking link. Mailing to {o.shipName}, {o.shipCity}, {o.shipState}.</>}
              fields={[
                { name: "carrier", label: "Carrier", type: "select", defaultValue: o.carrier || "USPS", options: CARRIERS.map((c) => ({ value: c, label: c })) },
                { name: "trackingNumber", label: "Tracking number", required: true, defaultValue: o.trackingNumber || "" },
                { name: "trackingUrl", label: "Tracking link (only for Other)", placeholder: "https://…", defaultValue: o.carrier === "Other" ? o.trackingUrl || "" : "" },
              ]}
            />
            <ActionButton url={`/api/admin/code-orders/${o.id}`} body={{ action: "delivered" }} label="Mark delivered" title={`Mark ${no} delivered?`} confirm="Emails the artist that their codes arrived." confirmLabel="Mark delivered" done="Marked delivered" need="orders" disabled={!paid || st === "delivered"} />
          </li>
        </ol>
        {o.trackingNumber && (
          <p className="text-[14px]">Tracking: <b>{o.carrier} {o.trackingNumber}</b>{o.trackingUrl && <> · <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="font-semibold text-scan">Track it</a></>}</p>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="ship-h" className="af-card grid content-start gap-2 p-4 sm:p-5">
          <h2 id="ship-h" className="t-card">Mail to</h2>
          <address className="text-[15px] not-italic leading-relaxed">
            {o.shipName}<br />{o.shipLine1}{o.shipLine2 && <><br />{o.shipLine2}</>}<br />{o.shipCity}, {o.shipState} {o.shipZip}<br />United States
          </address>
          <p className="text-[13px] text-ink-2">{o.email}</p>
        </section>
        <section aria-labelledby="money-h" className="af-card grid content-start gap-2 p-4 sm:p-5">
          <h2 id="money-h" className="t-card">Paid</h2>
          <table className="w-full text-[14px]">
            <caption className="sr-only">Amounts</caption>
            <tbody>
              <tr><td className="py-1">Cards</td><td className="num py-1 text-right">{usd(o.subtotalCents)}</td></tr>
              <tr><td className="py-1">Shipping</td><td className="num py-1 text-right">{usd(o.shippingCents)}</td></tr>
              {o.handlingCents > 0 && <tr><td className="py-1">Handling</td><td className="num py-1 text-right">{usd(o.handlingCents)}</td></tr>}
              <tr className="border-t border-line"><th scope="row" className="py-1 text-left">Total</th><td className="num py-1 text-right font-bold">{usd(o.totalCents)}</td></tr>
            </tbody>
          </table>
          <p className="text-[13px] text-ink-2">{o.stripeSessionId?.startsWith("dev_") ? "Test checkout (no Stripe keys): no money was taken." : o.stripeSessionId ? `Stripe session ${o.stripeSessionId}` : "No checkout yet."}</p>
          {o.refundNote && <p className="rounded-lg bg-coral/10 p-2 text-[13.5px]"><b>Refund:</b> {o.refundNote}{o.refundedAt && <span className="text-ink-2"> · {when(o.refundedAt)}</span>}</p>}
          <ActionButton
            url={`/api/admin/code-orders/${o.id}`} body={{ action: "refund_note" }} need="money" className="justify-self-start"
            label={o.refundNote ? "Edit refund note" : "Add refund note"} title="Refund note" confirmLabel="Save note" done="Refund note saved"
            confirm="Refund the payment in the Stripe dashboard first, then note what was refunded and why. The artist sees the note on their order."
            fields={[{ name: "note", label: "Note", type: "textarea", required: true, defaultValue: o.refundNote || "", placeholder: "Refunded $5.00 shipping: arrived bent" }]}
          />
        </section>
      </div>

      <section aria-labelledby="items-h" className="af-card grid gap-3 p-4 sm:p-5">
        <h2 id="items-h" className="t-card">Cards</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((i, k) => (
            <li key={`${i.qrCodeId}-${i.format}`} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <div className="grid h-20 w-20 shrink-0 place-items-center [&>svg]:max-h-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: thumbs[k] }} />
              <div className="grid min-w-0 gap-0.5 text-[14px]">
                <b className="truncate">{i.art.title}</b>
                <span className="text-ink-2">{cardWords(i.format, i.qty)} · code <b className="text-ink">{i.code}</b></span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="log-h" className="af-card grid gap-3 p-4 sm:p-5">
        <h2 id="log-h" className="t-card">Timeline</h2>
        <ol className="flex flex-wrap gap-x-5 gap-y-1 text-[13.5px]">
          {steps.map(([l, d]) => <li key={l} className={d ? "text-ink" : "text-ink-2"}><b>{l}</b> {when(d) || "—"}</li>)}
        </ol>
        {audit.length > 0 && (
          <ul className="grid gap-1 border-t border-line pt-3 text-[13px] text-ink-2">
            {audit.map((a) => <li key={a.id}>{when(a.createdAt)} · {a.adminEmail} · {a.summary}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
