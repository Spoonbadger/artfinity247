import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../../_components/gate";
import { SIZE_LABEL, usd } from "../../_components/util";
import ActionButton from "../../_components/ActionButton";
import NotesPanel from "../../_components/NotesPanel";
import AuditList from "../../_components/AuditList";
import { itemBreakdown, normalizeSize } from "@/lib/sales";
import { activeRefunds } from "@/lib/refunds";
import { requestsForOrder } from "@/lib/reprints";
import { REPRINT_REASONS, reasonLabel } from "@/lib/reprintFormat";
import { CARRIERS, TRACKING_SUBJECT, parseTrackingMessage } from "@/lib/tracking";
import { PARCEL_TAG } from "@/lib/artistEmails";
import { certPath } from "@/lib/certificates";
import { editionLabel } from "@/lib/editionFormat";
import { orderNumber, printerAuto, printerState } from "@/lib/printer";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return { title: `Order ${orderNumber(params.id)}` };
}

const at = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : "";

type Event = { at: Date | null; title: string; detail?: React.ReactNode; tone: "done" | "warn" | "info" };

export default async function AdminOrderPage({ params }: { params: { id: string } }) {
  await adminOrRedirect(`/admin/orders/${params.id}`);
  const o = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: {
          artwork: { select: { id: true, title: true, slug: true, editionSize: true, artist: { select: { id: true, artist_name: true, name: true, slug: true } } } },
          review: { select: { id: true, rating: true, body: true, status: true, createdAt: true } },
        },
      },
    },
  });
  if (!o) notFound();

  const [messages, refunds, reprints, notes, audit, reprintOrders] = await Promise.all([
    prisma.message.findMany({ where: { orderId: o.id, OR: [{ subject: { startsWith: TRACKING_SUBJECT } }, { subject: { startsWith: PARCEL_TAG } }] }, orderBy: { createdAt: "asc" }, select: { id: true, subject: true, body: true, createdAt: true, direction: true, artist: { select: { artist_name: true, name: true } } } }),
    activeRefunds([o.id]),
    requestsForOrder(o.id),
    prisma.adminNote.findMany({ where: { targetType: "order", targetId: o.id }, orderBy: { createdAt: "desc" } }),
    prisma.adminAction.findMany({ where: { OR: [{ targetType: "order", targetId: o.id }, { details: { path: ["orderId"], equals: o.id } }] }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.order.findMany({ where: { stripeSessionId: { startsWith: `reprint:${o.id}:` } }, select: { id: true, createdAt: true, shippingStatus: true } }),
  ]);
  // A reprint order points back at its original through its session id.
  const originalId = o.kind === "reprint" ? o.stripeSessionId.split(":")[1] : null;

  const tracking = messages.filter((m) => m.subject?.startsWith(TRACKING_SUBJECT)).map((m) => ({ at: m.createdAt, t: parseTrackingMessage(m.subject, m.body) }));
  const latestTracking = tracking.length ? tracking[tracking.length - 1].t : null;
  const parcel = messages.filter((m) => m.subject?.startsWith(PARCEL_TAG) && m.direction === "out");
  const printer = printerState(o);
  const sentToPrinterAt = o.printerSentAt ?? audit.filter((a) => a.action === "order.sent_to_printer").at(-1)?.createdAt ?? null;
  const deliveredAt = audit.find((a) => (a.action === "order.shipping_status" || a.action === "order.ship") && (a.details as { to?: string } | null)?.to === "delivered")?.createdAt ?? null;
  const paid = o.paymentStatus === "paid";

  const items = o.items.map((it) => {
    const b = itemBreakdown({ ...it, orderDate: o.createdAt });
    const shared = o.kind === "bulk" ? 0 : b.artistShare;
    const refund = refunds.get(it.id);
    return {
      it, b, refund,
      artistShare: refund?.reversed ? 0 : shared,
      edition: editionLabel(it.editionNumber, it.quantity, it.artwork?.editionSize),
      cert: paid && it.editionNumber && it.artworkId ? certPath(it.id) : null,
      artist: it.artwork?.artist,
    };
  });

  const events: Event[] = [
    { at: o.createdAt, title: paid ? `Paid ${usd(o.amountTotal)}` : o.kind === "reprint" ? "Free reprint created" : `Order created (${o.paymentStatus})`, tone: paid || o.kind === "reprint" ? "done" : "warn" },
    ...(o.receiptSentAt && o.kind !== "reprint" ? [{ at: o.receiptSentAt, title: "Receipt emailed", tone: "info" as const }] : []),
    sentToPrinterAt || o.sentToPrinter
      ? { at: sentToPrinterAt, title: o.printerSentAt ? "Work order sent to the printer" : "Marked sent to printer", tone: "done" as const }
      : printer.status === "failed"
        ? { at: null, title: "Work order failed to send", detail: printer.error, tone: "warn" as const }
        : { at: null, title: "Not sent to the printer yet", tone: "warn" as const },
    ...tracking.map((x) => ({ at: x.at, title: "Shipped", detail: x.t ? <>{x.t.carrier} <b className="num">{x.t.number}</b>{x.t.url && <> · <a href={x.t.url} target="_blank" rel="noreferrer" className="text-scan">Track</a></>}</> : undefined, tone: "done" as const })),
    ...(o.shippingStatus !== "pending" && !tracking.length ? [{ at: null, title: "Marked shipped (no tracking saved)", tone: "info" as const }] : []),
    ...(o.shippingStatus === "delivered" ? [{ at: deliveredAt, title: "Delivered", tone: "done" as const }] : []),
    ...o.items.filter((it) => it.review).map((it) => ({ at: it.review!.createdAt, title: `Review: ${"★".repeat(it.review!.rating)}`, detail: <>{it.title}{it.review!.status !== "published" ? ` · ${it.review!.status}` : ""}{it.review!.body ? ` · “${it.review!.body.slice(0, 120)}”` : ""}</>, tone: "info" as const })),
    ...reprints.flatMap((r) => [
      { at: r.createdAt, title: `Reprint requested: ${reasonLabel(r.body.reason)}`, detail: r.body.note || undefined, tone: r.status === "open" ? ("warn" as const) : ("info" as const) },
      ...(r.decidedAt ? [{ at: r.decidedAt, title: `Reprint ${r.status}`, detail: r.body.decision?.reprintOrderId ? <Link href={`/admin/orders/${r.body.decision.reprintOrderId}`} className="text-scan">Reprint order {orderNumber(r.body.decision.reprintOrderId)}</Link> : r.body.decision?.note, tone: "info" as const }] : []),
    ]),
    ...Array.from(refunds.values()).map((r) => ({ at: r.at, title: `Refund recorded ${usd(r.amountCents)}`, detail: `${r.reversed ? `Artist share ${usd(r.shareCents)} reversed` : "Already paid out: artist keeps their share"} · ${r.adminEmail}`, tone: "warn" as const })),
  ];
  events.sort((a, b) => (a.at?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.at?.getTime() ?? Number.MAX_SAFE_INTEGER));

  const url = `/api/admin/orders/${o.id}`;
  const statusUrl = `/api/orders/${o.id}/status`;
  const itemOptions = [{ value: "all", label: "All prints in the order" }, ...o.items.map((it) => ({ value: it.id, label: `${it.title || "Print"} · ${SIZE_LABEL[normalizeSize(it.size)]}${(it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : ""}` }))];

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Link href="/admin/orders" className="text-[13.5px] font-semibold text-ink-2 no-underline hover:text-ink">← Orders</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{at(o.createdAt)} ET</p>
            <h1 className="display text-[40px] sm:text-[52px]">Order {orderNumber(o.id)}</h1>
          </div>
          <b className="num text-[28px] text-earned">{usd(o.amountTotal)}</b>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip c={paid ? "bg-earned-soft text-earned" : "bg-coral/15 text-coral"}>{o.paymentStatus}</Chip>
          {o.kind !== "retail" && <Chip c="bg-[#f3dcc8] text-ink">{o.kind === "reprint" ? "Free reprint" : o.kind === "bulk" ? "Bulk (artist at cost)" : o.kind}</Chip>}
          <Chip c="bg-scan-soft text-scan">{o.shippingStatus}</Chip>
          {refunds.size > 0 && <Chip c="bg-coral/15 text-coral">{refunds.size === o.items.length ? "Refunded" : `${refunds.size} line${refunds.size === 1 ? "" : "s"} refunded`}</Chip>}
          {originalId && <Link href={`/admin/orders/${originalId}`} className="text-[13px] font-semibold text-scan">Original order {orderNumber(originalId)}</Link>}
          {reprintOrders.map((r) => <Link key={r.id} href={`/admin/orders/${r.id}`} className="text-[13px] font-semibold text-scan">Reprint {orderNumber(r.id)}</Link>)}
        </div>
      </div>

      <section aria-label="Actions" className="af-card flex flex-wrap gap-2 p-4">
        {o.shippingStatus === "pending" && (
          <ActionButton url={statusUrl} body={{ shippingStatus: "shipped" }} label="Mark shipped" tone="blue" title="Mark shipped"
            confirm="The buyer gets the shipped email with this tracking link (the artist's own wording if they wrote one)."
            fields={[
              { name: "carrier", label: "Carrier", type: "select", defaultValue: "USPS", options: CARRIERS.map((c) => ({ value: c, label: c })) },
              { name: "trackingNumber", label: "Tracking number", required: true, placeholder: "9400 1000 0000 0000 0000 00" },
              { name: "trackingUrl", label: "Tracking link (only for Other)", placeholder: "https://" },
            ]} confirmLabel="Mark shipped" done="Marked shipped. Buyer emailed." />
        )}
        {o.shippingStatus === "shipped" && (
          <ActionButton url={statusUrl} body={{ shippingStatus: "delivered" }} label="Mark delivered" tone="blue" title="Mark delivered?"
            confirm="The buyer gets the delivered email and, a little later, a request to review their print." confirmLabel="Mark delivered" done="Marked delivered" />
        )}
        {(paid || o.kind === "reprint") && printerAuto() && (
          <ActionButton url={`/api/admin/orders/${o.id}/work-order`} label={printer.status === "sent" ? "Resend work order" : "Send work order"} title="Send the work order to the print lab?"
            confirm={printer.status === "sent" ? `It went out ${at(o.printerSentAt)}. The lab gets it again: make sure they don't print it twice.` : "The lab gets the order with links to the original files and the packing slip."}
            confirmLabel="Send" done="Work order sent" />
        )}
        <a href={`/admin/orders/${o.id}/slip`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">Packing slip</a>
        {paid && o.kind !== "bulk" && (
          <ActionButton url={url} body={{ action: "reprint" }} label="Create reprint" title="Create a free reprint"
            confirm="Makes a zero-charge reprint order, sends it to the lab and emails the buyer. No sale, no payout."
            fields={[
              { name: "itemId", label: "What to reprint", type: "select", defaultValue: "all", options: itemOptions },
              { name: "reason", label: "Why", type: "select", defaultValue: "damaged", options: REPRINT_REASONS.map((r) => ({ value: r.id, label: r.label })) },
              { name: "note", label: "Note for the buyer", type: "textarea", placeholder: "Optional" },
            ]} confirmLabel="Create reprint" done="Reprint created and sent to the lab" />
        )}
        {paid && (
          <ActionButton url={url} body={{ action: "resend_receipt" }} label="Resend receipt" title="Resend the receipt?" confirm={`Sends the receipt to ${o.email} again.`} confirmLabel="Send"
            done="Receipt sent" />
        )}
        {o.shippingStatus !== "pending" && (
          <ActionButton url={url} body={{ action: "resend_shipped" }} label={`Resend ${o.shippingStatus} email`} title={`Resend the ${o.shippingStatus} email?`}
            confirm={`Sends the ${o.shippingStatus} email${o.shippingStatus === "shipped" && latestTracking ? ` with ${latestTracking.carrier} ${latestTracking.number}` : ""} to ${o.email} again.`} confirmLabel="Send" done="Email sent" />
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <section className="af-card grid gap-3 p-4">
            <h2 className="text-[17px] font-bold">Prints</h2>
            <ul className="divide-y divide-line">
              {items.map(({ it, b, refund, artistShare, edition, cert, artist }) => (
                <li key={it.id} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[56px_minmax(0,1fr)_auto]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.imageUrl ? <img src={it.imageUrl} alt="" className="h-[70px] w-[56px] rounded-[3px] object-cover" /> : <span className="h-[70px] w-[56px] rounded-[3px] bg-gallery" />}
                  <div className="min-w-0 text-[14px]">
                    <b className="block truncate">{it.title || it.artwork?.title || "Untitled"}</b>
                    <span className="block text-[13px] text-ink-2">
                      {artist ? <Link href={`/admin/artists/${artist.id}`} className="font-semibold text-ink hover:text-scan">{artist.artist_name || artist.name}</Link> : it.artistName}
                      {" · "}{SIZE_LABEL[normalizeSize(it.size)]}{it.frameChosen ? `, framed ${it.frameColor || ""}` : ""}{b.quantity > 1 ? ` · ×${b.quantity}` : ""}
                    </span>
                    {edition && <span className="block text-[13px]">{edition}{cert && <> · <a href={cert} target="_blank" rel="noopener" className="font-semibold text-scan">Certificate</a></>}</span>}
                    <span className="num block text-[12.5px] text-ink-2">
                      {usd(b.lineTotal)} paid · {usd(b.expenses)} costs · artist {usd(artistShare)}{refund?.reversed ? <s className="ml-1">{usd(b.artistShare)}</s> : null} · Artfinity {usd(b.companyShare)}
                    </span>
                    {refund && (
                      <span className="mt-1 block rounded-md bg-coral/10 px-2 py-1 text-[12.5px] font-semibold text-coral">
                        Refunded {usd(refund.amountCents)} on {at(refund.at)}. {refund.reversed ? "Artist share reversed." : "Was already paid out: the artist keeps their share."}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                    {it.artworkId && <a href={`/api/admin/originals/${it.artworkId}?src=${encodeURIComponent(it.imageUrl || "")}`} className="text-[13px] font-semibold text-scan">Full-res file</a>}
                    {paid && o.kind !== "bulk" && !refund && (
                      <ActionButton url={url} body={{ action: "refund", itemId: it.id }} label="Mark refunded" tone="danger" title={`Record a refund for “${it.title || "this print"}”?`}
                        confirm={<>
                          <p>This only records it. Refund the buyer <b>{usd(b.lineTotal)}</b> (plus any tax) in the Stripe dashboard yourself.</p>
                          <p className="mt-2">If the artist hasn&apos;t been paid for this month yet, their share of <b>{usd(b.artistShare)}</b> is taken off their balance. If it was already paid out, they keep it.</p>
                        </>}
                        fields={[{ name: "note", label: "Why", type: "textarea", placeholder: "e.g. Arrived damaged, buyer didn't want a reprint" }]} confirmLabel="Record refund" done="Refund recorded" />
                    )}
                    {refund && (
                      <ActionButton url={url} body={{ action: "refund_undo", itemId: it.id }} label="Undo refund" title="Cancel this refund record?"
                        confirm="Use this if it was recorded by mistake. The artist's share counts again. It doesn't touch Stripe." confirmLabel="Undo refund" done="Refund cancelled" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="af-card grid gap-2 p-4">
            <h2 className="text-[17px] font-bold">Timeline</h2>
            <ol className="relative grid gap-3 border-l-2 border-line pl-5">
              {events.map((e, i) => (
                <li key={i} className="relative">
                  <span aria-hidden="true" className={cn("absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white", e.tone === "done" ? "bg-earned" : e.tone === "warn" ? "bg-coral" : "bg-scan")} />
                  <p className="text-[14.5px] font-semibold">{e.title}</p>
                  <p className="text-[12.5px] text-ink-2">{e.at ? `${at(e.at)} ET` : "—"}{e.detail ? <> · {e.detail}</> : null}</p>
                </li>
              ))}
            </ol>
          </section>

          {parcel.length > 0 && (
            <section className="af-card grid gap-2 p-4">
              <h2 className="text-[17px] font-bold">Print this note in the parcel</h2>
              {parcel.map((n) => (
                <figure key={n.id} className="grid gap-1.5 rounded-lg border-[1.5px] border-dashed border-ink/30 bg-white p-3">
                  <blockquote className="whitespace-pre-wrap text-[14px] leading-relaxed">{n.body}</blockquote>
                  <figcaption className="text-[12.5px] text-ink-2">— {n.artist.artist_name || n.artist.name}</figcaption>
                </figure>
              ))}
            </section>
          )}
        </div>

        <div className="grid content-start gap-6">
          <section className="af-card grid gap-2 p-4 text-[14px]">
            <h2 className="text-[17px] font-bold">Buyer</h2>
            <p><b>{o.shippingName || "No name"}</b><br /><a href={`mailto:${o.email}`} className="text-scan">{o.email}</a></p>
            <p className="eyebrow mt-1">Ship to</p>
            <p className="whitespace-pre-line text-ink-2">{o.shippingAddress?.split(", ").join("\n") || "No address"}</p>
            <p className="eyebrow mt-1">Printer</p>
            <p className={cn("text-ink-2", printer.status === "failed" && "font-semibold text-coral")}>
              {printer.status === "sent" ? `Work order sent ${at(printer.at)}` : printer.status === "failed" ? `Failed: ${printer.error}` : printer.status === "sending" ? "Sending…" : o.sentToPrinter ? "Marked sent by hand" : "Not sent"}
              {o.printerRef && printer.status === "sent" ? ` · ref ${o.printerRef}` : ""}
            </p>
            <p className="eyebrow mt-1">Stripe</p>
            <p className="break-all text-[12.5px] text-ink-2">{o.stripeSessionId}</p>
          </section>

          <NotesPanel targetType="order" targetId={o.id} notes={notes.map((n) => ({ id: n.id, adminEmail: n.adminEmail, body: n.body, createdAt: n.createdAt.toISOString() }))} />

          <section className="af-card grid gap-2 p-4">
            <h2 className="text-[17px] font-bold">Audit trail</h2>
            <AuditList rows={audit} compact empty="No admin actions on this order yet." />
          </section>
        </div>
      </div>
    </div>
  );
}

function Chip({ c, children }: { c: string; children: React.ReactNode }) {
  return <span className={cn("inline-block rounded-full px-2 py-px text-[12px] font-bold", c)}>{children}</span>;
}
