import type { LedgerLine, PayoutRow } from "@/lib/balance";
import { PAYOUT_LABEL, SIZE_LABEL, dayUTC, usd } from "./format";

export function PayoutChip({ row }: { row: PayoutRow }) {
  const cls =
    row.status === "paid" ? "bg-earned-soft text-earned" : row.status === "scheduled" ? "bg-sticker/60 text-ink" : "bg-wall text-ink-2";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${cls}`}>
      {row.status === "paid" && <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      {row.status === "scheduled" && <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 3.5V6l1.8 1.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
      {row.status === "in_progress" && <i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: "#a9d8c1" }} />}
      {PAYOUT_LABEL[row.status]}
    </span>
  );
}

function when(row: PayoutRow) {
  if (row.status === "paid") return row.paidAt ? dayUTC(row.paidAt, true) : "Paid";
  return `Goes out ${dayUTC(row.dueDate)}`;
}

/** Payouts by month: month · amount · status · paid date · method, each expandable to its sales. */
export default function PayoutsList({ payouts, ledger }: { payouts: PayoutRow[]; ledger: LedgerLine[] }) {
  return (
    <section aria-labelledby="payouts-h" className="af-card grid min-w-0 gap-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="payouts-h" className="text-[20px] font-bold">Payouts</h2>
        <span className="text-[12.5px] text-ink-2">One per month, sent by Artfinity</span>
      </div>
      {payouts.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ink-2">Your first payout shows up after your first sale.</p>
      ) : (
        <div className="grid">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.5fr)_20px] gap-3 border-b border-line pb-2 text-[12px] font-semibold text-ink-2 md:grid">
            <span>Month</span><span className="text-right">Amount</span><span>Status</span><span>Date</span><span>Method</span><span />
          </div>
          {payouts.map((p) => {
            const lines = ledger.filter((l) => l.payoutMonth === p.month);
            return (
              <details key={p.month} className="group border-b border-line last:border-b-0">
                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_20px] items-center gap-x-3 gap-y-1 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.5fr)_20px] [&::-webkit-details-marker]:hidden">
                  <span className="whitespace-nowrap font-semibold">{p.label}</span>
                  <b className="num text-right text-[16px] text-earned md:order-none">{usd(p.amountCents)}</b>
                  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 text-ink-2 transition group-open:rotate-180 md:order-last" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span className="col-span-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-ink-2 md:contents">
                    <span className="md:block"><PayoutChip row={p} /></span>
                    <span className="num whitespace-nowrap md:text-[14px] md:text-ink">{when(p)}</span>
                    <span className="whitespace-nowrap md:truncate md:text-[14px] md:text-ink" title={p.method}>{p.method}</span>
                  </span>
                </summary>
                <div className="mb-3 grid gap-1 rounded-[4px] bg-wall p-3 text-[13px]">
                  <p className="text-ink-2">
                    {p.prints} {p.prints === 1 ? "print" : "prints"} · {p.sales} {p.sales === 1 ? "sale" : "sales"}
                    {p.status === "paid" && p.amountCents !== p.computedCents && <> · Sales add up to {usd(p.computedCents)} today; {usd(p.amountCents)} was sent.</>}
                  </p>
                  <ul className="grid">
                    {lines.map((l) => (
                      <li key={l.id} className="num flex items-baseline justify-between gap-3 border-t border-line/70 py-1.5 first:border-t-0">
                        <span className="min-w-0 truncate"><span className="text-ink-2">{dayUTC(l.date)}</span> · <b className="font-semibold">{l.title}</b> <span className="text-ink-2">{SIZE_LABEL[l.size]}{l.quantity > 1 ? ` ×${l.quantity}` : ""}</span></span>
                        <b className="shrink-0 text-earned">{usd(l.shareCents)}</b>
                      </li>
                    ))}
                    {lines.length === 0 && <li className="text-ink-2">No sales recorded for this month.</li>}
                  </ul>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
