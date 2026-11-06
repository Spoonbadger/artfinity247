// Shown at the top of every Studio page while the artist's Infinity payment is failing (lib/billing.ts).
import { ManageBillingButton } from "@/components/pro/StartInfinityButton";
import { FREE_SPLIT, PRO, formatPlanDate, pct } from "@/lib/plans";

export default function BillingBanner({ until }: { until: Date | null }) {
  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-9">
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border-2 border-coral bg-[#fff1ed] px-4 py-3 text-[14.5px] leading-relaxed">
        <p className="min-w-0 flex-1">
          <b className="text-[15.5px]">Your {PRO.name} payment didn&apos;t go through.</b>{" "}
          {until ? <>You keep {PRO.name} until {formatPlanDate(until)} while we try again. </> : null}
          Update your card to keep {pct(PRO.split)} of profit; otherwise new sales go back to {pct(FREE_SPLIT)}.
        </p>
        <ManageBillingButton label="Update card" className="btn btn-blue btn-sm min-h-[44px] md:min-h-0" />
      </div>
    </div>
  );
}
