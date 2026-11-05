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
  const stripe = b.payoutVia === "stripe";
  const months = np.months.map((m) => monthName(m).split(" ")[0]);
  const monthsText = months.length > 2 ? `${months.slice(0, -1).join(", ")} and ${months[months.length - 1]}` : months.join(" and ");
  const clearing = b.ledger.filter((l) => np.months.includes(l.payoutMonth) && l.status === "pending");
  const late = b.lateMonths.length > 0;
  const lateDue = late ? `${monthName(b.lateMonths[0], "long").split(" ")[0]} payout was due ${dayUTC(payoutDateFor(b.lateMonths[0]).toISOString())}. ` : "";
  const fresh = b.lifetimeCents === 0 && b.paidTotalCents === 0;

  // Buckets by where the money goes: next payout, the one after, or already paid.
  const readyCents = np.projected ? 0 : np.amountCents;
  const holdCents = b.pendingCents + b.availableCents - readyCents;
  const holdDate = dayUTC(payoutDateFor(b.currentMonth).toISOString());
  const thisMonth = monthName(b.currentMonth, "long").split(" ")[0];
  // Paid-out refunds taken off this payout (lib/refundPolicy.ts), net of what carried in from earlier months.
  const adjInNext = b.payouts.filter((p) => np.months.includes(p.month) && p.status !== "paid").reduce((n, p) => n + p.adjustmentCents + p.carryInCents, 0);

  const segs = [
    { k: "pending" as const, label: <>On hold <span className="font-normal text-ink-2">({RETURN_WINDOW_DAYS}-day returns)</span></>, value: holdCents, note: `${thisMonth} sales. Paid ${holdDate}.` },
    { k: "available" as const, label: <>Ready for next payout</>, value: readyCents, note: readyCents > 0 ? `${monthsText} sales.` : `Empty until ${thisMonth} ends.` },
    { k: "paid" as const, label: <>Paid out</>, value: b.paidTotalCents, note: "All time." },
  ];

  return (
    <section aria-labelledby="balance-h" className="af-card relative grid gap-5 overflow-hidden p-4 sm:p-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-end md:gap-6">
        <div className="min-w-0">
          <h2 id="balance-h" className="eyebrow">Your balance</h2>
          <p className="display num mt-1 text-[clamp(44px,9vw,72px)] leading-none text-earned">{usd(b.pendingCents + b.availableCents)}</p>
          <p className="mt-1.5 text-[13.5px] text-ink-2">{fresh ? "Your first sale shows up here." : `Not paid out yet · ${usd(b.lifetimeCents)} earned all time`}</p>
        </div>

        {/* Next payout and where it goes: the two things people open this page for. */}
        <div className="grid gap-1 rounded-[4px] bg-wall p-3.5 sm:p-4">
          <span className="text-[12.5px] font-semibold text-ink-2">Next payout</span>
          <p className="text-[19px] leading-tight sm:text-[21px]">
            <b className={late ? "text-coral" : undefined}>{late ? "Overdue" : dayUTC(np.date)}</b>
            {np.late && !late && <span className="text-[14px] text-ink-2"> (on its way)</span>}
            <span className="text-ink-2"> · </span>
            <b className="num text-earned">{usd(np.amountCents)}</b>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-[14px]">
            {stripe ? (
              <><Tick />Your bank, via Stripe</>
            ) : handle ? (
              <><Tick />Venmo <b>{handle}</b></>
            ) : (
              <><span className="font-semibold text-coral">No payout method yet</span><Link href="/studio/page#venmo" className="font-bold text-ink underline underline-offset-2">Add Venmo</Link></>
            )}
          </p>
          {!fresh && (
            <p className="text-[12.5px] text-ink-2">
              {np.projected
                ? `${monthsText} so far. Grows with each sale.`
                : `${lateDue}${monthsText} sales${clearing.length ? ` · ${usd(np.clearingCents)} still in the return window, paid anyway` : ""}`}
              {adjInNext < 0 && <> · after {usd(adjInNext)} in refund adjustments</>}
            </p>
          )}
          {b.carryForwardCents > 0 && (
            <p className="text-[12.5px] font-semibold text-coral">
              {usd(-b.carryForwardCents)} in refunds comes off your next payouts. A payout never goes below $0; the rest carries over.
            </p>
          )}
          {!late && <p className="text-[12.5px] text-ink-2">Sent automatically. Nothing to do.</p>}
        </div>
      </div>

      {!fresh && (
        <div className="grid gap-3">
          <PaintedBar pending={holdCents} available={readyCents} paid={b.paidTotalCents} />
          <dl className="grid gap-3 sm:grid-cols-3 sm:gap-5">
            {segs.map((s) => (
              <div key={s.k} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2.5 sm:grid-cols-1 sm:gap-y-0.5">
                <dt className="flex items-center gap-2.5 text-[14px] font-semibold">
                  <i
                    aria-hidden="true"
                    className="paint-dab h-3 w-3 shrink-0"
                    style={{ ["--dab" as string]: STATUS_COLOR[s.k], ...(s.k === "pending" ? { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 3px, rgba(15,122,85,.45) 3px 4.5px)" } : {}) }}
                  />
                  {s.label}
                </dt>
                <dd className="num text-right text-[18px] font-bold sm:pl-[22px] sm:text-left sm:text-[24px]">{usd(s.value)}</dd>
                <dd className="col-span-2 pl-[22px] text-[12.5px] text-ink-2 sm:col-span-1">{s.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 text-earned" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}
