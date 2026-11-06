import type { Metadata } from "next";
import { adminRoleOrRedirect } from "../../_components/gate";
import { rewardSettings } from "@/lib/collectorRewards";
import RewardsForm from "./RewardsForm";
import { PageHead } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collector rewards" };

export default async function RewardsSettingsPage() {
  await adminRoleOrRedirect("/admin/settings/rewards");
  const s = await rewardSettings();
  return (
    <div className="grid max-w-[720px] gap-5">
      <PageHead level={2} title="Collector rewards" sub="Every Nth print, the buyer gets a one-time discount code.">
        <details className="t-small">
          <summary className="cursor-pointer font-semibold">How it works</summary>
          <ul className="mt-1 grid list-disc gap-1 pl-5">
            <li>For buyers with a free collection. The code fills in at checkout when they&apos;re signed in.</li>
            <li>It comes out of Artfinity&apos;s share only. The artist is paid on the full price.</li>
            <li>Off by default. When off, buyers see nothing about rewards.</li>
          </ul>
        </details>
      </PageHead>
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
