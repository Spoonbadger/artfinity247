"use client";

import { useId, useState } from "react";
import { breakdown, money, moneyRound, SIZE_INCHES, SIZE_NAME, type SizeKey } from "@/lib/earnings";
import { Swatch } from "@/components/af/Brush";
import { cn } from "@/lib/utils";
import PaintBar from "@/components/motion/PaintBar";
import { useTween } from "@/components/motion/useTween";
import { FREE_SPLIT, pct } from "@/lib/plans";

const SIZES: SizeKey[] = ["small", "medium", "large", "xl"];
const SWATCH: Record<SizeKey, string> = { small: "#f3c969", medium: "#e98a5b", large: "#5b74c9", xl: "#2f3a68" };

/** What one piece could earn: size, markup, prints a month. Money in green. */
export default function EarningsCalculator({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const [size, setSize] = useState<SizeKey>("medium");
  const [markup, setMarkup] = useState(15);
  const [sales, setSales] = useState(8);
  const b = breakdown(size, markup * 100, 0);
  const month = b.artist * sales;
  const shownMonth = useTween(month);
  const shownPrint = useTween(b.artist);

  return (
    <div className={cn("grid items-center gap-8 md:grid-cols-[1fr_1.05fr] md:gap-12", compact && "md:gap-8")}>
      <div className="grid gap-6">
        <fieldset className="grid gap-2.5">
          <legend className="mb-2.5 text-[15px] font-semibold">Print size</legend>
          <div className="grid grid-cols-4 gap-2">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                onClick={() => setSize(s)}
                className={cn("group grid gap-1 rounded-[4px] border-[1.5px] bg-white p-1.5 pb-2 text-left transition", size === s ? "border-ink shadow-[3px_3px_0_var(--af-ink)]" : "border-line hover:border-ink")}
              >
                <Swatch color={SWATCH[s]} className="h-7 sm:h-9" />
                <b className="px-0.5 text-[14px] leading-tight sm:text-[15px]">{SIZE_NAME[s]}</b>
                <span className="num px-0.5 text-[13px] leading-tight text-ink-2">{SIZE_INCHES[s]}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <label htmlFor={`${id}-m`} className="grid gap-2">
          <span className="flex items-baseline justify-between text-[15px] font-semibold">Your markup <span className="num font-display text-[22px] font-extrabold [font-variation-settings:'wdth'_80]">${markup}</span></span>
          <input id={`${id}-m`} type="range" min={0} max={60} step={5} value={markup} onChange={(e) => setMarkup(+e.target.value)} className="h-11 w-full cursor-pointer accent-[var(--af-scan)]" />
        </label>
        <label htmlFor={`${id}-s`} className="grid gap-2">
          <span className="flex items-baseline justify-between text-[15px] font-semibold">Prints sold a month <span className="num font-display text-[22px] font-extrabold [font-variation-settings:'wdth'_80]">{sales}</span></span>
          <input id={`${id}-s`} type="range" min={1} max={60} step={1} value={sales} onChange={(e) => setSales(+e.target.value)} className="h-11 w-full cursor-pointer accent-[var(--af-scan)]" />
        </label>
      </div>

      <div className="af-card relative grid gap-1 p-6 shadow-[8px_8px_0_var(--af-ink)] sm:p-7">
        <span className="sr-only" aria-live="polite">{`About ${moneyRound(month)} a month, ${money(b.artist)} a print.`}</span>
        <span className="t-muted" aria-hidden="true">You’d earn about</span>
        <b className="t-num text-earned" aria-hidden="true">{moneyRound(shownMonth)}</b>
        <span className="t-muted" aria-hidden="true">a month · <b className="num text-earned">{money(Math.round(shownPrint))}</b> a print</span>
        <PaintBar
          className="mt-4 h-9"
          segs={[
            { label: "Printing and shipping", value: b.cost, color: "#cfc9bc" },
            { label: "Card fee and hosting", value: b.fee + b.hosting, color: "#a9a397" },
            { label: `Artfinity ${pct(1 - FREE_SPLIT)}`, value: b.company, color: "var(--af-ink)" },
            { label: `You ${pct(FREE_SPLIT)}`, value: b.artist, color: "var(--af-earned)" },
          ]}
        />
        <table className="num mt-4 w-full border-collapse text-[14px]">
          <tbody>
            <tr className="border-t border-line"><td className="py-1.5">{SIZE_NAME[size]} print price</td><td className="py-1.5 text-right">{money(b.price)}</td></tr>
            <tr className="border-t border-line"><td className="py-1.5 text-ink-2">Printing and shipping</td><td className="py-1.5 text-right text-ink-2">−{money(b.cost)}</td></tr>
            <tr className="border-t border-line"><td className="py-1.5 text-ink-2">Card fee and hosting</td><td className="py-1.5 text-right text-ink-2">−{money(b.fee + b.hosting)}</td></tr>
            <tr className="border-t border-line"><td className="py-1.5">Profit, split {pct(FREE_SPLIT).replace("%", "")}/{pct(1 - FREE_SPLIT).replace("%", "")}</td><td className="py-1.5 text-right">{money(b.profit)}</td></tr>
            <tr className="border-t-2 border-ink font-bold text-earned"><td className="pt-2">Your {pct(FREE_SPLIT)}</td><td className="pt-2 text-right">{money(b.artist)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
