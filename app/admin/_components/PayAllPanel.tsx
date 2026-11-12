"use client";

// "Pay all ready payouts": Stripe transfers for payout-ready artists (lib/payouts.ts), and below it the artists whose
// money is held because they haven't finished Stripe setup, with a "Send reminder" button (one per artist per 7 days).
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";
import { day, monthLabel, usd } from "./util";
import { PAYOUTS_CHANGED } from "./PayoutsTable";
import { useAdminCan } from "./AdminRole";

type ReadyMonth = { month: string; amountCents: number; failureReason: string | null; adjustmentCents?: number };
type Ready = { artistId: string; artistName: string; months: ReadyMonth[]; totalCents: number };
type Waiting = {
  artistId: string; artistName: string; email: string; stripeStatus: "not_connected" | "pending" | "ready"; closed: boolean;
  heldCents: number; months: string[]; heldSince: string; daysHeld: number; lastReminderAt: string | null; nextReminderAt: string | null;
};
type Mode = "live" | "simulated" | "off";
type RunResult = {
  mode: Mode;
  paid: { artistId: string; artistName: string; month: string; amountCents: number; transferId: string; simulated: boolean }[];
  failed: { artistId: string; artistName: string; month: string; amountCents: number; reason: string }[];
  insufficientFunds: boolean;
};

const monthsText = (ms: string[]) => ms.map((m) => monthLabel(m).split(" ")[0]).join(", ");
const sum = (rs: Ready[]) => rs.reduce((n, r) => n + r.totalCents, 0);
/** What pressing Pay does, in one line: shown above the button and again in the confirm. */
const payLine = (rs: Ready[], mode?: Mode) =>
  mode === "simulated"
    ? `Test mode: marks ${usd(sum(rs))} to ${rs.length} ${rs.length === 1 ? "artist" : "artists"} as paid and sends the emails. No money moves.`
    : `Sends ${usd(sum(rs))} from the Stripe balance to ${rs.length} ${rs.length === 1 ? "artist" : "artists"} now. Each is emailed. Transfers can't be undone.`;
const heldFor = (d: number) => (d === 0 ? "Since today" : d < 60 ? `${d} ${d === 1 ? "day" : "days"}` : `${Math.round(d / 30)} months`);

