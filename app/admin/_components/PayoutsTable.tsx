"use client";

import { useCallback, useEffect, useState } from "react";
import { failed, saved } from "@/lib/feedback";
import { passes, sortRows, SortSelect, SortTh, TableToolbar, useTable, type SortDir } from "./table";
import { cn } from "@/lib/utils";
import { monthLabel, usd } from "./util";
import { useAdminCan } from "./AdminRole";

type Row = {
  artistId: string;
  artistName: string;
  artistEmail: string;
  venmoHandle: string;
  stripe?: "not_connected" | "pending" | "ready";
  itemsCount: number;
  gross: number;
  expenses: number;
  profit: number;
  artistShare: number;
  /** Refund adjustments booked to this month and carried in from earlier ones (≤ 0, lib/refunds.ts). */
  refundAdjustments?: number;
  carriedIn?: number;
  closed?: boolean;
  late?: boolean;
  payout: { status: "PAID" | "UNPAID"; paidAt: string | null; amountCents: number; method?: string | null; stripeTransferId?: string | null; failureReason?: string | null };
};

/** PayAllPanel fires this after a run so the month's table reloads. */
export const PAYOUTS_CHANGED = "af:payouts-changed";

export default function PayoutsTable({ month }: { month: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/payouts/summary?month=${month}`, { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setRows(((d.rows || []) as Row[]).sort((a, b) => b.artistShare - a.artistShare));
      setError(false);
    } catch {
      setError(true);
      setRows([]);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const on = () => { load(); };
    window.addEventListener(PAYOUTS_CHANGED, on);
    return () => window.removeEventListener(PAYOUTS_CHANGED, on);
  }, [load]);

  const toggle = async (r: Row) => {
    const paid = r.payout.status === "PAID";
    if (!paid && !confirm(`Mark ${usd(r.artistShare)} to ${r.artistName} as paid? They'll get an email.`)) return;
    setBusy(r.artistId);
    try {
      const res = await fetch("/api/admin/payouts/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId: r.artistId, month, unmark: paid }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "");
      saved(paid ? `${r.artistName} marked unpaid` : `${r.artistName} marked paid`, paid ? undefined : { description: "Email sent." });
      await load();
    } catch (e: any) {
      failed(e?.message || "Couldn't update the payout.", { retry: () => toggle(r) });
    } finally {
      setBusy(null);
    }
  };

  const list = rows ?? [];
  const owed = list.reduce((n, r) => n + r.artistShare, 0);
  const paid = list.filter((r) => r.payout.status === "PAID").reduce((n, r) => n + r.payout.amountCents, 0);
  const gross = list.reduce((n, r) => n + r.gross, 0);
  const unpaidCount = list.filter((r) => r.payout.status !== "PAID").length;
  const t = useTable("payouts", { sort: { key: "share", dir: "desc" } });
  const statusOf = (r: Row) => (r.payout.status === "PAID" ? "paid" : r.late ? "late" : "unpaid");
  const shown = sortRows(
    list.filter((r) => passes(t.filters, { search: `${r.artistName} ${r.artistEmail} ${r.venmoHandle}`, status: statusOf(r) })),
    t.sort,
    (r, k) => (k === "artist" ? r.artistName.toLowerCase() : k === "to" ? (r.stripe === "ready" ? "Stripe" : r.venmoHandle || "") : k === "prints" ? r.itemsCount : k === "sales" ? r.gross : k === "costs" ? r.expenses : k === "profit" ? r.profit : k === "share" ? r.artistShare : statusOf(r) === "late" ? 0 : statusOf(r) === "unpaid" ? 1 : 2),
  );
  const SORTS: { key: string; dir: SortDir; label: string }[] = [
    { key: "share", dir: "desc", label: "Most owed" },
    { key: "status", dir: "asc", label: "Unpaid first" },
    { key: "artist", dir: "asc", label: "Artist A–Z" },
  ];

  return (
    <div className="grid min-w-0 gap-3">
      <dl className="num flex flex-wrap gap-x-6 gap-y-1 text-[14px]">
        <div className="flex gap-1.5"><dt className="text-ink-2">To pay</dt><dd className="font-semibold">{unpaidCount} {unpaidCount === 1 ? "artist" : "artists"}</dd></div>
        <div className="flex gap-1.5"><dt className="text-ink-2">Artist share</dt><dd className="font-semibold text-earned">{usd(owed)}</dd></div>
        <div className="flex gap-1.5"><dt className="text-ink-2">Paid out</dt><dd className="font-semibold">{usd(paid)}</dd></div>
        <div className="flex gap-1.5"><dt className="text-ink-2">Sales</dt><dd className="font-semibold">{usd(gross)}</dd></div>
      </dl>
      {list.length > 0 && (
        <TableToolbar filters={t.filters} setFilter={t.setFilter} clear={t.clear} active={t.active} search="Artist, email or Venmo" statuses={[{ value: "unpaid", label: "Unpaid" }, { value: "late", label: "Late" }, { value: "paid", label: "Paid" }]} count={shown.length} total={list.length}>
          <SortSelect options={SORTS} sort={t.sort} onChange={t.setSort} className="md:hidden" />
        </TableToolbar>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {rows === null ? (
          <p className="px-4 py-14 text-center text-ink-2">Loading {monthLabel(month)}…</p>
        ) : error ? (
          <p className="px-4 py-14 text-center text-coral">Couldn&apos;t load payouts. <button type="button" onClick={load} className="font-semibold underline">Try again</button></p>
        ) : list.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-4 py-14 text-center">
            <span className="paint-dab h-6 w-6" style={{ ["--dab" as string]: "var(--af-sticker)" }} />
            <p className="font-semibold">No paid sales in {monthLabel(month)}.</p>
          </div>
        ) : (
          <>
            {/* desktop table */}
            <table className="num hidden w-full text-left text-[14px] md:table">
              <thead className="border-b border-line bg-wall/60 text-[12px] text-ink-2">
                <tr>
                  <SortTh k="artist" label="Artist" sort={t.sort} onSort={t.toggleSort} className="pl-4" />
                  <SortTh k="to" label="Paid to" sort={t.sort} onSort={t.toggleSort} />
                  <SortTh k="prints" label="Prints" sort={t.sort} onSort={t.toggleSort} align="right" />
                  <SortTh k="sales" label="Sales" sort={t.sort} onSort={t.toggleSort} align="right" />
                  <SortTh k="costs" label="Costs" sort={t.sort} onSort={t.toggleSort} align="right" />
                  <SortTh k="profit" label="Profit" sort={t.sort} onSort={t.toggleSort} align="right" />
                  <SortTh k="share" label="To artist" sort={t.sort} onSort={t.toggleSort} align="right" />
                  <SortTh k="status" label="Status" sort={t.sort} onSort={t.toggleSort} align="right" firstDir="asc" className="pr-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-2">Nothing matches. <button type="button" onClick={t.clear} className="font-semibold text-scan underline">Clear filters</button></td></tr>}
                {shown.map((r) => (
                  <tr key={r.artistId}>
                    <td className="px-4 py-3">
                      <b className="flex flex-wrap items-center gap-1.5">{r.artistName}<Badges r={r} /></b>
                      <span className="text-[13px] text-ink-2">{r.artistEmail}</span>
                    </td>
                    <td className="px-3 py-3"><PaidTo r={r} /></td>
                    <td className="px-3 py-3 text-right">{r.itemsCount}</td>
                    <td className="px-3 py-3 text-right">{usd(r.gross)}</td>
                    <td className="px-3 py-3 text-right text-ink-2">{usd(r.expenses)}</td>
                    <td className="px-3 py-3 text-right">{usd(r.profit)}</td>
                    <td className="px-3 py-3 text-right text-[16px] font-bold text-earned">{usd(r.artistShare)}<AdjustNote r={r} /></td>
                    <td className="px-4 py-3 text-right"><PayButton r={r} busy={busy === r.artistId} onClick={() => toggle(r)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {shown.map((r) => (
                <li key={r.artistId} className="grid gap-2 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <b className="flex flex-wrap items-center gap-1.5"><span className="truncate">{r.artistName}</span><Badges r={r} /></b>
                      <span className="text-[13px] text-ink-2"><PaidTo r={r} /> · {r.itemsCount} {r.itemsCount === 1 ? "print" : "prints"}</span>
                    </div>
                    <b className="num shrink-0 text-right text-[18px] text-earned">{usd(r.artistShare)}<AdjustNote r={r} /></b>
                  </div>
                  <div className="num text-[13px] text-ink-2">{usd(r.gross)} sales · {usd(r.expenses)} costs · {usd(r.profit)} profit</div>
                  <PayButton r={r} busy={busy === r.artistId} onClick={() => toggle(r)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** "after −$12.00 refund adjustment": a paid-out refund taken off this month (lib/refunds.ts). */
function AdjustNote({ r }: { r: Row }) {
  const cents = (r.refundAdjustments ?? 0) + (r.carriedIn ?? 0);
  if (!cents) return null;
  return <span className="block text-[11.5px] font-semibold text-coral" title="A refund on a sale that was already paid out comes off this payout. It never goes below $0; the rest carries to next month.">after {usd(cents)} refund adj.</span>;
}

/** Where the money goes: Stripe when connected and ready, else Venmo by hand. */
function PaidTo({ r }: { r: Row }) {
  const venmo = r.venmoHandle ? `Venmo @${r.venmoHandle.replace(/^@/, "")}` : null;
  if (r.stripe === "ready") return <span className="font-semibold text-earned" title={venmo ? `Fallback: ${venmo}` : undefined}>Stripe</span>;
  return (
    <span>
      {venmo ?? <span className="text-coral">No Venmo</span>}
      {r.stripe === "pending" && <span className="block text-[12px] text-ink-2">Stripe setup unfinished</span>}
    </span>
  );
}

function PayButton({ r, busy, onClick }: { r: Row; busy: boolean; onClick: () => void }) {
  const paid = r.payout.status === "PAID";
  const canPay = useAdminCan("money");
  const viaStripe = paid && r.payout.method === "stripe";
  const realTransfer = viaStripe && !!r.payout.stripeTransferId && !r.payout.stripeTransferId.startsWith("tr_sim_");
  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-2">
      {paid && (
        <span className="rounded-full bg-earned-soft px-2.5 py-1 text-[13px] font-bold text-earned" title={r.payout.stripeTransferId || undefined}>
          Paid {r.payout.paidAt ? new Date(r.payout.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : ""}
          {viaStripe ? " · Stripe" : r.payout.method === "venmo" ? " · Venmo" : ""}
        </span>
      )}
      {!paid && r.payout.failureReason && (
        <span className="max-w-[260px] text-left text-[12px] font-semibold text-coral" title={r.payout.failureReason}>Stripe failed: {r.payout.failureReason}</span>
      )}
      {!realTransfer && (
        <button type="button" disabled={busy || !canPay} title={canPay ? undefined : "Payouts need the admin or owner role."} onClick={onClick} className={cn("btn btn-sm", paid && "btn-ghost")}>
          {paid ? "Undo" : "Mark paid"}
        </button>
      )}
    </div>
  );
}

function Badges({ r }: { r: Row }) {
  return (
    <>
      {r.late && <span className="rounded-full bg-coral px-2 py-px text-[11.5px] font-bold text-white" title="Unpaid more than 3 days after the 5th">Late</span>}
      {r.closed && <span className="rounded-full bg-wall px-2 py-px text-[11.5px] font-bold text-ink-2" title="Account closed. Still owed what they earned.">Closed</span>}
    </>
  );
}
