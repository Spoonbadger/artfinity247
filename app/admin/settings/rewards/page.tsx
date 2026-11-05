import type { Metadata } from "next";
import { adminRoleOrRedirect } from "../../_components/gate";
import { rewardSettings } from "@/lib/collectorRewards";
import RewardsForm from "./RewardsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collector rewards" };

export default async function RewardsSettingsPage() {
  await adminRoleOrRedirect("/admin/settings/rewards");
  const s = await rewardSettings();
  return (
    <div className="grid max-w-[720px] gap-5">
      <div>
        <p className="eyebrow">Settings</p>
        <h1 className="display text-[44px] sm:text-[56px]">Collector rewards</h1>
        <p className="text-[14px] text-ink-2">
          A perk for buyers with a free collection: after every Nth print they&apos;re emailed a one-time code for a discount on their next order, filled in at checkout while
          they&apos;re signed in. The discount comes out of Artfinity&apos;s share only: each print&apos;s discount is capped at Artfinity&apos;s share of its profit, and the artist&apos;s
          share is kept at the full price. Off by default. When off, buyers see no reward copy anywhere.
        </p>
      </div>
      {s.source === "env" ? (
        <p className="rounded-xl bg-wall p-4 text-[14px]">
          Set by the environment: <b>{s.enabled ? `on, every ${s.every}th print, ${s.pct}% off` : "off"}</b>. Change COLLECTOR_REWARDS, COLLECTOR_REWARD_EVERY and COLLECTOR_REWARD_PCT there.
        </p>
      ) : (
        <RewardsForm value={{ enabled: s.enabled, every: s.every, pct: s.pct }} />
      )}
    </div>
  );
}
