"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import ExportCsvButton from "./ExportCsvButton";
import type { AdjustmentLine, LedgerLine } from "@/lib/balance";
import { BUCKET_COLOR, BUCKET_LABEL, SIZE_LABEL, bucketOf, dayUTC, monthName, usd, type MoneyBucket } from "./format";

const FILTERS: { id: "" | MoneyBucket; label: string }[] = [
  { id: "", label: "All" },
  { id: "hold", label: "On hold" },
  { id: "ready", label: "Ready" },
  { id: "paid", label: "Paid out" },
];
const PAGE = 25;

function StatusTag({ l, currentMonth, compact = false }: { l: Pick<LedgerLine, "status" | "payoutMonth"> & { clearsAt?: string }; currentMonth: string; compact?: boolean }) {
  const bucket = bucketOf(l, currentMonth);
  const month = monthName(l.payoutMonth).split(" ")[0];
  const note = l.status === "pending" ? (l.clearsAt ? `Clears ${dayUTC(l.clearsAt)}` : "Off a coming payout") : bucket === "ready" ? "Next payout" : `${month} payout`;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]">
      <i
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: BUCKET_COLOR[bucket], ...(bucket === "hold" ? { boxShadow: "inset 0 0 0 1.5px #3d9f76" } : {}) }}
        aria-hidden="true"
      />
      <b className="font-semibold">{BUCKET_LABEL[bucket]}</b>
      {!compact && <span className="text-ink-2">{note}</span>}
    </span>
  );
}

/** A refunded sale: share reversed (0), or refunded after it was already paid out. */
function RefundTag({ l }: { l: LedgerLine }) {
  if (!l.refunded) return null;
  return (
    <span className="ml-1.5 rounded-full bg-coral/15 px-1.5 text-[11px] font-bold text-coral" title={l.refunded === "reversed" ? "The buyer was refunded, so this sale doesn't count toward your payout." : "The buyer was refunded after this was paid out. You keep it."}>
      Refunded
    </span>
  );
}

type Row = { kind: "sale"; l: LedgerLine } | { kind: "adjustment"; a: AdjustmentLine };
const REASON: Record<string, string> = { buyer_return: "Buyer return", chargeback: "Chargeback", damaged: "Damaged print", other: "Refund" };
const rowDate = (r: Row) => (r.kind === "sale" ? r.l.date : r.a.date);
const rowCents = (r: Row) => (r.kind === "sale" ? r.l.shareCents : r.a.amountCents);
const rowText = (r: Row) =>
  r.kind === "sale" ? [r.l.title, r.l.buyerFirst, r.l.buyerCity, SIZE_LABEL[r.l.size]].join(" ") : ["Refund adjustment", r.a.title, r.a.orderRef, `#${r.a.orderRef}`, REASON[r.a.reason]].join(" ");

/** A paid-out sale refunded later, taken off a payout (lib/refundPolicy.ts): one row with the order reference. */
function AdjustmentRow({ a, currentMonth }: { a: AdjustmentLine; currentMonth: string }) {
  const title = "A sale you were already paid for was refunded, so your share comes off a payout. A payout never goes below $0; the rest carries to the next month.";
  return (
    <tr className="block border-b border-line py-2.5 last:border-b-0 lg:table-row lg:py-0">
      <td className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-x-3 lg:hidden">
        <span aria-hidden="true" className="row-span-2 grid h-10 w-10 place-items-center rounded-[3px] bg-coral/15 text-[18px] font-bold text-coral">↩</span>
        <b className="min-w-0 truncate font-semibold" title={title}>Refund adjustment</b>
        <b className="text-right text-coral">{usd(a.amountCents)}</b>
        <span className="min-w-0 truncate text-[12px] text-ink-2">Order #{a.orderRef} · {a.title} · {dayUTC(a.date)}</span>
        <span className="text-right"><StatusTag l={a} currentMonth={currentMonth} compact /></span>
      </td>
      <td className="hidden whitespace-nowrap py-2.5 pr-3 text-ink-2 lg:table-cell">{dayUTC(a.date)}</td>
      <td className="hidden max-w-[240px] py-2.5 pr-3 lg:table-cell">
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-[3px] bg-coral/15 font-bold text-coral">↩</span>
          <span className="min-w-0">
            <b className="block truncate font-semibold" title={title}>Refund adjustment</b>
            <span className="block truncate text-[12px] text-ink-2">Order #{a.orderRef} · {a.title}</span>
          </span>
        </span>
      </td>
      <td className="hidden py-2.5 pr-3 text-ink-2 lg:table-cell">{REASON[a.reason] ?? "Refund"}</td>
      <td className="hidden py-2.5 pr-3 text-right text-ink-2 lg:table-cell" colSpan={4}>Refunded after it was paid out</td>
      <td className="hidden py-2.5 pr-3 text-right lg:table-cell"><b className="block text-coral">{usd(a.amountCents)}</b></td>
      <td className="hidden whitespace-nowrap py-2.5 lg:table-cell"><StatusTag l={a} currentMonth={currentMonth} /></td>
    </tr>
  );
}

