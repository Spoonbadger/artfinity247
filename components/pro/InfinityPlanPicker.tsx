"use client";
// The Infinity card's price on /pricing: a Monthly / Yearly switch, the price for that choice, and the checkout
// button for it. Monthly is the default; yearly shows what it saves, nothing louder.
import { useState } from "react";
import { PRO, dollars, proPrice, proYearlyPrice, yearlySavingsCents } from "@/lib/plans";
import { cn } from "@/lib/utils";
import StartInfinityButton from "./StartInfinityButton";

type Interval = "month" | "year";

export default function InfinityPlanPicker() {
  const [interval, setPeriod] = useState<Interval>("month");
  const yearly = interval === "year";
  const save = yearlySavingsCents();
  const monthsFree = Math.floor(save / PRO.priceCents);

  return (
    <>
      <div className="relative grid gap-3">
        <div role="radiogroup" aria-label="Billing period" className="inline-flex w-fit rounded-full border-[1.5px] border-white/40 p-1">
          {(["month", "year"] as const).map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={interval === i}
              onClick={() => setPeriod(i)}
              className={cn(
                "min-h-[36px] rounded-full px-4 text-[14px] font-bold transition",
                interval === i ? "bg-white text-ink" : "text-white/80 hover:text-white",
              )}
            >
              {i === "month" ? "Monthly" : <>Yearly{save > 0 && <span className={interval === i ? "text-earned" : "text-sticker"}> · save {dollars(save)}</span>}</>}
            </button>
          ))}
        </div>
        <p className="t-num !text-white">
          {yearly ? proYearlyPrice() : proPrice()}
          <span className="font-body text-[17px] font-bold text-white/70 [font-variation-settings:normal]">{yearly ? "/yr" : "/mo"}</span>
        </p>
        <p className="t-muted !text-white/75">
          {yearly
            ? `Works out to ${dollars(Math.round(PRO.yearlyCents / 12))} a month${monthsFree > 0 ? `, ${monthsFree} months free` : ""}.`
            : `Or ${proYearlyPrice()} a year${save > 0 ? ` and save ${dollars(save)}` : ""}.`}
        </p>
      </div>
      <div className="relative grid gap-2">
        <StartInfinityButton
          interval={interval}
          label={<>Get {PRO.name} · {yearly ? `${proYearlyPrice()}/year` : `${proPrice()}/month`}</>}
          className="btn btn-sticker btn-lg w-full"
          activeClassName="btn btn-ghost btn-lg w-full !border-white !text-white hover:!bg-white hover:!text-ink"
        />
        <span className="t-small text-center !text-white/75">
          {yearly ? "Billed yearly by Stripe. Cancel anytime." : "Billed monthly by Stripe. Cancel anytime."}
        </span>
      </div>
    </>
  );
}
