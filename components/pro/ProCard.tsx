import Link from "next/link";
import { BrushStroke } from "@/components/af/Brush";
import { PRO, formatPlanDate, pct, proPrice } from "@/lib/plans";
import ProChip from "./ProChip";
import StartInfinityButton from "./StartInfinityButton";

/** Studio dashboard card: "Go Infinity" for Free artists, "Infinity until <date>" for Infinity. */
export default function ProCard({ active, proUntil }: { active: boolean; proUntil: Date | null }) {
  if (active && proUntil) {
    return (
      <Link href="/studio/infinity" className="af-panel flex flex-wrap items-center justify-between gap-3 p-4 no-underline sm:px-5">
        <span className="flex items-center gap-3">
          <ProChip />
          <span className="text-[15px] font-bold text-ink">Infinity until {formatPlanDate(proUntil)}</span>
          <span className="hidden text-[13.5px] text-ink-2 sm:inline">{pct(PRO.split)} of profit</span>
        </span>
        <span className="text-[14px] font-bold text-scan">Plan and referrals</span>
      </Link>
    );
  }
  return (
    // Not one big link: the button starts checkout in one click (no second "Get Infinity" on the plan page).
    <div className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border-[1.5px] border-ink bg-ink p-4 text-white sm:px-5">
      <BrushStroke className="pointer-events-none absolute -right-6 -top-2 h-10 w-56 rotate-[-4deg] opacity-90" color="var(--af-sticker)" />
      <span className="relative grid gap-0.5">
        <b className="display text-[26px] leading-none !text-white">Go Infinity</b>
        <span className="text-[13.5px] text-white/75">{pct(PRO.split)} of profit, auto videos, automations. {proPrice()}/mo.</span>
      </span>
      <span className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
        <StartInfinityButton className="btn btn-sticker btn-sm min-h-[44px] md:min-h-0" included includedClassName="!text-white hover:!text-white" />
        <Link href="/studio/infinity#referrals" className="sticker-badge !rotate-0 !text-[13px] no-underline">Or share, get 2 months free</Link>
      </span>
    </div>
  );
}
