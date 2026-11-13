import Link from "next/link";
import { Swatch } from "@/components/af/Brush";
import type { Balance } from "@/lib/balance";
import { dayUTC, usd } from "./format";

/** Small "Balance" paint chip for the Studio dashboard, linking to /studio/money. */
export default function BalanceChip({ b }: { b: Balance }) {
  return (
    <Link
      href="/studio/money"
      className="group grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-[3px] border border-line bg-white p-2 pr-4 text-ink no-underline shadow-[0_2px_0_var(--af-line)] hover:border-ink sm:grid-cols-[88px_minmax(0,1fr)_auto]"
    >
      <Swatch color="#0f7a55" className="h-12" />
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <b className="display num text-[26px] text-earned">{usd(b.pendingCents + b.availableCents)}</b>
          <span className="text-[13px] text-ink-2">balance</span>
        </span>
        <span className="block truncate text-[13px] text-ink-2">
          {b.lateMonths.length > 0 ? <span className="font-semibold text-coral">Payout late</span> : b.heldCents > 0 ? <span className="font-semibold text-coral">Held: connect Stripe</span> : <>Next payout {dayUTC(b.nextPayout.date)}</>} · {usd(b.nextPayout.amountCents)}
        </span>
      </span>
      <span className="text-[14px] font-bold text-scan group-hover:underline">Money →</span>
    </Link>
  );
}
