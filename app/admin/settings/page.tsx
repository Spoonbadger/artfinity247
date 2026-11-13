import type { Metadata } from "next";
import Link from "next/link";
import { adminRoleOrRedirect } from "../_components/gate";
import { REFUND_POLICY_LABEL, refundPolicy } from "@/lib/refundPolicy";
import RefundPolicyForm from "./RefundPolicyForm";
import { PageHead } from "../_components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

/** Owner settings: the business decisions that live in config, plus links to the other settings pages. */
export default async function SettingsPage() {
  await adminRoleOrRedirect("/admin/settings", "settings");
  const refund = await refundPolicy();
  return (
    <div className="grid max-w-[760px] gap-5">
      <PageHead level={2} title="General" sub={<>Owner only. Changes are logged in <Link href="/admin/activity" className="font-semibold text-scan">Activity</Link>.</>} />

      <section aria-labelledby="refund-h" className="af-panel grid gap-3 p-4 sm:p-5">
        <div>
          <h2 id="refund-h" className="t-card">Refunds after a payout</h2>
          <p className="t-small">A buyer return or chargeback after the artist was paid.</p>
        </div>
        {refund.source === "env" ? (
          <p className="rounded-xl bg-wall p-4 text-[14px]">
            Set by the environment: <b>{REFUND_POLICY_LABEL[refund.policy]}</b>. Change REFUND_PAID_OUT_POLICY there.
          </p>
        ) : (
          <RefundPolicyForm value={refund.policy} />
        )}
        <details className="t-small">
          <summary className="cursor-pointer font-semibold">How refunds work</summary>
          <ul className="mt-1 grid list-disc gap-1 pl-5">
            <li>Refunded before payout: the artist&apos;s share is always taken back.</li>
            <li>Damaged, misprinted or wrong prints: Artfinity always absorbs it.</li>
            <li>The artist terms allow either choice.</li>
          </ul>
        </details>
      </section>
    </div>
  );
}
