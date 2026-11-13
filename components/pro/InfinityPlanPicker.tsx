"use client";
// /pricing's billing period, laid out the way most pricing pages do it (Notion, Squarespace): one Monthly / Yearly
// switch above the plan cards, with the saving on the switch, and the Infinity price shown per month either way
// ("$20 /month, billed yearly at $240"), with the other period's price underneath. Yearly is the default.
import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { PRO, REFERRALS, dollars, proPrice, proYearlyPrice, yearlySavingsCents } from "@/lib/plans";
import { cn } from "@/lib/utils";
import StartInfinityButton from "./StartInfinityButton";

type Interval = "month" | "year";
const Ctx = createContext<{ interval: Interval; set: (i: Interval) => void }>({ interval: "year", set: () => {} });

export function BillingPeriodProvider({ children }: { children: ReactNode }) {
  const [interval, set] = useState<Interval>("year");
  return <Ctx.Provider value={{ interval, set }}>{children}</Ctx.Provider>;
}

export function BillingToggle({ className, dark = false }: { className?: string; dark?: boolean }) {
  const { interval, set } = useContext(Ctx);
  const save = yearlySavingsCents();
  return (
    <div role="radiogroup" aria-label="Billing period" className={cn("inline-flex w-fit rounded-full border-[1.5px] p-1", dark ? "border-white/40" : "border-line bg-white", className)}>
      {(["year", "month"] as const).map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={interval === i}
          onClick={() => set(i)}
          className={cn(
            "min-h-[38px] rounded-full px-4 text-[14px] font-bold transition",
            interval === i ? (dark ? "bg-white text-ink" : "bg-ink text-white") : dark ? "text-white/80 hover:text-white" : "text-ink-2 hover:text-ink",
          )}
        >
          {i === "year" ? <>Yearly{save > 0 && <span className={(interval === i) !== dark ? "text-sticker" : "text-earned"}> · save {dollars(save)}</span>}</> : "Monthly"}
        </button>
      ))}
    </div>
  );
}

/** Price, what it's billed as, and the other period's price. */
export function InfinityPrice() {
  const { interval } = useContext(Ctx);
  const yearly = interval === "year";
  const save = yearlySavingsCents();
  return (
    <div className="grid content-start gap-1">
      <p className="t-num !text-white">
        {yearly ? dollars(Math.round(PRO.yearlyCents / 12)) : proPrice()}
        <span className="font-body text-[17px] font-bold text-white/75 [font-variation-settings:normal]"> /month</span>
      </p>
      <p className="text-[15px] font-semibold">{yearly ? `Billed yearly at ${proYearlyPrice()}` : "Billed monthly"}</p>
      <p className="t-small !text-white/75">
        {yearly ? `${proPrice()} a month if billed monthly` : `${dollars(Math.round(PRO.yearlyCents / 12))} a month if billed yearly${save > 0 ? `, save ${dollars(save)}` : ""}`}
      </p>
    </div>
  );
}

export function InfinityCta() {
  const { interval } = useContext(Ctx);
  return (
    <div className="grid content-start gap-2">
      <StartInfinityButton
        interval={interval}
        label={`Get ${PRO.name}`}
        className="btn btn-sticker btn-lg w-full"
        activeClassName="btn btn-ghost btn-lg w-full !border-white !text-white hover:!bg-white hover:!text-ink"
      />
      <p className="t-small text-center !text-white/75">
        Cancel anytime. Or <Link href="/studio/infinity#referrals" className="font-bold text-white underline underline-offset-2">share Artfinity</Link> for {REFERRALS.rewardMonths} months free.
      </p>
    </div>
  );
}
