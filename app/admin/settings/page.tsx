import type { Metadata } from "next";
import Link from "next/link";
import { adminRoleOrRedirect } from "../_components/gate";
import { REFUND_POLICY_LABEL, refundPolicy } from "@/lib/refundPolicy";
import { testStart } from "@/lib/adminSettings";
import RefundPolicyForm from "./RefundPolicyForm";
import { PageHead } from "../_components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

/** Owner settings: the business decisions that live in config, plus links to the other settings pages. */
export default async function SettingsPage() {
  await adminRoleOrRedirect("/admin/settings", "settings");
  const [refund, start] = await Promise.all([refundPolicy(), testStart()]);
  return (
    <div className="grid max-w-[760px] gap-5">
      <PageHead title="Settings" sub={<>Owner only. Every change is logged in <Link href="/admin/activity" className="font-semibold text-scan">Activity</Link>.</>} />

      <section aria-labelledby="refund-h" className="af-panel grid gap-3 p-4 sm:p-5">
        <div>
          <h2 id="refund-h" className="text-[18px] font-bold">Refunds after a payout</h2>
          <p className="text-[14px] text-ink-2">For a buyer return or chargeback after the artist was paid.</p>
        </div>
        {refund.source === "env" ? (
          <p className="rounded-xl bg-wall p-4 text-[14px]">
            Set by the environment: <b>{REFUND_POLICY_LABEL[refund.policy]}</b>. Change REFUND_PAID_OUT_POLICY there.
          </p>
        ) : (
          <RefundPolicyForm value={refund.policy} />
        )}
        <details className="text-[13px] text-ink-2">
          <summary className="cursor-pointer font-semibold">How refunds work</summary>
          <ul className="mt-1 grid list-disc gap-1 pl-5">
            <li>Refunded before payout: the artist&apos;s share is always taken back.</li>
            <li>Damaged, misprinted or wrong prints: Artfinity always absorbs it.</li>
            <li>The artist terms allow either choice. It applies to refunds from now on.</li>
          </ul>
        </details>
      </section>

      <section aria-labelledby="more-h" className="af-panel grid gap-2 p-4 sm:p-5">
        <h2 id="more-h" className="text-[18px] font-bold">Elsewhere</h2>
        <ul className="grid gap-2 text-[14.5px]">
          <li>
            <Link href="/admin" className="font-semibold text-scan">90-day test start</Link>{" "}
            <span className="text-ink-2">· {start.date ? `${start.date}${start.source === "env" ? " (TEST_START_DATE)" : ""}` : "first paid order"}, set on Home</span>
          </li>
          <li><Link href="/admin/team" className="font-semibold text-scan">Team</Link> <span className="text-ink-2">· who can sign in, and their roles</span></li>
        </ul>
      </section>
    </div>
  );
}
