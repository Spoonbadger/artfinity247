"use client";

// "Pay all ready payouts": Stripe transfers for connected artists, a by-hand Venmo list for the rest (lib/payouts.ts).
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";
import { monthLabel, usd } from "./util";
import { PAYOUTS_CHANGED } from "./PayoutsTable";
import { useAdminCan } from "./AdminRole";

type ReadyMonth = { month: string; amountCents: number; failureReason: string | null; adjustmentCents?: number };
type Ready = { artistId: string; artistName: string; venmoHandle: string | null; route: "stripe" | "venmo"; months: ReadyMonth[]; totalCents: number };
type Mode = "live" | "simulated" | "off";
type RunResult = {
  mode: Mode;
  paid: { artistId: string; artistName: string; month: string; amountCents: number; transferId: string; simulated: boolean }[];
  failed: { artistId: string; artistName: string; month: string; amountCents: number; reason: string }[];
  insufficientFunds: boolean;
};

const monthsText = (ms: ReadyMonth[]) => ms.map((m) => monthLabel(m.month).split(" ")[0]).join(", ");
const sum = (rs: Ready[]) => rs.reduce((n, r) => n + r.totalCents, 0);

export default function PayAllPanel() {
  const router = useRouter();
  const [data, setData] = useState<{ mode: Mode; ready: Ready[] } | null>(null);
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

  const stripe = data?.ready.filter((r) => r.route === "stripe") ?? [];
  const venmo = data?.ready.filter((r) => r.route === "venmo") ?? [];
  const allowed = useAdminCan("money");
  const canPay = allowed && data?.mode !== "off" && stripe.length > 0;

  const run = async () => {
    if (!confirm(`Send ${usd(sum(stripe))} to ${stripe.length} ${stripe.length === 1 ? "artist" : "artists"} through Stripe? They'll get an email.`)) return;
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
    <section aria-labelledby="payall-h" className="af-panel grid gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="payall-h" className="text-[20px] font-bold">Ready to pay</h2>
          <p className="text-[13.5px] text-ink-2">Every closed, unpaid month. Same amounts artists see.</p>
        </div>
        <button type="button" onClick={run} disabled={!canPay || busy} title={allowed ? undefined : "Payouts need the admin or owner role."} className="btn btn-blue">
          {busy ? "Sending…" : stripe.length ? `Pay ${stripe.length} by Stripe · ${usd(sum(stripe))}` : "Pay all by Stripe"}
        </button>
      </div>

      {data?.mode === "simulated" && (
        <p className="rounded-[4px] bg-sticker/50 px-3 py-2 text-[13.5px]"><b>Stripe isn&apos;t set up here.</b> Transfers are simulated, so you can try the flow. No money moves.</p>
      )}
      {data?.mode === "off" && (
        <p className="rounded-[4px] bg-sticker/50 px-3 py-2 text-[13.5px]"><b>Stripe isn&apos;t set up.</b> Add STRIPE_SECRET_KEY to pay connected artists automatically. Venmo still works by hand.</p>
      )}

      {result?.insufficientFunds && (
        <div role="alert" className="grid gap-1 rounded-[4px] border-2 border-coral bg-[#fff1ed] px-4 py-3 text-[14px]">
          <b>Not enough money in your Stripe balance.</b>
          <span>Add funds in Stripe (Balance → Add to balance) or wait for recent sales to become available, then press Pay all again. Paid months are skipped.</span>
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
      ) : data.ready.length === 0 ? (
        <p className="flex items-center gap-2 text-[14px] font-semibold"><i className="paint-dab h-3 w-3" style={{ ["--dab" as string]: "var(--af-earned)" }} />Everyone&apos;s paid.</p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Group
            title="Stripe: automatic"
            dab="var(--af-earned)"
            empty="No connected artists waiting."
            rows={stripe}
            right={(r) => r.months.some((m) => m.failureReason) ? <span className="text-[12px] font-semibold text-coral">Last try failed</span> : null}
          />
          <Group
            title="Venmo: pay by hand"
            dab="var(--af-sticker)"
            empty="No one to pay by hand."
            rows={venmo}
            note="Send it in Venmo, then Mark paid below."
            right={(r) => <span className={r.venmoHandle ? "text-ink-2" : "font-semibold text-coral"}>{r.venmoHandle ? `@${r.venmoHandle.replace(/^@/, "")}` : "No Venmo"}</span>}
          />
        </div>
      )}
    </section>
  );
}

function Group({ title, dab, rows, empty, note, right }: { title: string; dab: string; rows: Ready[]; empty: string; note?: string; right: (r: Ready) => React.ReactNode }) {
  return (
    <div className="af-panel grid content-start gap-2 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-bold"><i className="paint-dab h-3 w-3" style={{ ["--dab" as string]: dab }} />{title}</h3>
        <span className="num text-[13px] text-ink-2">{rows.length} · <b className="text-earned">{usd(sum(rows))}</b></span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">{empty}</p>
      ) : (
        <ul className="grid divide-y divide-line text-[14px]">
          {rows.map((r) => (
            <li key={r.artistId} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0">
                <b className="font-semibold">{r.artistName}</b> <span className="text-[12.5px] text-ink-2">{monthsText(r.months)}</span>
                <span className="block text-[12.5px]">{right(r)}</span>
              </span>
              <span className="shrink-0 text-right">
                <b className="num block text-earned">{usd(r.totalCents)}</b>
                {r.months.some((m) => m.adjustmentCents) && (
                  <span className="num block text-[11.5px] font-semibold text-coral" title="A paid-out refund comes off this payout (Settings → Refunds after a payout).">
                    after {usd(r.months.reduce((n, m) => n + (m.adjustmentCents ?? 0), 0))} refund adj.
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {note && rows.length > 0 && <p className="text-[12.5px] text-ink-2">{note}</p>}
    </div>
  );
}
