import CheckoutClient from "./CheckoutClient";
import { getCollector } from "@/lib/collector";
import { rewardStatus } from "@/lib/collectorRewards";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Optional collector account: prefill its verified email and offer an earned reward. Guests check out exactly as before.
  const collector = await getCollector().catch(() => null);
  const rewards = collector ? await rewardStatus(collector.email).catch(() => null) : null;
  const reward = rewards?.settings.enabled && rewards.available ? { code: rewards.available.code, pct: rewards.available.pct } : null;
  // Without Stripe keys (localhost) checkout records a paid test order instead of charging.
  return <CheckoutClient testMode={!process.env.STRIPE_SECRET_KEY} collectorEmail={collector?.email ?? null} reward={reward} />;
}
