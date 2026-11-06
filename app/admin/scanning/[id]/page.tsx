import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminRoleOrRedirect } from "../../_components/gate";
import ActionButton from "../../_components/ActionButton";
import ScanFileRow, { type ScanItemView } from "../_components/ScanFileRow";
import { prisma } from "@/lib/prisma";
import { artworksFor, loadBooking, readScanSettings } from "@/lib/scanning.server";
import { HANDOFF_LABEL, STATUS_DAB, STATUS_LABEL, STATUS_STEPS, bandLabel, dayLabel, estimate, estimateText, isItemBand, usd, type ItemBand, type ScanStatus } from "@/lib/scanning";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scan booking" };

const stamp = (d: Date | null) => (d ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : null);

export default async function ScanBookingPage({ params }: { params: { id: string } }) {
  await adminRoleOrRedirect(`/admin/scanning/${params.id}`);
  const b = await loadBooking(params.id);
  if (!b) notFound();
  const [s, artist, arts, own] = await Promise.all([
    readScanSettings(),
    prisma.artist.findUnique({ where: { id: b.artistId }, select: { id: true, name: true, artist_name: true, email: true, phone: true, slug: true } }),
    artworksFor([b]),
    prisma.artwork.findMany({ where: { artistId: b.artistId, status: { not: "REJECTED" } }, orderBy: { createdAt: "desc" }, select: { id: true, title: true } }),
  ]);
  const st = b.status as ScanStatus;
  const band = (k: string) => (isItemBand(k) ? k : "oversized") as ItemBand;
  const live = estimate(b.items.map((i) => ({ band: band(i.band) })), b.handoff === "pickup" ? "pickup" : "dropoff", s);
  const name = artist?.artist_name || artist?.name || "Unknown artist";
  const step = STATUS_STEPS.indexOf(st);
  const linked = new Set(b.items.map((i) => i.artworkId).filter(Boolean));
  const canFile = ["paid", "scanning", "delivered"].includes(st);
  const items: ScanItemView[] = b.items.map((i) => {
    const a = i.artworkId ? arts.get(i.artworkId) : undefined;
    return {
      id: i.id, band: bandLabel(band(i.band), s.bands), title: a?.title ?? i.title, artworkId: i.artworkId, slug: a?.slug ?? null, imageUrl: a?.imageUrl ?? null,
      printableNow: a?.printableSizes ?? [], before: i.previousPrintable, scanned: !!i.scanUrl, canUndo: !!i.scanUrl && !!i.previousImageUrl,
      size: i.widthIn && i.heightIn ? `${i.widthIn} × ${i.heightIn} in` : null,
    };
  });
  const options = own.filter((a) => !linked.has(a.id)).map((a) => ({ id: a.id, title: a.title }));
  const missing = b.items.filter((i) => i.artworkId && !i.scanUrl).length;

  const timeline: [string, Date | null][] = [
    ["Requested", b.createdAt], ["Confirmed", b.confirmedAt], ["Paid", b.paidAt], ["Received", b.receivedAt],
    ["Scanning", b.scanningAt], ["Delivered", b.deliveredAt], ["Returned", b.returnedAt], ["Cancelled", b.cancelledAt],
  ];

  return (
    <div className="grid max-w-[1100px] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow"><Link href="/admin/scanning" className="text-ink-2 no-underline hover:text-ink">Scanning</Link> · booking</p>
          <h1 className="display text-[40px] sm:text-[52px]">{name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink"><i className="paint-dab !h-2.5 !w-2.5" style={{ ["--dab" as string]: STATUS_DAB[st] }} aria-hidden="true" />{STATUS_LABEL[st]}</span>
            <span>{b.items.length} {b.items.length === 1 ? "painting" : "paintings"}</span>
            <span>{HANDOFF_LABEL[b.handoff as "dropoff" | "pickup"]}</span>
            {artist && <Link href={`/admin/artists/${artist.id}`} className="font-semibold text-scan">Artist profile</Link>}
          </p>
        </div>
      </div>

      {st !== "cancelled" && (
        <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" aria-label="Progress">
          {STATUS_STEPS.map((x, i) => (
            <li key={x} className={cn("rounded-lg border px-2 py-1.5 text-[13px] font-semibold", i < step ? "border-earned/40 bg-earned-soft" : i === step ? "border-ink bg-white" : "border-line text-ink-2")}>
              {STATUS_LABEL[x].split(" ·")[0]}<span className="sr-only">{i < step ? " (done)" : i === step ? " (now)" : ""}</span>
            </li>
          ))}
        </ol>
      )}

      {/* The next action for this state */}
      <section aria-labelledby="next-h" className="af-card grid gap-3 p-4 sm:p-5">
        <h2 id="next-h" className="t-card">Next step</h2>
        <p className="text-[14.5px] text-ink-2">
          {st === "requested" && "Pick a date from the artist's choices (or another), set the final price and confirm. The artist gets an email and a pay button in their Studio."}
          {st === "confirmed" && `Waiting for the artist to pay ${usd(b.priceCents ?? 0)}. They have the pay button in their Studio and an email. You can change the date or price by confirming again.`}
          {st === "paid" && (b.receivedAt ? "Paintings received. Start scanning when you're ready." : `Paid. Mark the paintings received when they arrive (${b.handoff === "pickup" ? "pickup" : "drop-off"} ${b.scheduledFor ? dayLabel(b.scheduledFor) : ""}).`)}
          {st === "scanning" && (missing ? `Upload the scan for each painting below (${missing} to go), then mark it delivered.` : "Every scan is on its artwork. Mark it delivered to email the artist.")}
          {st === "delivered" && "Files delivered. Mark returned once the artist has their paintings back (this also clears the old images kept for undo)."}
          {st === "returned" && "Closed. Nothing left to do."}
          {st === "cancelled" && `Cancelled: ${b.cancelReason || "no reason given"}.${b.paidAt ? " It was paid: refund it in Stripe if you haven't." : ""}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {(st === "requested" || st === "confirmed") && (
            <ActionButton
              url={`/api/admin/scanning/${b.id}`} body={{ step: "confirm" }} need="money" tone="blue" label={st === "confirmed" ? "Change date or price" : "Confirm booking"} title="Confirm the booking"
              confirm={<>Live estimate: <b>{estimateText(live)}</b>. Price 0 confirms it as free (no payment). The artist gets an email{b.handoff === "dropoff" ? " with the drop-off details" : ""}.</>}
              fields={[
                { name: "date", label: `${b.handoff === "pickup" ? "Pickup" : "Drop-off"} date (YYYY-MM-DD)`, required: true, defaultValue: b.scheduledFor ? b.scheduledFor.toISOString().slice(0, 10) : b.preferredDates[0] ?? "", hint: b.preferredDates.length ? `Artist asked for ${b.preferredDates.join(", ")}` : undefined },
                { name: "price", label: "Final price ($)", type: "number", required: true, defaultValue: b.priceCents != null ? String(b.priceCents / 100) : live.knownCents ? String(live.knownCents / 100) : "", hint: live.complete ? undefined : "Includes pieces to quote: add them in." },
                ...(b.handoff === "dropoff"
                  ? [{ name: "dropoffInfo", label: "Drop-off address and instructions", type: "textarea" as const, defaultValue: b.dropoffInfo || s.dropoffAddress, placeholder: "Street, buzzer, hours, who to ask for", hint: s.dropoffAddress ? undefined : "Set a default in Settings → Scanning service." }]
                  : [{ name: "dropoffInfo", label: "Pickup notes for the artist (optional)", type: "textarea" as const, defaultValue: b.dropoffInfo ?? "", placeholder: "Time window, what to have ready" }]),
              ]}
              confirmLabel="Confirm and email the artist"
            />
          )}
          {["confirmed", "paid", "scanning"].includes(st) && !b.receivedAt && (
            <ActionButton url={`/api/admin/scanning/${b.id}`} body={{ step: "received" }} need="orders" label="Mark received" title="Paintings received?" confirm="The artist gets an email saying their paintings are safely with us." confirmLabel="Mark received" />
          )}
          {st === "paid" && <ActionButton url={`/api/admin/scanning/${b.id}`} body={{ step: "scanning" }} need="orders" tone="blue" label="Start scanning" title="Start scanning" confirm="Marks the booking as scanning (and received, if it isn't yet)." confirmLabel="Start scanning" />}
          {(st === "scanning" || st === "paid") && (
            <ActionButton url={`/api/admin/scanning/${b.id}`} body={{ step: "delivered" }} need="orders" tone={missing ? "ghost" : "blue"} disabled={missing > 0 || !b.items.some((i) => i.scanUrl)} label={missing ? `Mark delivered (${missing} to upload)` : "Mark delivered"} title="Mark delivered" confirm="Emails the artist: “Your scans are in — you can now sell up to …”, with their biggest new print size." confirmLabel="Mark delivered" />
          )}
          {st === "delivered" && <ActionButton url={`/api/admin/scanning/${b.id}`} body={{ step: "returned" }} need="orders" tone="blue" label="Mark returned" title="Paintings returned?" confirm="Closes the booking, emails the artist, and deletes the old images kept for undo (unless an order still prints from them)." confirmLabel="Mark returned" />}
          {st !== "returned" && st !== "cancelled" && (
            <ActionButton url={`/api/admin/scanning/${b.id}`} body={{ step: "cancel" }} need="money" tone="danger" label="Cancel booking" title="Cancel this booking?" confirm={<>The artist gets an email with your reason.{b.paidAt ? " It's paid: refund it in Stripe too (the email says it will be refunded)." : ""} Scans already on artworks stay.</>} fields={[{ name: "reason", label: "Reason (the artist sees this)", type: "textarea", placeholder: "We can't take very large pieces this month." }]} confirmLabel="Cancel booking" />
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="items-h" className="af-card grid content-start gap-3 p-4 sm:p-5">
          <div>
            <h2 id="items-h" className="t-card">Paintings and scan files</h2>
            <p className="text-[13.5px] text-ink-2">
              {canFile
                ? "Upload each high-res scan (JPG, PNG, TIFF or WEBP, up to 120 MB). It replaces the artwork's image through the normal pipeline and re-measures its print sizes. The old image is kept until the booking is returned, so Undo works until then."
                : st === "requested" || st === "confirmed" ? "Files can be uploaded once the booking is paid." : "Uploads are closed for this booking."}
            </p>
          </div>
          <ul className="grid gap-3">
            {items.map((it) => <ScanFileRow key={it.id} item={it} canFile={canFile} options={options} />)}
          </ul>
        </section>

        <div className="grid content-start gap-6">
          <section aria-labelledby="details-h" className="af-card grid gap-2 p-4 sm:p-5 text-[14px]">
            <h2 id="details-h" className="t-card">Details</h2>
            <dl className="grid gap-2">
              <Row k="Artist">{name}{artist ? <span className="block text-ink-2">{artist.email}{artist.phone ? ` · ${artist.phone}` : ""}</span> : null}</Row>
              <Row k="Handoff">{HANDOFF_LABEL[b.handoff as "dropoff" | "pickup"]}{b.pickupAddress && <span className="block whitespace-pre-line text-ink-2">{b.pickupAddress}</span>}</Row>
              <Row k="Asked for">{b.preferredDates.map((d) => dayLabel(d)).join(", ") || "—"}</Row>
              <Row k="Date">{b.scheduledFor ? dayLabel(b.scheduledFor, { weekday: "long", month: "long", day: "numeric" }) : "Not set"}</Row>
              <Row k="Estimate">{estimateText(live)}{b.estimateCents != null && b.estimateCents !== live.knownCents ? <span className="block text-ink-2">At booking: {usd(b.estimateCents)}</span> : null}</Row>
              <Row k="Final price">{b.priceCents != null ? usd(b.priceCents) : "Not set"}{b.stripeSessionId?.startsWith("dev_") ? <span className="block text-ink-2">Test payment (no Stripe)</span> : null}</Row>
              {b.dropoffInfo && <Row k={b.handoff === "pickup" ? "Pickup notes" : "Drop-off"}><span className="whitespace-pre-line">{b.dropoffInfo}</span></Row>}
              {b.notes && <Row k="Artist's notes"><span className="whitespace-pre-line">{b.notes}</span></Row>}
            </dl>
          </section>

          <section aria-labelledby="time-h" className="af-card grid gap-2 p-4 sm:p-5 text-[14px]">
            <h2 id="time-h" className="t-card">Timeline</h2>
            <ul className="grid gap-1">
              {timeline.filter(([, d]) => d).map(([k, d]) => (
                <li key={k} className="flex justify-between gap-3"><span>{k}</span><span className="num text-ink-2">{stamp(d)}</span></li>
              ))}
            </ul>
            <Link href="/admin/activity" className="text-[13px] font-semibold text-scan">Every step is in Activity</Link>
          </section>

          <section aria-labelledby="note-h" className="af-card grid gap-2 p-4 sm:p-5 text-[14px]">
            <h2 id="note-h" className="t-card">Team note</h2>
            <p className="whitespace-pre-line text-ink-2">{b.adminNote || "No note yet. Only admins see this."}</p>
            <ActionButton url={`/api/admin/scanning/${b.id}`} body={{ step: "note" }} need="orders" label={b.adminNote ? "Edit note" : "Add note"} title="Team note" confirm="Only admins see this." fields={[{ name: "note", label: "Note", type: "textarea", defaultValue: b.adminNote ?? "" }]} confirmLabel="Save note" className="justify-self-start" />
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
      <dt className="text-ink-2">{k}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
