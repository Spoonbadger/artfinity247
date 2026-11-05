import Link from "next/link";
import { PaintChip } from "@/components/af/Brush";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import HelpLink from "@/components/help/HelpLink";
import ExportCsvButton from "@/components/money/ExportCsvButton";
import { prisma } from "@/lib/prisma";
import { itemBreakdown } from "@/lib/sales";
import { artistSplitNow, requireArtist, getSales, SIZE_LABEL, STUDIO_TZ, usd } from "../_lib/data";
import { cityOf, customerHref } from "../customers/_lib";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales" };

const monthKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit" });
const monthName = (d: Date) => d.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "long", year: "numeric" });
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "short", day: "numeric", year: "numeric" });

type Extra = { expenses: number; email: string; first: string; city: string };

/** Per item: expenses (printing, labor, card and hosting fees) and a privacy-light buyer label. */
async function getExtras(artistId: string) {
  const items = await prisma.orderItem.findMany({
    where: { artwork: { artistId }, order: { paymentStatus: "paid", kind: { not: "bulk" } } },
    select: {
      id: true, size: true, frameChosen: true, quantity: true, unitPrice: true, lineTotal: true, artistSplit: true,
      order: { select: { createdAt: true, email: true, shippingName: true, shippingAddress: true } },
    },
  });
  const extras = new Map<string, Extra>();
  for (const it of items) {
    const b = itemBreakdown({ ...it, orderDate: it.order.createdAt });
    const name = (it.order.shippingName || "").trim();
    extras.set(it.id, {
      expenses: b.expenses,
      email: it.order.email,
      first: name ? name.split(/\s+/)[0] : "Buyer",
      city: cityOf(it.order.shippingAddress).split(",")[0] || "",
    });
  }
  return { extras };
}

