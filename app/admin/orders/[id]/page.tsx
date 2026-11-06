import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../../_components/gate";
import { SIZE_LABEL, usd } from "../../_components/util";
import ActionButton from "../../_components/ActionButton";
import MoreMenu from "../../_components/MoreMenu";
import { PageHead, Pill, StatusPill } from "../../_components/ui";
import NotesPanel from "../../_components/NotesPanel";
import AuditList from "../../_components/AuditList";
import { itemBreakdown, normalizeSize } from "@/lib/sales";
import { activeRefunds, type RefundInfo } from "@/lib/refunds";
import { REFUND_REASONS, REFUND_REASON_LABEL, refundPolicy } from "@/lib/refundPolicy";
import { requestsForOrder } from "@/lib/reprints";
import { REPRINT_REASONS, reasonLabel } from "@/lib/reprintFormat";
import { CARRIERS, TRACKING_SUBJECT, parseTrackingMessage } from "@/lib/tracking";
import { getTracking } from "@/lib/shipping/store";
import { PARCEL_TAG } from "@/lib/artistEmails";
import { certPath } from "@/lib/certificates";
import { editionLabel } from "@/lib/editionFormat";
import { orderNumber, printerAuto, printerState } from "@/lib/printer";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return { title: `Order ${orderNumber(params.id)}` };
}

