// /admin/orders/<id>/slip: printable packing slip for whoever packs the order: ship-to, the prints, and the artist's
// thank-you note for the parcel (Messages tagged [parcel], written on the Studio customer page), one note per card.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../../../_components/gate";
import { SIZE_LABEL, day } from "../../../_components/util";
import { PageHead } from "../../../_components/ui";
import { orderNumber } from "@/lib/printer";
import { normalizeSize } from "@/lib/sales";
import { PARCEL_TAG } from "@/lib/artistEmails";
import PrintSlipButton from "./PrintSlipButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Packing slip" };

export default async function PackingSlipPage({ params }: { params: { id: string } }) {
  await adminOrRedirect(`/admin/orders/${params.id}/slip`);
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      id: true, createdAt: true, shippingName: true, shippingAddress: true, email: true,
      items: { select: { id: true, title: true, size: true, frameChosen: true, frameColor: true, quantity: true, artistName: true, artwork: { select: { title: true, artist: { select: { artist_name: true, name: true } } } } } },
    },
  });
  if (!order) notFound();
  const notes = await prisma.message.findMany({
    where: { orderId: order.id, direction: "out", subject: { startsWith: PARCEL_TAG } },
    orderBy: { createdAt: "asc" },
    select: { id: true, body: true, artist: { select: { artist_name: true, name: true } } },
  });

  return (
    <div className="grid gap-6 print:block">
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: letter; margin: 0.6in; }
        @media print {
          html, body, body > div { background: #fff !important; min-height: 0 !important; }
          header, nav[aria-label="Admin"] { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          .slip-note { break-inside: avoid; }
        }
      ` }} />
      <div className="print:hidden">
        <PageHead back={{ href: `/admin/orders/${order.id}`, label: `Order ${orderNumber(order.id)}` }} title="Packing slip" sub={order.shippingName || order.email} action={<PrintSlipButton />} />
      </div>

      <section className="grid max-w-[7.3in] gap-5 rounded-2xl border border-edge bg-white p-6 text-[14px] print:max-w-none print:border-0 print:p-0">
        <div className="flex flex-wrap justify-between gap-4">
          <div className="grid gap-0.5">
            <span className="eyebrow">Ship to</span>
            <b className="text-[16px]">{order.shippingName || "No name"}</b>
            <span>{order.shippingAddress || "No address"}</span>
          </div>
          <div className="grid gap-0.5 text-right">
            <span className="eyebrow">Order</span>
            <span className="num">{orderNumber(order.id)}</span>
            <span className="text-ink-2">{day(order.createdAt)}</span>
          </div>
        </div>

        <table className="w-full text-left">
          <thead className="text-[12px] uppercase tracking-[0.06em] text-ink-2">
            <tr><th className="pb-1.5 font-bold">Print</th><th className="pb-1.5 font-bold">Size</th><th className="pb-1.5 text-right font-bold">Qty</th></tr>
          </thead>
          <tbody>
            {order.items.map((i) => {
              const size = normalizeSize(i.size);
              return (
                <tr key={i.id} className="border-t border-line">
                  <td className="py-1.5 pr-2"><b>{i.title || i.artwork?.title || "Untitled"}</b><div className="text-[13px] text-ink-2">{i.artistName || i.artwork?.artist.artist_name || i.artwork?.artist.name}</div></td>
                  <td className="py-1.5">{SIZE_LABEL[size] ?? size}{i.frameChosen ? `, framed${i.frameColor ? ` ${i.frameColor}` : ""}` : ""}</td>
                  <td className="num py-1.5 text-right">{i.quantity ?? 1}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {notes.length > 0 ? (
          <div className="grid gap-3">
            <span className="eyebrow print:hidden">Put this note in the parcel</span>
            {notes.map((n) => (
              <figure key={n.id} className="slip-note grid gap-3 rounded-xl border-[1.5px] border-dashed border-ink/40 p-5">
                <blockquote className="whitespace-pre-wrap text-[16px] leading-relaxed">{n.body}</blockquote>
                <figcaption className="text-[14px] font-semibold">— {n.artist.artist_name || n.artist.name}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-ink-2 print:hidden">No parcel note for this order.</p>
        )}
      </section>
    </div>
  );
}