export default function PayAllPanel() {
  const router = useRouter();
  const [data, setData] = useState<{ mode: Mode; ready: Ready[]; waiting: Waiting[] } | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/payouts/pay-all", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setData(await r.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stripe = data?.ready ?? [];
  const allowed = useAdminCan("money");
  const canPay = allowed && data?.mode !== "off" && stripe.length > 0;

  const run = async () => {
    if (!confirm(`${payLine(stripe, data?.mode)}\n\nGo ahead?`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/payouts/pay-all", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "");
      setResult(d);
      if (d.failed.length) failed(`${d.failed.length} ${d.failed.length === 1 ? "transfer" : "transfers"} failed`, { description: "The reasons are listed under Ready to pay.", retry: run });
      else saved(`Sent ${d.paid.length} ${d.paid.length === 1 ? "payout" : "payouts"}`);
      window.dispatchEvent(new Event(PAYOUTS_CHANGED));
      router.refresh();
      await load();
    } catch (e: any) {
      failed(e?.message || "Pay all failed.", { fix: { label: "Check Stripe setup", href: "/admin#integrations" } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section aria-labelledby="payall-h" className="af-panel grid gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="payall-h" className="t-card">Ready to pay</h2>
            {canPay && <p className="t-small mt-1">{payLine(stripe, data?.mode)}</p>}
          </div>
          <button type="button" onClick={run} disabled={!canPay || busy} title={allowed ? undefined : "Payouts need the admin or owner role."} className="btn btn-blue">
            {busy ? "Sending…" : stripe.length ? `Pay ${stripe.length} by Stripe · ${usd(sum(stripe))}` : "Pay all by Stripe"}
          </button>
        </div>

        {data?.mode === "simulated" && (
          <p className="rounded-[4px] bg-sticker/50 px-3 py-2 text-[13.5px]"><b>Test mode.</b> Transfers are simulated. No money moves.</p>
        )}
        {data?.mode === "off" && (
          <p className="rounded-[4px] bg-sticker/50 px-3 py-2 text-[13.5px]"><b>Stripe isn&apos;t set up.</b> Add STRIPE_SECRET_KEY. Until then nobody is paid, and every balance waits.</p>
        )}

        {result?.insufficientFunds && (
          <div role="alert" className="grid gap-1 rounded-[4px] border-2 border-coral bg-[#fff1ed] px-4 py-3 text-[14px]">
            <b>Not enough money in your Stripe balance.</b>
            <span>Add funds in Stripe (Balance → Add to balance) or wait for sales to clear, then pay again. Paid months are skipped.</span>
          </div>
        )}
        {result && (result.paid.length > 0 || result.failed.length > 0) && (
          <div role="status" className="grid gap-1.5 rounded-[4px] bg-wall p-3 text-[13.5px]">
            {result.paid.length > 0 && (
              <p><b className="text-earned">Sent {usd(result.paid.reduce((n, p) => n + p.amountCents, 0))}</b> in {result.paid.length} {result.paid.length === 1 ? "transfer" : "transfers"}{result.paid.some((p) => p.simulated) ? " (simulated)" : ""}.</p>
            )}
            {result.failed.map((f) => (
              <p key={`${f.artistId}:${f.month}`} className="text-coral"><b>{f.artistName}, {monthLabel(f.month)} ({usd(f.amountCents)}):</b> {f.reason}</p>
            ))}
          </div>
        )}

        {error ? (
          <p className="text-coral">Couldn&apos;t load what&apos;s ready.</p>
        ) : !data ? (
          <p className="text-ink-2">Loading…</p>
        ) : stripe.length === 0 ? (
          <p className="text-[15px] font-semibold">{data.waiting.length ? "Every connected artist is paid." : "Everyone's paid."}</p>
        ) : (
          <ul className="box-inset grid divide-y divide-line p-3.5 text-[14px]">
            {stripe.map((r) => (
              <li key={r.artistId} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  <b className="font-semibold">{r.artistName}</b> <span className="text-[13px] text-ink-2">{monthsText(r.months.map((m) => m.month))}</span>
                  {r.months.some((m) => m.failureReason) && <span className="block text-[13px] font-semibold text-coral">Last try failed</span>}
                </span>
                <span className="shrink-0 text-right">
                  <b className="num block text-earned">{usd(r.totalCents)}</b>
                  {r.months.some((m) => m.adjustmentCents) && (
                    <span className="num block text-[13px] font-semibold text-coral" title="A paid-out refund comes off this payout (Settings → Refunds after a payout).">
                      after {usd(r.months.reduce((n, m) => n + (m.adjustmentCents ?? 0), 0))} refund adj.
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data && data.waiting.length > 0 && <WaitingList rows={data.waiting} onSent={load} />}
    </>
  );
}

/** Artists whose closed months are held until they finish Stripe setup. The 5th pays them once they do. */
function WaitingList({ rows, onSent }: { rows: Waiting[]; onSent: () => void }) {
  const can = useAdminCan("accountSupport");
  const [busy, setBusy] = useState<string | null>(null);
  const total = rows.reduce((n, r) => n + r.heldCents, 0);

  const remind = async (r: Waiting) => {
    setBusy(r.artistId);
    try {
      const res = await fetch("/api/admin/payouts/remind", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artistId: r.artistId }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "");
      saved(`Reminder sent to ${r.artistName}`, { description: "They get a link to Studio → Money." });
      onSent();
    } catch (e: any) {
      failed(e?.message || "Couldn't send the reminder.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="waiting" aria-labelledby="waiting-h" className="af-panel grid scroll-mt-24 gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 id="waiting-h" className="t-card">Waiting on Stripe setup</h2>
          <p className="t-small mt-1">Held until they connect. The next run on the 5th pays them. Not late.</p>
        </div>
        <span className="num text-[13px] text-ink-2">{rows.length} · <b className="text-earned">{usd(total)}</b></span>
      </div>
      <ul className="grid divide-y divide-line text-[14px]">
        {rows.map((r) => {
          const wait = !!r.nextReminderAt;
          const why = !can ? "Needs an admin role." : r.closed ? "Account closed: reopen it so they can connect." : wait ? `One reminder a week. Next from ${day(r.nextReminderAt)}.` : `Emails ${r.email} a link to Studio → Money`;
          return (
            <li key={r.artistId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_auto]">
              <span className="min-w-0">
                <a href={`/admin/artists/${r.artistId}`} className="font-semibold hover:underline">{r.artistName}</a>
                <span className="block truncate text-[13px] text-ink-2">{r.closed ? "Closed · " : ""}{r.stripeStatus === "pending" ? "Stripe setup unfinished" : "Not connected"} · {monthsText(r.months)}</span>
              </span>
              <b className="num text-right text-earned sm:text-left">{usd(r.heldCents)}</b>
              <span className="text-[13px] text-ink-2">
                <span title={`Held since ${day(r.heldSince)}`}>{heldFor(r.daysHeld)}</span>
                {r.lastReminderAt && <span className="block">Reminded {day(r.lastReminderAt)}</span>}
              </span>
              <button
                type="button"
                onClick={() => remind(r)}
                disabled={!can || wait || r.closed || busy === r.artistId}
                title={why}
                aria-label={`Send reminder to ${r.artistName}`}
                className="btn btn-ghost btn-sm justify-self-end"
              >
                {busy === r.artistId ? "Sending…" : wait ? "Reminded" : "Send reminder"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
