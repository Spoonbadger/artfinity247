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
        <p className="text-[17px] text-ink-2">
          Track every print you&apos;ve bought, the artists you follow and your wishlist{rewards.enabled ? `, and earn ${rewards.pct}% off every ${rewards.every}th print` : ""}. Enter the email you used at checkout and we&apos;ll send a link. No password.
        </p>
      </div>
      {searchParams.deleted && <p role="status" className="rounded-xl bg-wall px-4 py-3 text-[15px]">Your collection was deleted. Your order emails and their links still work.</p>}
      <SignInForm next={next} defaultEmail={email} />
      <p className="text-[14px] text-ink-2">
        You never need an account to buy: checkout works as a guest, and the links in your order emails always work. <Link href="/help/buyers/orders-and-wishlist" className="font-semibold text-ink underline underline-offset-4">How it works</Link>
      </p>
    </div>
  );
}
