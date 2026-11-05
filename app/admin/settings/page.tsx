import type { Metadata } from "next";
import Link from "next/link";
import { adminRoleOrRedirect } from "../_components/gate";
import { REFUND_POLICY_LABEL, refundPolicy } from "@/lib/refundPolicy";
import { testStart } from "@/lib/adminSettings";
import RefundPolicyForm from "./RefundPolicyForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

/** Owner settings: the business decisions that live in config, plus links to the other settings pages. */
export default async function SettingsPage() {
  await adminRoleOrRedirect("/admin/settings", "settings");
  const [refund, start] = await Promise.all([refundPolicy(), testStart()]);
  return (
    <div className="grid max-w-[760px] gap-6">
      <div>
        <p className="eyebrow">Owner only</p>
        <h1 className="display text-[44px] sm:text-[56px]">Settings</h1>
        <p className="text-[14px] text-ink-2">Business rules for the whole site. Every change is recorded in <Link href="/admin/activity" className="font-semibold text-scan">Activity</Link>.</p>
      </div>

      <section aria-labelledby="refund-h" className="af-card grid gap-3 p-4 sm:p-5">
        <div>
          <h2 id="refund-h" className="text-[20px] font-bold">Refunds after a payout</h2>
          <p className="text-[14px] text-ink-2">
            When a sale is refunded <b className="text-ink">before</b> its month is paid out, the artist&apos;s share is always taken back. This decides what happens when it&apos;s
            refunded <b className="text-ink">after</b> the artist was paid, for a <b className="text-ink">buyer return</b> or <b className="text-ink">chargeback</b>.
            A damaged, misprinted or wrong print is always absorbed by Artfinity, whatever this says: that&apos;s our promise to buyers and artists.
          </p>
        </div>
        {refund.source === "env" ? (
          <p className="rounded-xl bg-wall p-4 text-[14px]">
            Set by the environment: <b>{REFUND_POLICY_LABEL[refund.policy]}</b>. Change REFUND_PAID_OUT_POLICY there.
          </p>
        ) : (
          <RefundPolicyForm value={refund.policy} />
        )}
        <p className="text-[12.5px] text-ink-2">The artist terms say we may do either, so switching doesn&apos;t need new terms. It applies to refunds recorded from now on.</p>
      </section>

      <section aria-labelledby="more-h" className="af-card grid gap-2 p-4 sm:p-5">
        <h2 id="more-h" className="text-[20px] font-bold">More settings</h2>
        <ul className="grid gap-2 text-[14.5px]">
          <li><Link href="/admin/settings/notifications" className="font-semibold text-scan">Alert emails</Link> <span className="text-ink-2">· what gets emailed to you, and when</span></li>
          <li><Link href="/admin/settings/rewards" className="font-semibold text-scan">Collector rewards</Link> <span className="text-ink-2">· the repeat-buyer discount</span></li>
          <li><Link href="/admin/settings/code-prints" className="font-semibold text-scan">Code print prices</Link> <span className="text-ink-2">· what artists pay for printed, laminated codes we mail (at cost)</span></li>
          <li>
            <Link href="/admin" className="font-semibold text-scan">90-day test start</Link>{" "}
            <span className="text-ink-2">· {start.date ? `starts ${start.date}${start.source === "env" ? " (TEST_START_DATE)" : ""}` : "starts at the first paid order"}, set on the dashboard</span>
          </li>
          <li><Link href="/admin/team" className="font-semibold text-scan">Team</Link> <span className="text-ink-2">· who can sign in to the admin, and their roles</span></li>
        </ul>
      </section>
    </div>
  );
}
