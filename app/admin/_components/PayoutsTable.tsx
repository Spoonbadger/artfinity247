"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PaintChip } from "@/components/af/Brush";
import { cn } from "@/lib/utils";
import { monthLabel, usd } from "./util";

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
      toast.success(paid ? `${r.artistName} marked unpaid` : `${r.artistName} marked paid. Email sent.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't update the payout.");
    } finally {
      setBusy(null);
    }
  };

  const list = rows ?? [];
  const owed = list.reduce((n, r) => n + r.artistShare, 0);
  const paid = list.filter((r) => r.payout.status === "PAID").reduce((n, r) => n + r.payout.amountCents, 0);
  const gross = list.reduce((n, r) => n + r.gross, 0);
  const unpaidCount = list.filter((r) => r.payout.status !== "PAID").length;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PaintChip color="#a8dcc4" value={usd(gross)} label="sales" earned />
        <PaintChip color="#f7c8a8" value={usd(owed)} label="artist share" earned />
        <PaintChip color="#b8c4ff" value={usd(paid)} label="paid out" earned />
        <PaintChip color="var(--af-sticker)" value={unpaidCount} label={unpaidCount === 1 ? "artist to pay" : "artists to pay"} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {rows === null ? (
          <p className="px-4 py-14 text-center text-ink-2">Loading {monthLabel(month)}…</p>
        ) : error ? (
          <p className="px-4 py-14 text-center text-coral">Couldn&apos;t load payouts.</p>
        ) : list.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-4 py-14 text-center">
            <span className="paint-dab h-6 w-6" style={{ ["--dab" as string]: "var(--af-sticker)" }} />
            <p className="font-semibold">No paid sales in {monthLabel(month)}.</p>
          </div>
        ) : (
          <>
            {/* desktop table */}
            <table className="num hidden w-full text-left text-[14px] md:table">
              <thead className="border-b border-line bg-wall/60 text-[12px] uppercase tracking-[0.06em] text-ink-2">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Artist</th>
                  <th className="px-3 py-2.5 font-bold">Paid to</th>
                  <th className="px-3 py-2.5 text-right font-bold">Prints</th>
                  <th className="px-3 py-2.5 text-right font-bold">Sales</th>
                  <th className="px-3 py-2.5 text-right font-bold">Costs</th>
                  <th className="px-3 py-2.5 text-right font-bold">Profit</th>
                  <th className="px-3 py-2.5 text-right font-bold">To artist</th>
                  <th className="px-4 py-2.5 text-right font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.artistId}>
                    <td className="px-4 py-3">
                      <b className="flex flex-wrap items-center gap-1.5">{r.artistName}<Badges r={r} /></b>
                      <span className="text-[12.5px] text-ink-2">{r.artistEmail}</span>
                    </td>
                    <td className="px-3 py-3"><PaidTo r={r} /></td>
                    <td className="px-3 py-3 text-right">{r.itemsCount}</td>
                    <td className="px-3 py-3 text-right">{usd(r.gross)}</td>
                    <td className="px-3 py-3 text-right text-ink-2">{usd(r.expenses)}</td>
                    <td className="px-3 py-3 text-right">{usd(r.profit)}</td>
                    <td className="px-3 py-3 text-right text-[16px] font-bold text-earned">{usd(r.artistShare)}</td>
                    <td className="px-4 py-3 text-right"><PayButton r={r} busy={busy === r.artistId} onClick={() => toggle(r)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {list.map((r) => (
                <li key={r.artistId} className="grid gap-2 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <b className="flex flex-wrap items-center gap-1.5"><span className="truncate">{r.artistName}</span><Badges r={r} /></b>
                      <span className="text-[13px] text-ink-2"><PaidTo r={r} /> · {r.itemsCount} {r.itemsCount === 1 ? "print" : "prints"}</span>
                    </div>
                    <b className="num shrink-0 text-[18px] text-earned">{usd(r.artistShare)}</b>
                  </div>
                  <div className="num text-[12.5px] text-ink-2">{usd(r.gross)} sales · {usd(r.expenses)} costs · {usd(r.profit)} profit</div>
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
  const viaStripe = paid && r.payout.method === "stripe";
  const realTransfer = viaStripe && !!r.payout.stripeTransferId && !r.payout.stripeTransferId.startsWith("tr_sim_");
  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-2">
      {paid && (
        <span className="rounded-full bg-earned-soft px-2.5 py-1 text-[12.5px] font-bold text-earned" title={r.payout.stripeTransferId || undefined}>
          Paid {r.payout.paidAt ? new Date(r.payout.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
          {viaStripe ? " · Stripe" : r.payout.method === "venmo" ? " · Venmo" : ""}
        </span>
      )}
      {!paid && r.payout.failureReason && (
        <span className="max-w-[260px] text-left text-[12px] font-semibold text-coral" title={r.payout.failureReason}>Stripe failed: {r.payout.failureReason}</span>
      )}
      {!realTransfer && (
        <button type="button" disabled={busy} onClick={onClick} className={cn("btn btn-sm", paid ? "btn-ghost" : "btn-blue")}>
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
