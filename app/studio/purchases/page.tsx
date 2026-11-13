import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { artPath } from "@/lib/urls";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import { UrlPicker } from "@/components/money/SortSelect";
import { requireArtist, STUDIO_TZ, usd } from "../_lib/data";
import { orderItems, summaryOf } from "@/lib/codePrints";
import { STATUS_DAB, STATUS_LABEL, codeOrderNumber, isOrderStatus } from "@/lib/printQueueFormat";

export const dynamic = "force-dynamic";
export const metadata = { title: "My purchases" };

const SORTS = [{ value: "newest", label: "Newest" }, { value: "oldest", label: "Oldest" }, { value: "price", label: "Price" }];
const SIZE: Record<string, string> = { S: "Small", M: "Medium", L: "Large", XL: "XL", small: "Small", medium: "Medium", large: "Large", xl: "XL" };

// Prints this artist bought from other artists (matched by account email).
export default async function PurchasesPage({ searchParams }: { searchParams: { sort?: string } }) {
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
  const sort = SORTS.some((o) => o.value === searchParams.sort) ? searchParams.sort! : "newest";
  if (sort === "oldest") { items.reverse(); codeOrders.reverse(); }
  if (sort === "price") { items.sort((a, b) => (b.lineTotal || 0) - (a.lineTotal || 0)); codeOrders.sort((a, b) => b.totalCents - a.totalCents); }
  const day = (d: Date) => d.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "short", day: "numeric", year: "numeric" });

  return (
    <StudioPage
      title="My purchases"
      sub="Prints you bought and QR codes we mailed you."
      actions={items.length + codeOrders.length > 1 ? <UrlPicker param="sort" label="Sort purchases" value={sort} options={SORTS} storageKey="af:purchases:sort" /> : undefined}
    >
      {codeOrders.length > 0 && (
        <section aria-labelledby="code-orders-h" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="code-orders-h" className="t-card">Code orders</h2>
            <Link href="/studio/qr/queue#orders" className="text-[14px] font-semibold text-scan">Print queue</Link>
          </div>
          <ul className="grid gap-3">
            {codeOrders.map((o) => {
              const st = isOrderStatus(o.status) ? o.status : "pending";
              return (
                <li key={o.id} className="af-panel grid gap-2 p-3 sm:p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="num">{codeOrderNumber(o.id)}</b>
                    <b className="num">{usd(o.totalCents)}</b>
                  </div>
                  <p className="t-body">{summaryOf(orderItems(o.items))}</p>
                  <p className="t-small">
                    Ordered {day(o.createdAt)}{o.shippedAt ? ` · shipped ${day(o.shippedAt)}` : ""}{o.deliveredAt ? ` · delivered ${day(o.deliveredAt)}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-wall px-2.5 py-1 text-[13px] font-bold text-ink-2">
                      <i className="paint-dab h-2 w-2" style={{ ["--dab" as string]: STATUS_DAB[st] }} aria-hidden="true" />{STATUS_LABEL[st]}
                    </span>
                    {o.trackingNumber && (o.trackingUrl
                      ? <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Track {o.carrier}</a>
                      : <span className="text-[13px] text-ink-2">{o.carrier} {o.trackingNumber}</span>)}
                    {st === "pending" && <Link href="/studio/qr/queue#orders" className="btn btn-blue btn-sm">Finish paying</Link>}
                  </div>
                </li>
              );
            })}
          </ul>
          {items.length > 0 && <h2 className="mt-3 t-card">Prints</h2>}
        </section>
      )}
      {items.length === 0 ? (
        <EmptyState
          title={codeOrders.length ? "No prints bought yet" : "No purchases yet"}
          body={<>Prints you buy show up here. We match orders to <b>{artist.email}</b>.</>}
          action={{ label: "Browse art", href: "/art" }}
          secondary={{ label: "Find artists", href: "/artists" }}
          help={{ label: "Bought with another email?", href: "/help/buyers/orders-and-wishlist" }}
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((i) => (
            <li key={i.id} className="af-panel flex items-center gap-4 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a small, already-sized preview (Cloudinary or /uploads), like the other Studio thumbnails */}
              {i.imageUrl ? <img src={i.imageUrl} alt={i.title || "Artwork"} className="h-16 w-14 shrink-0 rounded object-cover" /> : <span className="h-16 w-14 shrink-0 rounded bg-wall" />}
              <div className="min-w-0 flex-1">
                {i.artwork?.slug ? <Link href={artPath(i.artwork.artist.slug, i.artwork.slug)} className="font-bold text-ink no-underline hover:text-scan">{i.title}</Link> : <b>{i.title}</b>}
                <div className="t-small">
                  {i.artistName} · {SIZE[i.size || ""] || i.size} · ×{i.quantity || 1} · {i.order.createdAt.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div className="grid justify-items-end gap-1">
                <b className="num">{usd(i.lineTotal || 0)}</b>
                <span className="rounded-full bg-wall px-2 py-0.5 text-[12px] font-bold capitalize text-ink-2">{i.order.shippingStatus}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </StudioPage>
  );
}
