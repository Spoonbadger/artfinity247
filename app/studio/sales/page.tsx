import Link from "next/link";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import HelpLink from "@/components/help/HelpLink";
import ExportCsvButton from "@/components/money/ExportCsvButton";
import { UrlPicker } from "@/components/money/SortSelect";
import Disclosure from "@/components/money/Disclosure";
import { BUCKET_LABEL, bucketOf, type MoneyBucket } from "@/components/money/format";
import { getBalance, payoutDateFor } from "@/lib/balance";
import { prisma } from "@/lib/prisma";
import { itemBreakdown } from "@/lib/sales";
import { artistSplitNow, requireArtist, getSales, SIZE_LABEL, STUDIO_TZ, usd } from "../_lib/data";
import { cityOf, customerHref } from "../customers/_lib";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales" };

const monthKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit" });
const monthName = (d: Date) => d.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "long", year: "numeric" });
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "short", day: "numeric", year: "numeric" });
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: STUDIO_TZ });
/** "Today", "Yesterday" or "Nov 2, 2026" */
function whenSold(d: Date) {
  const k = dayKey(d);
  if (k === dayKey(new Date())) return "Today";
  if (k === dayKey(new Date(Date.now() - 86_400_000))) return "Yesterday";
  return shortDate(d);
}
/** Rows shown before "Show all". */
const FIRST_ROWS = 25;
const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "amount", label: "Your share" },
  { value: "piece", label: "Piece, A–Z" },
  { value: "status", label: "Status" },
];
const PRESETS: Record<string, { label: string; days?: number }> = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  ytd: { label: "This year" },
};
const BUCKET_ORDER: Record<MoneyBucket, number> = { hold: 0, ready: 1, paid: 2 };

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

