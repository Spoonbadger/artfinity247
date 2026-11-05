import Link from "next/link";
import type { Balance } from "@/lib/balance";
import { RETURN_WINDOW_DAYS, payoutDateFor } from "@/lib/balance";
import { STATUS_COLOR, dayUTC, monthName, usd } from "./format";

/** One painted bar, pending → available → paid, clipped to a brush-stroke shape. */
function PaintedBar({ pending, available, paid }: { pending: number; available: number; paid: number }) {
  const total = pending + available + paid;
  const parts = [
    { v: pending, c: STATUS_COLOR.pending, hatch: true },
    { v: available, c: STATUS_COLOR.available },
    { v: paid, c: STATUS_COLOR.paid },
  ];
  let x = 0;
  return (
    <svg viewBox="0 0 600 34" preserveAspectRatio="none" className="block h-[30px] w-full sm:h-[34px]" aria-hidden="true">
      <defs>
        <clipPath id="money-stroke" clipPathUnits="userSpaceOnUse">
          <path d="M4 9C60 2 150 12 260 6S470 2 596 8L598 27C520 33 420 25 300 30S90 33 2 28Z" />
        </clipPath>
        <pattern id="money-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="#0f7a55" strokeWidth="2" opacity=".4" />
        </pattern>
      </defs>
      <g clipPath="url(#money-stroke)">
        <rect width="600" height="34" fill="var(--af-wall)" />
        {total > 0 &&
          parts.map((p, i) => {
            const w = (p.v / total) * 600;
            const el = (
              <g key={i}>
                <rect x={x} y="0" width={Math.max(0, w - (i < 2 && w > 0 ? 2 : 0))} height="34" fill={p.c} />
                {p.hatch && <rect x={x} y="0" width={Math.max(0, w - 2)} height="34" fill="url(#money-hatch)" />}
              </g>
            );
            x += w;
            return el;
          })}
        {/* dry-brush streaks */}
        <path d="M10 13C150 9 330 16 590 11M8 22C200 19 380 25 592 20" stroke="#fff" strokeWidth="2" fill="none" opacity=".22" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function BalanceCard({ b }: { b: Balance }) {
  const np = b.nextPayout;
  const handle = b.venmoHandle ? `@${b.venmoHandle.replace(/^@/, "")}` : null;
  const months = np.months.map((m) => monthName(m).split(" ")[0]);
  const monthsText = months.length > 2 ? `${months.slice(0, -1).join(", ")} and ${months[months.length - 1]}` : months.join(" and ");
  const clearing = b.ledger.filter((l) => np.months.includes(l.payoutMonth) && l.status === "pending");
  const lastClear = clearing.reduce((m, l) => (l.clearsAt > m ? l.clearsAt : m), "");
  const late = b.lateMonths.length > 0;
  // Overdue (past the grace days) / past the 5th but within it / normal.
  const when = late ? "overdue" : np.late ? `due ${dayUTC(np.date)}, on its way` : `paid ${dayUTC(np.date)}`;
  const lateDue = late ? `${monthName(b.lateMonths[0], "long").split(" ")[0]} payout was due ${dayUTC(payoutDateFor(b.lateMonths[0]).toISOString())}. ` : "";

  // Buckets by where the money goes: next payout, the one after, or already paid.
  const readyCents = np.projected ? 0 : np.amountCents;
  const holdCents = b.pendingCents + b.availableCents - readyCents;
  const holdDate = dayUTC(payoutDateFor(b.currentMonth).toISOString());
  const thisMonth = monthName(b.currentMonth, "long").split(" ")[0];

  const segs = [
    {
      k: "pending" as const,
      label: <>On hold <span className="font-normal text-ink-2">(return window)</span></>,
      value: holdCents,
      note: `${thisMonth} sales. They clear after the ${RETURN_WINDOW_DAYS}-day return window and are paid ${holdDate}.`,
    },
    {
      k: "available" as const,
      label: readyCents > 0 ? <>Ready for next payout <span className="whitespace-nowrap">— {when}</span></> : <>Ready for next payout</>,
      value: readyCents,
      note: readyCents > 0
        ? `${monthsText} sales, sent to your Venmo automatically.${clearing.length ? ` Includes ${usd(np.clearingCents)} still in the return window.` : ""}`
        : `Nothing waiting. ${thisMonth}'s sales move here when the month ends.`,
    },
    { k: "paid" as const, label: <>Paid out</>, value: b.paidTotalCents, note: "Sent to your Venmo, all time." },
  ];

  return (
    <section aria-labelledby="balance-h" className="af-card relative grid gap-5 overflow-hidden p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id="balance-h" className="eyebrow">Your balance</h2>
          <p className="display num mt-1 text-[clamp(44px,9vw,72px)] leading-none text-earned">{usd(b.pendingCents + b.availableCents)}</p>
          <p className="mt-1.5 text-[13.5px] text-ink-2">Earned, not paid out yet · {usd(b.lifetimeCents)} earned all time</p>
        </div>
      </div>

      <div className="grid gap-3">
        <PaintedBar pending={holdCents} available={readyCents} paid={b.paidTotalCents} />
        <dl className="grid gap-3 sm:grid-cols-3 sm:gap-5">
          {segs.map((s) => (
            <div key={s.k} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 sm:grid-cols-[14px_minmax(0,1fr)] sm:gap-y-0.5" title={s.note}>
              <i
                className="paint-dab h-3 w-3 self-center sm:self-baseline"
                style={{ ["--dab" as string]: STATUS_COLOR[s.k], ...(s.k === "pending" ? { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 3px, rgba(15,122,85,.45) 3px 4.5px)" } : {}) }}
              />
              <dt className="text-[14px] font-semibold">{s.label}</dt>
              <dd className="num text-right text-[18px] font-bold sm:col-start-2 sm:text-left sm:text-[24px]">{usd(s.value)}</dd>
              <dd className="col-start-2 col-end-4 text-[12.5px] text-ink-2 sm:col-end-3">{s.note}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-2 rounded-[4px] bg-wall p-3.5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-4">
        <div className="min-w-0">
          <p className="text-[15.5px] sm:text-[17px]">
            <b>Next payout: {late ? "overdue" : dayUTC(np.date)}</b>
            <span className="text-ink-2"> · </span>
            <b className="num text-earned">{usd(np.amountCents)}</b>
            <span className="text-ink-2"> to </span>
            {handle ? <b>Venmo {handle}</b> : <Link href="/studio/page" className="font-bold text-coral underline">add Venmo</Link>}
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            {np.projected
              ? `${monthsText} so far. Grows with every sale this month.`
              : `${lateDue}${monthsText} sales${clearing.length ? ` · ${usd(np.clearingCents)} still clearing until ${dayUTC(lastClear)}, paid anyway` : ""}`}
          </p>
        </div>
        <p className="flex items-center gap-2 text-[13px] font-semibold text-ink sm:max-w-[260px] sm:text-right">
          <i className="paint-dab h-3 w-3 sm:hidden" style={{ ["--dab" as string]: "#0f7a55" }} />
          Artfinity sends payouts monthly. You don&apos;t need to do anything.
        </p>
      </div>
    </section>
  );
}
