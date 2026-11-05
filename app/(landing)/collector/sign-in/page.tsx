// /collector/sign-in — email a one-time sign-in link to a buyer's collection. Never needed to buy.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCollector, safeNext } from "@/lib/collector";
import { rewardSettings } from "@/lib/collectorRewards";
import { DabRow } from "@/components/browse/PageHead";
import { BrushStroke } from "@/components/af/Brush";
import { SignInForm } from "@/components/collector/CollectorActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your orders", description: "See your Artfinity orders, followed artists and wishlist. No password: we email you a link." };

export default async function CollectorSignIn({ searchParams }: { searchParams: { next?: string; email?: string; deleted?: string } }) {
  const next = safeNext(searchParams.next);
  if (await getCollector()) redirect(next);
  const rewards = await rewardSettings();
  const email = typeof searchParams.email === "string" ? searchParams.email.slice(0, 200) : "";
  return (
    <div className="mx-auto grid max-w-[520px] gap-6 px-4 pb-16 pt-10 sm:pt-16">
      <div className="grid gap-3">
        <div className="flex items-center gap-2.5"><DabRow /><span className="eyebrow">Your collection</span></div>
        <h1 className="display relative inline-block text-[46px] sm:text-[60px]">
          <span className="relative z-10">See your orders</span>
          <BrushStroke className="absolute -bottom-1 left-0 z-0 h-[0.32em] w-[min(100%,5.5em)] opacity-90" color="var(--af-sticker)" />
        </h1>
        <p className="text-[17px] font-semibold">Optional. You never need an account to buy.</p>
      </div>
      {searchParams.deleted && <p role="status" className="rounded-xl bg-wall px-4 py-3 text-[15px]">Your collection was deleted. Your order emails and their links still work.</p>}
      <SignInForm next={next} defaultEmail={email} />
      <ul className="grid gap-2 text-[15px]">
        <li className="flex items-start gap-2.5"><span className="paint-dab mt-1.5" style={{ ["--dab" as string]: "var(--af-scan)" }} aria-hidden="true" />See where each order is, and keep a wishlist.</li>
        {rewards.enabled && <li className="flex items-start gap-2.5"><span className="paint-dab mt-1.5" style={{ ["--dab" as string]: "var(--af-sticker)" }} aria-hidden="true" />Every {rewards.every}th print earns {rewards.pct}% off your next order.</li>}
        <li className="flex items-start gap-2.5"><span className="paint-dab mt-1.5" style={{ ["--dab" as string]: "var(--af-earned)" }} aria-hidden="true" />Your order emails keep working either way.</li>
      </ul>
      <Link href="/help/buyers/orders-and-wishlist" className="w-fit text-[14px] font-semibold text-ink underline underline-offset-4">How it works</Link>
    </div>
  );
}
