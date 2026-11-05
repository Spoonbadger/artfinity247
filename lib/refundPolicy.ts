// What happens to the artist's share when a sale is refunded AFTER its month was already paid out. Server only.
//
// BUSINESS DECISION (owner setting, /admin/settings):
//   "absorb"              Artfinity absorbs the refund; the artist keeps the share they were paid. (default)
//   "deduct_next_payout"  the share comes off the artist's next payout as a "Refund adjustment" (lib/refunds.ts,
//                         lib/balance.ts). A payout never goes below $0: the rest carries to the month after.
// It applies only to buyer returns and chargebacks. A damaged print is always absorbed: that's the public promise
// (return policy: "at no cost to you"), and the artist did nothing wrong. Refunds on months NOT yet paid out
// reverse the artist's share for every reason, as before (lib/refunds.ts).
//
// Where it's stored: REFUND_PAID_OUT_POLICY in the environment wins. Otherwise the newest "setting.refund_policy"
// row in the audit log (so saving works on Vercel, whose file system is read-only), then data/admin-settings.json,
// then "absorb".
import { prisma } from "@/lib/prisma";
import { readAdminSettings, writeAdminSettings } from "@/lib/adminSettings";

export const REFUND_POLICIES = ["absorb", "deduct_next_payout"] as const;
export type RefundPaidOutPolicy = (typeof REFUND_POLICIES)[number];
export const isRefundPolicy = (v: unknown): v is RefundPaidOutPolicy => typeof v === "string" && (REFUND_POLICIES as readonly string[]).includes(v);

export const REFUND_POLICY_LABEL: Record<RefundPaidOutPolicy, string> = {
  absorb: "Artfinity absorbs it (the artist keeps what they were paid)",
  deduct_next_payout: "Take it off the artist's next payout",
};

export const REFUND_REASONS = ["damaged", "buyer_return", "chargeback", "other"] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];
export const isRefundReason = (v: unknown): v is RefundReason => typeof v === "string" && (REFUND_REASONS as readonly string[]).includes(v);
export const REFUND_REASON_LABEL: Record<RefundReason, string> = {
  damaged: "Damaged, misprinted or wrong print",
  buyer_return: "Buyer return",
  chargeback: "Chargeback",
  other: "Other",
};

/** Reasons the paid-out policy applies to. Everything else is absorbed once paid out. */
export const POLICY_REASONS: readonly RefundReason[] = ["buyer_return", "chargeback"];

export const REFUND_POLICY_ACTION = "setting.refund_policy";

export type PolicySource = "env" | "saved" | "file" | "default";

export async function refundPolicy(): Promise<{ policy: RefundPaidOutPolicy; source: PolicySource }> {
  const env = process.env.REFUND_PAID_OUT_POLICY?.trim();
  if (isRefundPolicy(env)) return { policy: env, source: "env" };
  const row = await prisma.adminAction
    .findFirst({ where: { action: REFUND_POLICY_ACTION }, orderBy: { createdAt: "desc" }, select: { details: true } })
    .catch(() => null);
  const saved = (row?.details as { to?: unknown } | null)?.to;
  if (isRefundPolicy(saved)) return { policy: saved, source: "saved" };
  const file = (await readAdminSettings()).refundPaidOutPolicy;
  if (isRefundPolicy(file)) return { policy: file, source: "file" };
  return { policy: "absorb", source: "default" };
}

/** Keeps the settings file in step where it's writable (local). The audit row written by the caller is the record. */
export async function mirrorPolicyToFile(policy: RefundPaidOutPolicy) {
  await writeAdminSettings({ refundPaidOutPolicy: policy }).catch(() => null);
}

/**
 * What a refund does to the artist's share. `monthPaid`: the line's payout month was already paid when refunded.
 *   reverse  share taken back (month not paid yet)
 *   deduct   paid out, policy says take it off the next payout (buyer return or chargeback)
 *   absorb   paid out, Artfinity absorbs it
 */
export function refundEffect(args: { monthPaid: boolean; reason: RefundReason; policy: RefundPaidOutPolicy }): "reverse" | "deduct" | "absorb" {
  if (!args.monthPaid) return "reverse";
  if (args.policy === "deduct_next_payout" && POLICY_REASONS.includes(args.reason)) return "deduct";
  return "absorb";
}