/** What happened to the artist's share, in a few words (lib/refunds.ts). */
const refundOutcome = (r: RefundInfo) =>
  r.reversed ? "Artist share reversed." : r.deducted ? `Was already paid out: ${usd(r.shareCents)} comes off the artist's next payout (Refund adjustment).` : "Was already paid out: the artist keeps their share.";

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

  const [messages, refunds, reprints, notes, audit, reprintOrders, policy] = await Promise.all([
    prisma.message.findMany({ where: { orderId: o.id, OR: [{ subject: { startsWith: TRACKING_SUBJECT } }, { subject: { startsWith: PARCEL_TAG } }] }, orderBy: { createdAt: "asc" }, select: { id: true, subject: true, body: true, createdAt: true, direction: true, artist: { select: { artist_name: true, name: true } } } }),
    activeRefunds([o.id]),
    requestsForOrder(o.id),
    prisma.adminNote.findMany({ where: { targetType: "order", targetId: o.id }, orderBy: { createdAt: "desc" } }),
    prisma.adminAction.findMany({ where: { OR: [{ targetType: "order", targetId: o.id }, { details: { path: ["orderId"], equals: o.id } }] }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.order.findMany({ where: { stripeSessionId: { startsWith: `reprint:${o.id}:` } }, select: { id: true, createdAt: true, shippingStatus: true } }),
    refundPolicy(),
  ]);
  // A reprint order points back at its original through its session id.
  const originalId = o.kind === "reprint" ? o.stripeSessionId.split(":")[1] : null;

  const trackingMsgs = messages.filter((m) => m.subject?.startsWith(TRACKING_SUBJECT)).map((m) => ({ at: m.createdAt, t: parseTrackingMessage(m.subject, m.body) }));
  // Tracking columns first (lib/shipping/store.ts); older orders only have the Messages.
  const colTracking = await getTracking(o.id);
  const tracking = trackingMsgs.length || !colTracking ? trackingMsgs : [{ at: o.shippedAt ?? o.createdAt, t: colTracking }];
  const latestTracking = tracking.length ? tracking[tracking.length - 1].t : null;
  const parcel = messages.filter((m) => m.subject?.startsWith(PARCEL_TAG) && m.direction === "out");
  const printer = printerState(o);
  const sentToPrinterAt = o.printerSentAt ?? audit.filter((a) => a.action === "order.sent_to_printer").at(-1)?.createdAt ?? null;
  const deliveredAt = o.deliveredAt ?? audit.find((a) => (a.action === "order.shipping_status" || a.action === "order.ship") && (a.details as { to?: string } | null)?.to === "delivered")?.createdAt ?? null;
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
    ...Array.from(refunds.values()).map((r) => ({ at: r.at, title: `Refund recorded ${usd(r.amountCents)}`, detail: `${REFUND_REASON_LABEL[r.reason]} · ${r.reversed ? `Artist share ${usd(r.shareCents)} reversed` : r.deducted ? `Already paid out: ${usd(r.shareCents)} off the artist's next payout` : "Already paid out: artist keeps their share"} · ${r.adminEmail}`, tone: "warn" as const })),
  ];
  // Steps with no recorded time sit right after the step before them (events are built in order).
  let last = o.createdAt.getTime();
  const keyed = events.map((e, i) => {
    last = e.at ? e.at.getTime() : last;
    return { e, key: last, i };
  });
  keyed.sort((x, y) => x.key - y.key || x.i - y.i);
  const timeline = keyed.map((k) => k.e);

  const url = `/api/admin/orders/${o.id}`;
  const statusUrl = `/api/orders/${o.id}/status`;
  const itemOptions = [{ value: "all", label: "All prints in the order" }, ...o.items.map((it) => ({ value: it.id, label: `${it.title || "Print"} · ${SIZE_LABEL[normalizeSize(it.size)]}${(it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : ""}` }))];

  return (
    <div className="grid gap-6">
      <PageHead
        back={{ href: "/admin/orders", label: "Orders" }}
        title={<>Order {orderNumber(o.id)} <span className="num text-earned">{usd(o.amountTotal)}</span></>}
        sub={`${at(o.createdAt)} · ${o.shippingName || o.email}`}
        action={
          <>
            {o.shippingStatus === "pending" && (
              <ActionButton url={statusUrl} body={{ shippingStatus: "shipped" }} label="Mark shipped" tone="blue" title="Mark shipped"
                confirm="Marks it shipped and emails the buyer this tracking link."
                fields={[
                  { name: "carrier", label: "Carrier", type: "select", defaultValue: "USPS", options: CARRIERS.map((c) => ({ value: c, label: c })) },
                  { name: "trackingNumber", label: "Tracking number", required: true, placeholder: "9400 1000 0000 0000 0000 00" },
                  { name: "trackingUrl", label: "Tracking link (only for Other)", placeholder: "https://" },
                ]} confirmLabel="Mark shipped" done="Marked shipped. Buyer emailed." />
            )}
            {o.shippingStatus === "shipped" && (
              <ActionButton url={statusUrl} body={{ shippingStatus: "delivered" }} label="Mark delivered" tone="blue" title="Mark delivered?"
                confirm="Emails the buyer that it was delivered, then asks for a review." confirmLabel="Mark delivered" done="Marked delivered" />
            )}
            <a href={`/admin/orders/${o.id}/slip`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">Packing slip</a>
            <MoreMenu>
              {(paid || o.kind === "reprint") && printerAuto() && (
                <ActionButton url={`/api/admin/orders/${o.id}/work-order`} label={printer.status === "sent" ? "Resend work order" : "Send work order"} title="Send the work order to the print lab?"
                  confirm={printer.status === "sent" ? `It went out ${at(o.printerSentAt)}. Sending again can get it printed twice.` : "Sends the lab the original files and packing slip. They start printing."}
                  confirmLabel="Send" done="Work order sent" />
              )}
              {paid && o.kind !== "bulk" && (
                <ActionButton url={url} body={{ action: "reprint" }} label="Create reprint" title="Create a free reprint"
                  confirm="Sends a free order to the print lab now and emails the buyer. Artfinity pays for the print. No sale, no payout."
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
            </MoreMenu>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={o.paymentStatus} />
          {o.kind !== "retail" && <Pill tone="amber">{o.kind === "reprint" ? "Free reprint" : o.kind === "bulk" ? "Bulk (artist at cost)" : o.kind}</Pill>}
          <StatusPill status={o.shippingStatus} />
          {refunds.size > 0 && <Pill tone="red">{refunds.size === o.items.length ? "Refunded" : `${refunds.size} line${refunds.size === 1 ? "" : "s"} refunded`}</Pill>}
          {originalId && <Link href={`/admin/orders/${originalId}`} className="text-[13px] font-semibold text-scan">Original order {orderNumber(originalId)}</Link>}
          {reprintOrders.map((r) => <Link key={r.id} href={`/admin/orders/${r.id}`} className="text-[13px] font-semibold text-scan">Reprint {orderNumber(r.id)}</Link>)}
        </div>
      </PageHead>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <section className="af-panel grid gap-3 p-4">
            <h2 className="t-card">Prints</h2>
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
                    <span className="num block text-[13px] text-ink-2">
                      {usd(b.lineTotal)} paid · {usd(b.expenses)} costs · artist {usd(artistShare)}{refund?.reversed ? <s className="ml-1">{usd(b.artistShare)}</s> : null} · Artfinity {usd(b.companyShare)}
                    </span>
                    {refund && (
                      <span className="mt-1 block rounded-md bg-coral/10 px-2 py-1 text-[13px] font-semibold text-coral">
                        Refunded {usd(refund.amountCents)} on {at(refund.at)} ({REFUND_REASON_LABEL[refund.reason].toLowerCase()}). {refundOutcome(refund)}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                    {it.artworkId && <a href={`/api/admin/originals/${it.artworkId}?src=${encodeURIComponent(it.imageUrl || "")}`} className="text-[13px] font-semibold text-scan">Full-res file</a>}
                    {paid && o.kind !== "bulk" && !refund && (
                      <ActionButton url={url} body={{ action: "refund", itemId: it.id }} need="money" label="Mark refunded" tone="danger" title={`Record a refund for “${it.title || "this print"}”?`}
                        confirm={<>
                          <p className="font-semibold text-ink">Records the refund only. Refund the buyer {usd(b.lineTotal)} plus tax in Stripe yourself.</p>
                          <p className="mt-2">The artist&apos;s <b>{usd(b.artistShare)}</b> comes off their balance if this month isn&apos;t paid yet.</p>
                          <p className="mt-2">
                            Already paid out:{" "}
                            {policy.policy === "deduct_next_payout"
                              ? <>returns and chargebacks come off their next payout; Artfinity absorbs anything else.</>
                              : <>Artfinity absorbs it.</>}{" "}
                            <Link href="/admin/settings" className="font-semibold text-scan">Refund setting</Link>
                          </p>
                        </>}
                        fields={[
                          { name: "reason", label: "Reason", type: "select", required: true, defaultValue: "", options: [{ value: "", label: "Pick one…" }, ...REFUND_REASONS.map((r) => ({ value: r, label: REFUND_REASON_LABEL[r] }))] },
                          { name: "note", label: "Note", type: "textarea", placeholder: "e.g. Arrived damaged, buyer didn't want a reprint" },
                        ]} confirmLabel="Record refund" done="Refund recorded" />
                    )}
                    {refund && (
                      <ActionButton url={url} body={{ action: "refund_undo", itemId: it.id }} need="money" label="Undo refund" title="Cancel this refund record?"
                        confirm="For a refund recorded by mistake. The artist's share counts again. Stripe isn't touched." confirmLabel="Undo refund" done="Refund cancelled" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="af-panel grid gap-2 p-4">
            <h2 className="t-card">Timeline</h2>
            <ol className="relative grid gap-3 border-l-2 border-line pl-5">
              {timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span aria-hidden="true" className={cn("absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white", e.tone === "done" ? "bg-earned" : e.tone === "warn" ? "bg-coral" : "bg-scan")} />
                  <p className="text-[14.5px] font-semibold">{e.title}</p>
                  <p className="text-[13px] text-ink-2">{e.at ? at(e.at) : "—"}{e.detail ? <> · {e.detail}</> : null}</p>
                </li>
              ))}
            </ol>
          </section>

          {parcel.length > 0 && (
            <section className="af-panel grid gap-2 p-4">
              <h2 className="t-card">Print this note in the parcel</h2>
              {parcel.map((n) => (
                <figure key={n.id} className="grid gap-1.5 rounded-lg border-[1.5px] border-dashed border-ink/30 bg-white p-3">
                  <blockquote className="whitespace-pre-wrap text-[14px] leading-relaxed">{n.body}</blockquote>
                  <figcaption className="text-[13px] text-ink-2">— {n.artist.artist_name || n.artist.name}</figcaption>
                </figure>
              ))}
            </section>
          )}
        </div>

        <div className="grid content-start gap-6">
          <section className="af-panel grid gap-2 p-4 text-[14px]">
            <h2 className="t-card">Buyer</h2>
            <p><b>{o.shippingName || "No name"}</b><br /><a href={`mailto:${o.email}`} className="text-scan">{o.email}</a></p>
            <p className="eyebrow mt-1">Ship to</p>
            <p className="whitespace-pre-line text-ink-2">{o.shippingAddress?.split(", ").join("\n") || "No address"}</p>
            <p className="eyebrow mt-1">Printer</p>
            <p className={cn("text-ink-2", printer.status === "failed" && "font-semibold text-coral")}>
              {printer.status === "sent" ? `Work order sent ${at(printer.at)}` : printer.status === "failed" ? `Failed: ${printer.error}` : printer.status === "sending" ? "Sending…" : o.sentToPrinter ? "Marked sent by hand" : "Not sent"}
              {o.printerRef && printer.status === "sent" ? ` · ref ${o.printerRef}` : ""}
            </p>
            <p className="eyebrow mt-1">Stripe</p>
            <p className="break-all text-[13px] text-ink-2">{o.stripeSessionId}</p>
          </section>

          <NotesPanel targetType="order" targetId={o.id} notes={notes.map((n) => ({ id: n.id, adminEmail: n.adminEmail, body: n.body, createdAt: n.createdAt.toISOString() }))} />

          <details className="af-panel p-4">
            <summary className="t-card cursor-pointer">Audit trail <span className="num text-[13px] font-normal text-ink-2">{audit.length}</span></summary>
            <div className="mt-2"><AuditList rows={audit} compact empty="No admin actions on this order yet." /></div>
          </details>
        </div>
      </div>
    </div>
  );
}