/** Every sale line, plus any refund adjustments: search, status filter, CSV export. */
export default function Ledger({ ledger, adjustments = [], currentMonth }: { ledger: LedgerLine[]; adjustments?: AdjustmentLine[]; currentMonth: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | MoneyBucket>("");
  const [shown, setShown] = useState(PAGE);

  const all = useMemo<Row[]>(
    () => [...ledger.map((l) => ({ kind: "sale" as const, l })), ...adjustments.map((a) => ({ kind: "adjustment" as const, a }))].sort((x, y) => rowDate(y).localeCompare(rowDate(x))),
    [ledger, adjustments],
  );
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((r) => (!status || bucketOf(r.kind === "sale" ? r.l : r.a, currentMonth) === status) && (!t || rowText(r).toLowerCase().includes(t)));
  }, [all, q, status, currentMonth]);
  const total = rows.reduce((n, r) => n + rowCents(r), 0);
  const sales = rows.filter((r) => r.kind === "sale").length;
  const adjusted = rows.length - sales;
  const counts = useMemo(() => {
    const c: Record<string, number> = { "": all.length, hold: 0, ready: 0, paid: 0 };
    for (const r of all) c[bucketOf(r.kind === "sale" ? r.l : r.a, currentMonth)]++;
    return c;
  }, [all, currentMonth]);
  const exportHref = `/api/studio/money/export?${new URLSearchParams({ ...(status ? { bucket: status } : {}), ...(q.trim() ? { q: q.trim() } : {}) })}`;

  return (
    <section aria-labelledby="ledger-h" className="af-card grid min-w-0 gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ledger-h" className="text-[20px] font-bold">Transactions</h2>
        <ExportCsvButton href={exportHref} label="CSV" className="btn-sm" />
      </div>

      <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
        <label className="relative block sm:w-[280px]">
          <span className="sr-only">Search transactions</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden="true" />
          <input
            type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Artwork, buyer, city"
            className="h-11 w-full rounded-full border-2 border-line bg-white pl-9 pr-3 text-[14.5px] outline-none focus:border-ink"
          />
        </label>
        <div role="radiogroup" aria-label="Filter by status" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <button
              key={f.id || "all"} type="button" role="radio" aria-checked={status === f.id} onClick={() => { setStatus(f.id); setShown(PAGE); }}
              className={`min-h-[36px] shrink-0 rounded-full border-2 px-3 text-[13px] font-semibold ${status === f.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}
            >
              {f.label} <span className="num opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="num text-[12.5px] text-ink-2" aria-live="polite">
        {sales} {sales === 1 ? "sale" : "sales"}{adjusted > 0 && <> · {adjusted} refund {adjusted === 1 ? "adjustment" : "adjustments"}</>} · {usd(total)} your share
      </p>

      {rows.length === 0 ? (
        <div className="grid justify-items-center gap-2 py-8 text-center text-[14px] text-ink-2">
          <p>No sales match {q.trim() ? <>“{q.trim()}”</> : "this filter"}{status ? ` in ${FILTERS.find((f) => f.id === status)?.label ?? "this group"}` : ""}.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setStatus(""); setShown(PAGE); }}>Show all {all.length}</button>
        </div>
      ) : (
        <div className="min-w-0">
          <table className="num w-full border-collapse text-[13.5px]">
            <thead className="sr-only lg:not-sr-only">
              <tr className="border-b border-line text-left text-[12px] text-ink-2">
                <th className="pb-2 pr-3 font-semibold">Date</th>
                <th className="pb-2 pr-3 font-semibold">Artwork</th>
                <th className="pb-2 pr-3 font-semibold">Buyer</th>
                <th className="pb-2 pr-3 text-right font-semibold">Gross</th>
                <th className="pb-2 pr-3 text-right font-semibold">Printing</th>
                <th className="pb-2 pr-3 text-right font-semibold">Fees</th>
                <th className="pb-2 pr-3 text-right font-semibold">Profit</th>
                <th className="pb-2 pr-3 text-right font-semibold">Your share</th>
                <th className="pb-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((r) => {
                if (r.kind === "adjustment") return <AdjustmentRow key={r.a.id} a={r.a} currentMonth={currentMonth} />;
                const l = r.l;
                const buyer = [l.buyerFirst, l.buyerCity].filter(Boolean).join(", ");
                return (
                  <tr key={l.id} className="block border-b border-line py-2.5 last:border-b-0 lg:table-row lg:py-0">
                    {/* phone: one compact card */}
                    <td className="grid grid-cols-[40px_minmax(0,1fr)_auto] gap-x-3 lg:hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.imageUrl ? <img src={l.imageUrl} alt="" className="row-span-3 h-10 w-10 rounded-[3px] object-cover" /> : <span className="row-span-3 block h-10 w-10 rounded-[3px] bg-gallery" />}
                      <b className="min-w-0 truncate font-semibold">{l.title}<RefundTag l={l} /></b>
                      <b className="text-right text-earned">+{usd(l.shareCents)}</b>
                      <span className="min-w-0 truncate text-[12px] text-ink-2">{SIZE_LABEL[l.size]}{l.quantity > 1 ? ` ×${l.quantity}` : ""} · {dayUTC(l.date)} · {buyer}</span>
                      <span className="text-right"><StatusTag l={l} currentMonth={currentMonth} compact /></span>
                      <span className="col-span-2 text-[11.5px] text-ink-2">{usd(l.grossCents)} − {usd(l.printingCents)} printing − {usd(l.feesCents)} fees · {Math.round(l.split * 100)}%</span>
                    </td>
                    <td className="hidden whitespace-nowrap py-2.5 pr-3 text-ink-2 lg:table-cell">{dayUTC(l.date)}</td>
                    <td className="hidden max-w-[240px] py-2.5 pr-3 lg:table-cell">
                      <span className="flex min-w-0 items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {l.imageUrl && <img src={l.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-[3px] object-cover" />}
                        <span className="min-w-0">
                          <b className="block truncate font-semibold">{l.title}<RefundTag l={l} /></b>
                          <span className="block text-[12px] text-ink-2">{SIZE_LABEL[l.size]}{l.framed ? ", framed" : ""}{l.quantity > 1 ? ` ×${l.quantity}` : ""}</span>
                        </span>
                      </span>
                    </td>
                    <td className="hidden max-w-[150px] truncate py-2.5 pr-3 lg:table-cell">{buyer}</td>
                    <td className="hidden py-2.5 pr-3 text-right lg:table-cell">{usd(l.grossCents)}</td>
                    <td className="hidden py-2.5 pr-3 text-right text-ink-2 lg:table-cell">−{usd(l.printingCents)}</td>
                    <td className="hidden py-2.5 pr-3 text-right text-ink-2 lg:table-cell">−{usd(l.feesCents)}</td>
                    <td className="hidden py-2.5 pr-3 text-right lg:table-cell">{usd(l.profitCents)}</td>
                    <td className="hidden py-2.5 pr-3 text-right lg:table-cell">
                      <b className="block text-earned">+{usd(l.shareCents)}</b>
                      <span className="text-[11.5px] text-ink-2">{Math.round(l.split * 100)}%</span>
                    </td>
                    <td className="hidden whitespace-nowrap py-2.5 lg:table-cell"><StatusTag l={l} currentMonth={currentMonth} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="btn btn-ghost btn-sm mt-3 w-full sm:w-auto">
              Show {Math.min(PAGE, rows.length - shown)} more
            </button>
          )}
        </div>
      )}
    </section>
  );
}
