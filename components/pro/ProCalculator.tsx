"use client";

import { useId, useMemo, useState } from "react";
import { basePrices } from "@/lib/artwork_price";
import { breakdown, money, moneyRound } from "@/lib/earnings";
import { FREE_SPLIT, PRO, pct } from "@/lib/plans";
import { cn } from "@/lib/utils";

const MIN_PRICE = Math.ceil(basePrices.medium / 100); // $45
const MAX_PRICE = 200;

/** Monthly earnings on Free vs Pro for `prints` Medium prints at `priceCents` each. */
export function monthly(prints: number, priceCents: number) {
  const b = breakdown("medium", Math.max(0, priceCents - basePrices.medium));
  const freeEach = Math.round(b.profit * FREE_SPLIT);
  const proEach = Math.round(b.profit * PRO.split);
  const proPrints = PRO.monthlyPrintCap == null ? prints : Math.min(prints, PRO.monthlyPrintCap);
  const free = freeEach * prints;
  const pro = proEach * proPrints + freeEach * (prints - proPrints) - PRO.priceCents;
  // Fewest prints a month where Pro earns at least as much as Free.
  const extra = proEach - freeEach;
  const breakEven = extra > 0 ? Math.ceil(PRO.priceCents / extra) : null;
  const reachable = breakEven != null && (PRO.monthlyPrintCap == null || breakEven <= PRO.monthlyPrintCap);
  return { profitEach: b.profit, freeEach, proEach, free, pro, breakEven: reachable ? breakEven : null };
}

function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; format: (n: number) => string }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] font-bold">{label}</label>
        <output htmlFor={id} className="display num text-[28px] leading-none">{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-[var(--af-scan)]"
      />
    </div>
  );
}

export default function ProCalculator({ initialPrints = 8, initialPrice = 60 }: { initialPrints?: number; initialPrice?: number }) {
  const [prints, setPrints] = useState(initialPrints);
  const [price, setPrice] = useState(initialPrice);
  const m = useMemo(() => monthly(prints, price * 100 - 1), [prints, price]); // $60 -> $59.99
  const max = Math.max(m.free, m.pro, 1);
  const proWins = m.pro > m.free;
  const diff = Math.abs(m.pro - m.free);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10">
      <div className="grid content-start gap-5">
        <Slider label="Prints sold a month" value={prints} min={0} max={100} onChange={setPrints} format={(n) => String(n)} />
        <Slider label="Average price" value={price} min={MIN_PRICE} max={MAX_PRICE} onChange={setPrice} format={(n) => `$${n}`} />
        <p className="text-[13px] text-ink-2">
          Medium prints, unframed. You earn {money(m.freeEach)} a print on Free, {money(m.proEach)} on Pro.
        </p>
      </div>

      <div className="grid content-start gap-4" aria-live="polite">
        {[
          { key: "free", name: `Free · ${pct(FREE_SPLIT)}`, value: m.free, color: "var(--af-ink-2)" },
          { key: "pro", name: `Pro · ${pct(PRO.split)}, after $${PRO.priceCents / 100}`, value: m.pro, color: "var(--af-earned)" },
        ].map((r) => (
          <div key={r.key} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-bold">{r.name}</span>
              <b className={cn("display num text-[30px] leading-none", r.value >= 0 ? "text-earned" : "text-coral")}>
                {r.value < 0 ? "−" : ""}{moneyRound(Math.abs(r.value))}<span className="text-[15px] text-ink-2">/mo</span>
              </b>
            </div>
            <span className="block h-4 overflow-hidden rounded-full bg-wall">
              <span className="block h-full rounded-full transition-[width]" style={{ width: `${Math.max(0, (r.value / max) * 100)}%`, background: r.color }} />
            </span>
          </div>
        ))}

        <div className={cn("rounded-2xl border-[1.5px] p-4", proWins ? "border-earned bg-earned-soft" : "border-line bg-wall")}>
          <b className="block text-[17px]">
            {proWins ? `Pro earns you ${moneyRound(diff)} more a month.` : diff === 0 ? "Even either way." : `Free is better for you now, by ${moneyRound(diff)}.`}
          </b>
          <span className="text-[14px] text-ink-2">
            {m.breakEven != null ? `Pro pays for itself at ${m.breakEven} prints a month at this price.` : "At this price Pro doesn't pay for itself on prints alone."}
          </span>
        </div>
      </div>
    </div>
  );
}