export default async function SalesPage({ searchParams }: { searchParams: { when?: string; month?: string; sort?: string; all?: string } }) {
  const artist = await requireArtist("/studio/sales");
  const splitNow = await artistSplitNow(artist.id);
  const [allSales, { extras }, artCount, bal] = await Promise.all([getSales(artist.id), getExtras(artist.id), prisma.artwork.count({ where: { artistId: artist.id } }), getBalance(artist.id)]);
  // Where each sale's money is: on hold, ready for the next payout, or paid.
  const bucket = new Map<string, MoneyBucket>(bal.ledger.map((l) => [l.id, bucketOf(l, bal.currentMonth)]));
  const when = searchParams.when || searchParams.month || "";
  const month = /^\d{4}-\d{2}$/.test(when) ? when : null;
  const preset = PRESETS[when] ? when : null;
  const since = preset === "ytd" ? new Date(new Date().getFullYear(), 0, 1) : preset ? new Date(Date.now() - PRESETS[preset].days! * 86_400_000) : null;
  const sort = SORTS.some((o) => o.value === searchParams.sort) ? searchParams.sort! : "newest";
  const sales = (month ? allSales.filter((s) => monthKey(s.date) === month) : since ? allSales.filter((s) => s.date >= since) : allSales).slice();
  if (sort === "amount") sales.sort((a, b) => b.shareCents - a.shareCents);
  if (sort === "piece") sales.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "status") sales.sort((a, b) => BUCKET_ORDER[bucket.get(a.id) ?? "paid"] - BUCKET_ORDER[bucket.get(b.id) ?? "paid"]);

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
  // Label for the filtered window: "November", "last 30 days", "this year"
  const windowName = picked ? picked.name.split(" ")[0] : preset ? PRESETS[preset].label.toLowerCase() : null;
  const windowShare = sales.reduce((n, s) => n + s.shareCents, 0);
  const prints = sales.reduce((n, s) => n + s.quantity, 0);
  const thisMonth = months.find((m) => m.key === monthKey(new Date()));
  const latest = allSales[0];
  const latestX = latest ? extras.get(latest.id) : undefined;
  const showAll = searchParams.all === "1" || sales.length <= FIRST_ROWS;
  const rows = showAll ? sales : sales.slice(0, FIRST_ROWS);
  const allHref = `/studio/sales?${new URLSearchParams({ ...(when ? { when } : {}), ...(sort !== "newest" ? { sort } : {}), all: "1" })}#orders-h`;
  const whenOptions = [{ value: "", label: "All time" }, ...Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })), ...months.map((m) => ({ value: m.key, label: m.name }))];
  const pctNow = Math.round(splitNow * 100);
  const holdPaid = new Date(payoutDateFor(bal.currentMonth)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

  return (
    <StudioPage
      title="Sales"
      actions={
        <>
        <HelpLink href="/help/getting-paid/when-paid" label="How payouts work" />
        {allSales.length > 0 && <ExportCsvButton href={`/api/my-sales/export${month ? `?year=${month.slice(0, 4)}` : ""}`} label={`Export CSV${month ? ` (${month.slice(0, 4)})` : ""}`} />}
        </>
      }
    >
      {latest && (
        <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-4">
          {/* The money: one hero number, the rest on one line under it. */}
          <section aria-labelledby="earned-h" className="af-card grid content-center gap-1 p-4 sm:p-5">
            <h2 id="earned-h" className="eyebrow">{windowName ? `Earned, ${windowName}` : "Earned this month"}</h2>
            <p className="t-num text-earned">{usd(windowName ? windowShare : thisMonth?.share || 0)}</p>
            <p className="t-small num">
              {windowName ? `${prints.toLocaleString("en-US")} ${prints === 1 ? "print" : "prints"} · ` : ""}{usd(total)} earned all time · {allSales.reduce((n, s) => n + s.quantity, 0).toLocaleString("en-US")} prints sold
            </p>
            <Link href="/studio/money" className="mt-1 w-fit text-[15px] font-bold text-scan">Balance and payouts →</Link>
          </section>

          {/* The newest sale, next to the money */}
          <section aria-labelledby="latest-h" className="af-card grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 p-4 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {latest.imageUrl ? <img src={latest.imageUrl} alt="" className="h-20 w-16 rounded-[3px] object-cover sm:h-[100px] sm:w-20" /> : <span className="h-20 w-16 rounded-[3px] bg-wall sm:h-[100px] sm:w-20" />}
            <div className="min-w-0">
              <h2 id="latest-h" className="eyebrow">Latest sale · {whenSold(latest.date)}</h2>
              <b className="t-card mt-1 block truncate">{latest.title}</b>
              <p className="t-small">
                {SIZE_LABEL[latest.size]}{latest.framed ? ", framed" : ""}{latest.quantity > 1 ? ` ×${latest.quantity}` : ""} · {usd(latest.priceCents)}
                {latestX && <> · <Link href={customerHref(latestX.email)} className="font-semibold text-scan">{[latestX.first, latestX.city].filter(Boolean).join(", ")}</Link></>}
              </p>
            </div>
            <div className="grid justify-items-end self-center text-right">
              <b className="num text-[22px] font-bold leading-none text-earned">+{usd(latest.shareCents)}</b>
              <span className="t-small mt-1">your share</span>
            </div>
          </section>
        </div>
      )}

      {months.length > 0 && (
        <div role="toolbar" aria-label="Filter and sort orders" className="flex flex-wrap items-center gap-2">
          <UrlPicker param="when" label="When" value={when && whenOptions.some((o) => o.value === when) ? when : ""} options={whenOptions} storageKey="af:sales:when" icon={false} />
          <UrlPicker param="sort" label="Sort" value={sort} options={SORTS} storageKey="af:sales:sort" />
          {when && <Link href={sort !== "newest" ? `/studio/sales?sort=${sort}` : "/studio/sales"} scroll={false} className="inline-flex min-h-[40px] items-center px-1 text-[13.5px] font-semibold text-ink-2 underline underline-offset-2 hover:text-ink">Clear</Link>}
        </div>
      )}

      {allSales.length === 0 ? (
        artCount === 0 ? (
          <EmptyState
            title="No sales yet"
            body="Each sale shows up here the moment it happens. Add a piece to get its QR code."
            action={{ label: "Add your first piece", href: "/studio/art/new" }}
            help={{ label: "How to add art", href: "/help/getting-started/upload-art" }}
          />
        ) : (
          <EmptyState
            title="No sales yet"
            body="Each sale shows up here the moment it happens. Hang a code where people stop and look."
            action={{ label: "Print a QR code", href: "/studio/qr" }}
            secondary={{ label: "Share your page", href: "/studio/share" }}
            help={{ label: "Where to hang codes", href: "/help/getting-started/hanging-codes" }}
          />
        )
      ) : (
        <>
          <section className="af-card min-w-0 p-4 sm:p-5" aria-labelledby="orders-h">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 id="orders-h" className="t-card">Orders <span className="num text-[14px] font-semibold text-ink-2">{sales.length}</span></h2>
            </div>
            <div className="-mx-1 overflow-x-auto px-1">
            <table className="num w-full border-collapse text-[14px]">
              <thead className="sr-only sm:not-sr-only">
                <tr className="text-left text-[13px] text-ink-2">
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold">Piece</th>
                  <th className="pb-2 font-semibold">Size</th>
                  <th className="pb-2 font-semibold">Customer</th>
                  <th className="pb-2 text-right font-semibold">Price</th>
                  <th className="pb-2 text-right font-semibold">Expenses</th>
                  <th className="pb-2 text-right font-semibold">Your share · status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
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
                      <span className="whitespace-nowrap text-[13px] text-ink-2">{Math.round(s.split * 100)}%{bucket.get(s.id) ? ` · ${BUCKET_LABEL[bucket.get(s.id)!]}` : ""}</span>
                    </td>
                    <td className="col-start-2 text-[13px] text-ink-2 sm:hidden">
                      {shortDate(s.date)} · {SIZE_LABEL[s.size]} · {usd(s.priceCents)}{x && <> · <span className="whitespace-nowrap">−{usd(x.expenses)} costs</span></>}
                      {x && <> · <Link href={customerHref(x.email)} className="font-semibold text-scan">{buyer}</Link></>}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <div className="t-small mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
              <span className="max-w-[68ch]">
                You get {pctNow}% of profit{splitNow > 0.6 ? " with Infinity" : ""}. Orders before Oct 21, 2026 paid 50%.
                {" "}On hold means this month&apos;s sales, paid by {holdPaid}.
              </span>
              {!showAll && <Link href={allHref} scroll={false} className="text-[14px] font-bold text-scan">Show all {sales.length}</Link>}
            </div>
          </section>

          <Disclosure title="By month" hint={`${months.length} ${months.length === 1 ? "month" : "months"}`}>
            <ul className="grid gap-4 md:grid-cols-2 md:gap-x-8">
              {months.map((m) => (
                <li key={m.key} className={`grid gap-1.5 ${month && month !== m.key ? "opacity-50" : ""}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/studio/sales?when=${m.key}`} scroll={false} className="text-[15px] font-bold text-ink underline-offset-2 hover:underline">{m.name}</Link>
                    <b className="num text-[17px] font-bold text-earned">{usd(m.share)}</b>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-wall" aria-hidden="true">
                    <div className="h-full rounded-full bg-earned" style={{ width: `${Math.max(4, (m.share / maxShare) * 100)}%` }} />
                  </div>
                  <span className="t-small num">{m.prints} {m.prints === 1 ? "print" : "prints"} · {usd(m.gross)} in sales</span>
                </li>
              ))}
            </ul>
          </Disclosure>
        </>
      )}
    </StudioPage>
  );
}
