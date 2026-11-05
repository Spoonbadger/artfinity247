import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { artPath } from "@/lib/urls";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import { requireArtist, STUDIO_TZ, usd } from "../_lib/data";
import { orderItems, summaryOf } from "@/lib/codePrints";
import { STATUS_DAB, STATUS_LABEL, codeOrderNumber, isOrderStatus } from "@/lib/printQueueFormat";

export const dynamic = "force-dynamic";
export const metadata = { title: "My purchases" };

const SIZE: Record<string, string> = { S: "Small", M: "Medium", L: "Large", XL: "XL", small: "Small", medium: "Medium", large: "Large", xl: "XL" };

// Prints this artist bought from other artists (matched by account email).
export default async function PurchasesPage() {
  const artist = await requireArtist("/studio/purchases");
  const items = await prisma.orderItem.findMany({
    where: { order: { email: { equals: artist.email, mode: "insensitive" } } },
    orderBy: { order: { createdAt: "desc" } },
    select: {
      id: true, slug: true, size: true, quantity: true, lineTotal: true, title: true, artistName: true, imageUrl: true,
      order: { select: { createdAt: true, shippingStatus: true } },
      artwork: { select: { slug: true, artist: { select: { slug: true } } } },
    },
  });

  // QR codes we printed and mailed to this artist (print queue → "Have us print them").
  const codeOrders = await prisma.codePrintOrder.findMany({ where: { artistId: artist.id, status: { not: "canceled" } }, orderBy: { createdAt: "desc" }, take: 20 });
  const day = (d: Date) => d.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "short", day: "numeric", year: "numeric" });

  return (
    <StudioPage title="My purchases" sub="Prints you've bought on Artfinity, and QR codes we printed for you.">
      {codeOrders.length > 0 && (
        <section aria-labelledby="code-orders-h" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="code-orders-h" className="text-[20px] font-bold">Code orders</h2>
            <Link href="/studio/qr/queue#orders" className="text-[14px] font-semibold text-scan">Print queue</Link>
          </div>
          <ul className="grid gap-3">
            {codeOrders.map((o) => {
              const st = isOrderStatus(o.status) ? o.status : "pending";
              return (
                <li key={o.id} className="af-panel flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
                  <div className="min-w-0 flex-1">
                    <b className="num">{codeOrderNumber(o.id)}</b> <span className="text-ink-2">· {summaryOf(orderItems(o.items))}</span>
                    <div className="text-[13.5px] text-ink-2">
                      Laminated, pre-cut, mailed · ordered {day(o.createdAt)}{o.shippedAt ? ` · shipped ${day(o.shippedAt)}` : ""}{o.deliveredAt ? ` · delivered ${day(o.deliveredAt)}` : ""}
                    </div>
                  </div>
                  <div className="grid justify-items-end gap-1">
                    <b className="num">{usd(o.totalCents)}</b>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-wall px-2 py-0.5 text-[11.5px] font-bold text-ink-2">
                      <i className="paint-dab h-2 w-2" style={{ ["--dab" as string]: STATUS_DAB[st] }} aria-hidden="true" />{STATUS_LABEL[st]}
                    </span>
                  </div>
                  {o.trackingNumber && (o.trackingUrl
                    ? <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Track {o.carrier}</a>
                    : <span className="text-[13px] text-ink-2">{o.carrier} {o.trackingNumber}</span>)}
                  {st === "pending" && <Link href="/studio/qr/queue#orders" className="btn btn-blue btn-sm">Finish paying</Link>}
                </li>
              );
            })}
          </ul>
          {items.length > 0 && <h2 className="mt-3 text-[20px] font-bold">Prints</h2>}
        </section>
      )}
      {items.length === 0 ? (
        <EmptyState
          title={codeOrders.length ? "No prints bought yet" : "No purchases yet"}
          body={<>Prints you buy from other artists show here, with their shipping status. We match orders to <b>{artist.email}</b>, so check out with that email.</>}
          action={{ label: "Browse art", href: "/art" }}
          secondary={{ label: "Find artists", href: "/artists" }}
          help={{ label: "Bought with another email?", href: "/help/buyers/orders-and-wishlist" }}
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((i) => (
            <li key={i.id} className="af-panel flex items-center gap-4 p-3">
              {i.imageUrl ? <img src={i.imageUrl} alt={i.title || "Artwork"} className="h-16 w-14 shrink-0 rounded object-cover" /> : <span className="h-16 w-14 shrink-0 rounded bg-wall" />}
              <div className="min-w-0 flex-1">
                {i.artwork?.slug ? <Link href={artPath(i.artwork.artist.slug, i.artwork.slug)} className="font-bold text-ink no-underline hover:text-scan">{i.title}</Link> : <b>{i.title}</b>}
                <div className="text-[13.5px] text-ink-2">
                  {i.artistName} · {SIZE[i.size || ""] || i.size} · ×{i.quantity || 1} · {i.order.createdAt.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div className="grid justify-items-end gap-1">
                <b className="num">{usd(i.lineTotal || 0)}</b>
                <span className="rounded-full bg-wall px-2 py-0.5 text-[11.5px] font-bold capitalize text-ink-2">{i.order.shippingStatus}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </StudioPage>
  );
}