export default async function SalesPage({ searchParams }: { searchParams: { month?: string } }) {
  const artist = await requireArtist("/studio/sales");
  const splitNow = await artistSplitNow(artist.id);
  const [allSales, { extras }, artCount] = await Promise.all([getSales(artist.id), getExtras(artist.id), prisma.artwork.count({ where: { artistId: artist.id } })]);
  const month = /^\d{4}-\d{2}$/.test(searchParams.month || "") ? searchParams.month! : null;
  const sales = month ? allSales.filter((s) => monthKey(s.date) === month) : allSales;

  const months: { key: string; name: string; prints: number; gross: number; share: number }[] = [];
  for (const s of allSales) {
    const k = monthKey(s.date);
    let m = months.find((x) => x.key === k);
    if (!m) { m = { key: k, name: monthName(s.date), prints: 0, gross: 0, share: 0 }; months.push(m); }
    m.prints += s.quantity;
    m.gross += s.priceCents;
    m.share += s.shareCents;
  }
  const maxShare = Math.max(1, ...months.map((m) => m.share));
  const total = allSales.reduce((n, s) => n + s.shareCents, 0);
  const picked = month ? months.find((m) => m.key === month) : null;
  const prints = sales.reduce((n, s) => n + s.quantity, 0);
  const thisMonth = months.find((m) => m.key === monthKey(new Date()));

  return (
    <StudioPage
      title="Sales"
      sub={`You get ${Math.round(splitNow * 100)}% of profit on new orders${splitNow > 0.6 ? " with Infinity" : ""}. Orders before Oct 21, 2026 paid 50%.`}
      actions={
        <>
        <HelpLink href="/help/getting-paid/when-paid" label="How payouts work" />
        <Link href="/studio/money" className="btn btn-ghost">Money</Link>
        {allSales.length > 0 && <ExportCsvButton href={`/api/my-sales/export${month ? `?year=${month.slice(0, 4)}` : ""}`} label={`Export CSV${month ? ` (${month.slice(0, 4)})` : ""}`} />}
        </>
      }
    >
      {allSales.length > 0 && (
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <PaintChip color="#0f7a55" value={usd(total)} label="earned, all time" note="Viridian" earned />
        <PaintChip color="#0f7a55" value={usd((picked || thisMonth)?.share || 0)} label={picked ? `earned in ${picked.name}` : "earned this month"} note={picked ? "Viridian" : new Date().toLocaleDateString("en-US", { month: "long", timeZone: STUDIO_TZ })} earned />
        <PaintChip color="#e8743b" value={prints.toLocaleString("en-US")} label={picked ? `prints sold in ${picked.name.split(" ")[0]}` : "prints sold"} note="Cadmium" />
        <PaintChip color="#15161b" value={usd(sales.reduce((n, s) => n + s.priceCents, 0))} label={picked ? `in sales, ${picked.name.split(" ")[0]}` : "in sales"} note="Ivory black" />
      </section>
      )}

      {months.length > 0 && (
        <nav aria-label="Filter by month" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {[{ key: "", name: "All time" }, ...months].map((m) => {
            const on = (month || "") === m.key;
            return (
              <Link key={m.key || "all"} href={m.key ? `/studio/sales?month=${m.key}` : "/studio/sales"} aria-current={on ? "page" : undefined} scroll={false}
                className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[13.5px] font-semibold no-underline ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>
                {m.name}
              </Link>
            );
          })}
        </nav>
      )}

      {allSales.length === 0 ? (
        artCount === 0 ? (
          <EmptyState
            title="No sales yet"
            body="Your first sale shows here the moment it happens: the piece, the size, who bought it and your share. Start by adding a piece; its QR code is ready to print right after."
            action={{ label: "Add your first piece", href: "/studio/art/new" }}
            help={{ label: "How to add art", href: "/help/getting-started/upload-art" }}
          />
        ) : (
          <EmptyState
            title="No sales yet"
            body="Your first sale shows here the moment it happens. Hang a printed code where people linger (a café wall, your studio door, a market table) or share your page."
            action={{ label: "Print a QR code", href: "/studio/qr" }}
            secondary={{ label: "Share your page", href: "/studio/share" }}
            help={{ label: "Where to hang codes", href: "/help/getting-started/hanging-codes" }}
          />
        )
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid gap-4">
          <section className="af-card grid gap-3 p-4 sm:p-5" aria-labelledby="months-h">
            <h2 id="months-h" className="text-[20px] font-bold">By month</h2>
            <ul className="grid gap-4">
              {months.map((m) => (
                <li key={m.key} className={`grid gap-1.5 ${month && month !== m.key ? "opacity-50" : ""}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/studio/sales?month=${m.key}`} scroll={false} className="text-[15px] font-bold text-ink underline-offset-2 hover:underline">{m.name}</Link>
                    <b className="num text-[17px] text-earned">{usd(m.share)}</b>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-wall" aria-hidden="true">
                    <div className="h-full rounded-full bg-earned" style={{ width: `${Math.max(4, (m.share / maxShare) * 100)}%` }} />
                  </div>
                  <span className="num text-[12.5px] text-ink-2">{m.prints} {m.prints === 1 ? "print" : "prints"} · {usd(m.gross)} in sales</span>
                </li>
              ))}
            </ul>
          </section>
          <Link href="/studio/money" className="af-card flex items-center justify-between gap-3 p-4 text-[15px] font-bold text-ink no-underline hover:border-ink sm:p-5">
            <span className="flex items-center gap-2.5"><i className="paint-dab" style={{ ["--dab" as string]: "#0f7a55" }} />Payouts and balance</span>
            <span className="text-scan">Money →</span>
          </Link>
          </div>

          <section className="af-card min-w-0 p-4 sm:p-5" aria-labelledby="orders-h">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 id="orders-h" className="text-[20px] font-bold">{picked ? `Orders, ${picked.name}` : "Orders"}</h2>
              <span className="num text-[12.5px] text-ink-2">{sales.length}</span>
            </div>
            <table className="num w-full border-collapse text-[14px]">
              <thead className="sr-only sm:not-sr-only">
                <tr className="text-left text-[12px] text-ink-2">
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold">Piece</th>
                  <th className="pb-2 font-semibold">Size</th>
                  <th className="pb-2 font-semibold">Customer</th>
                  <th className="pb-2 text-right font-semibold">Price</th>
                  <th className="pb-2 text-right font-semibold">Expenses</th>
                  <th className="pb-2 text-right font-semibold">Your share</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const x = extras.get(s.id);
                  const buyer = x ? [x.first, x.city].filter(Boolean).join(", ") : "";
                  return (
                  <tr key={s.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-x-3 border-t border-line py-2.5 sm:table-row sm:py-0">
                    <td className="hidden whitespace-nowrap py-2.5 pr-3 text-ink-2 sm:table-cell">{shortDate(s.date)}</td>
                    <td className="row-span-2 sm:hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {s.imageUrl && <img src={s.imageUrl} alt="" className="h-11 w-11 rounded-[3px] object-cover" />}
                    </td>
                    <td className="min-w-0 sm:py-2.5 sm:pr-3">
                      <span className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {s.imageUrl && <img src={s.imageUrl} alt="" className="hidden h-9 w-9 shrink-0 rounded-[3px] object-cover sm:block" />}
                        <b className="truncate font-semibold">{s.title}</b>
                      </span>
                    </td>
                    <td className="hidden py-2.5 pr-3 sm:table-cell">{SIZE_LABEL[s.size]}{s.framed ? ", framed" : ""}{s.quantity > 1 ? ` ×${s.quantity}` : ""}</td>
                    <td className="hidden max-w-[160px] py-2.5 pr-3 sm:table-cell">
                      {x ? <Link href={customerHref(x.email)} className="block truncate font-semibold text-scan underline-offset-2 hover:underline">{buyer}</Link> : <span className="text-ink-2">-</span>}
                    </td>
                    <td className="hidden py-2.5 pr-3 text-right sm:table-cell">{usd(s.priceCents)}</td>
                    <td className="hidden py-2.5 pr-3 text-right text-ink-2 sm:table-cell">{x ? `−${usd(x.expenses)}` : "-"}</td>
                    <td className="row-span-2 text-right sm:py-2.5">
                      <b className="block text-earned">+{usd(s.shareCents)}</b>
                      <span className="text-[11.5px] text-ink-2">{Math.round(s.split * 100)}%</span>
                    </td>
                    <td className="col-start-2 text-[12.5px] text-ink-2 sm:hidden">
                      {shortDate(s.date)} · {SIZE_LABEL[s.size]} · {usd(s.priceCents)}{x && <> · <span className="whitespace-nowrap">−{usd(x.expenses)} costs</span></>}
                      {x && <> · <Link href={customerHref(x.email)} className="font-semibold text-scan">{buyer}</Link></>}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </StudioPage>
  );
}
