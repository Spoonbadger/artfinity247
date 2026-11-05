// Admin alert kinds, labels and default email preferences. Pure and client-safe (lib/alerts.ts raises them).
import type { AdminRole } from "@/lib/adminCaps";

export type AlertSeverity = "urgent" | "normal" | "low";
export type NotifyPref = "instant" | "digest" | "off";
export const NOTIFY_PREFS: NotifyPref[] = ["instant", "digest", "off"];

export type AlertKind =
  | "report" // art report or DMCA notice (DMCA/rights: urgent)
  | "reprint" // buyer asked for a reprint
  | "duplicate" // upload looks like another piece
  | "moderation" // first pieces from a new artist waiting for review
  | "review_flagged" // buyer review held for a look
  | "verification" // artist asked to be verified
  | "work_order_failed" // print lab didn't get the work order
  | "payout_failed" // Stripe transfer failed (urgent)
  | "payout_late" // a month's payout is past due
  | "order_stuck" // paid 24h+ ago, not sent to the printer
  | "order_undelivered" // shipped 10+ days ago, not delivered
  | "job_failed" // a background job (JobRun) failed
  | "payout_insufficient_funds" // Stripe balance too low for the payout run (urgent, lib/jobs/monthly.ts)
  | "billing_failed"; // an artist's Infinity subscription payment failed (low, lib/billing.ts)

/** urgent: "always" = every alert of this kind is urgent; "sometimes" = some are (DMCA among reports). */
type KindMeta = { kind: AlertKind; label: string; plural: string; queue: string; money?: boolean; urgent?: "always" | "sometimes"; defaultPref: NotifyPref };

export const ALERT_KINDS: KindMeta[] = [
  { kind: "report", label: "Reports and DMCA notices", plural: "new reports", queue: "/admin/reports", urgent: "sometimes", defaultPref: "digest" },
  { kind: "payout_failed", label: "Payout transfer failures", plural: "failed payouts", queue: "/admin/payouts", money: true, urgent: "always", defaultPref: "instant" },
  { kind: "work_order_failed", label: "Work orders that failed to send", plural: "work orders failed", queue: "/admin/orders?month=all&filter=print", defaultPref: "digest" },
  { kind: "reprint", label: "Reprint requests", plural: "reprint requests", queue: "/admin/reprints", defaultPref: "digest" },
  { kind: "order_stuck", label: "Orders not sent to the printer after 24h", plural: "orders not sent to the printer", queue: "/admin/orders?month=all&filter=print", defaultPref: "digest" },
  { kind: "order_undelivered", label: "Shipped 10+ days ago, not delivered", plural: "orders not marked delivered", queue: "/admin/orders?month=all&filter=shipped", defaultPref: "digest" },
  { kind: "duplicate", label: "Possible duplicate uploads", plural: "possible duplicates", queue: "/admin/moderation", defaultPref: "digest" },
  { kind: "moderation", label: "First pieces waiting for review", plural: "pieces to review", queue: "/admin/moderation", defaultPref: "digest" },
  { kind: "review_flagged", label: "Reviews held for a look", plural: "reviews held", queue: "/admin/reviews", defaultPref: "digest" },
  { kind: "verification", label: "Verification requests", plural: "verification requests", queue: "/admin/verification", defaultPref: "digest" },
  { kind: "payout_insufficient_funds", label: "Stripe balance too low for payouts", plural: "payout runs short of funds", queue: "/admin/payouts", money: true, urgent: "always", defaultPref: "instant" },
  { kind: "payout_late", label: "Late payouts", plural: "late payouts", queue: "/admin/payouts", money: true, defaultPref: "digest" },
  { kind: "job_failed", label: "Background job failures", plural: "failed jobs", queue: "/admin/alerts", urgent: "sometimes", defaultPref: "digest" },
  { kind: "billing_failed", label: "Infinity subscription payments that failed", plural: "failed Infinity payments", queue: "/admin/artists?plan=infinity", money: true, defaultPref: "digest" },
];

const META = new Map(ALERT_KINDS.map((k) => [k.kind as string, k]));
export const kindMeta = (kind: string): KindMeta =>
  META.get(kind) ?? { kind: kind as AlertKind, label: kind.replace(/_/g, " "), plural: kind.replace(/_/g, " "), queue: "/admin/alerts", defaultPref: "digest" };

export type NotifyPrefs = Partial<Record<string, NotifyPref>>;

/** Artist.adminNotify JSON → { kind: pref }, dropping anything unknown. */
export function parseNotifyPrefs(raw: unknown): NotifyPrefs {
  const out: NotifyPrefs = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && (NOTIFY_PREFS as string[]).includes(v)) out[k] = v as NotifyPref;
  }
  return out;
}

/** The default for an admin who hasn't chosen. Support doesn't get money alerts it can't act on. */
export function defaultPref(kind: string, role: AdminRole, severity?: AlertSeverity): NotifyPref {
  const m = kindMeta(kind);
  if (m.money && role === "support") return "off";
  if (severity === "urgent") return "instant";
  return m.defaultPref;
}

/** What this admin wants for an alert of `kind` (their choice, else the default). */
export function effectivePref(prefs: NotifyPrefs, kind: string, role: AdminRole, severity?: AlertSeverity): NotifyPref {
  return prefs[kind] ?? defaultPref(kind, role, severity);
}

/** Plain words for the default, for the settings page. */
export function defaultLabel(kind: string, role: AdminRole): string {
  const m = kindMeta(kind);
  const d = defaultPref(kind, role);
  if (d === "off") return "Off (support can't act on these)";
  if (m.urgent === "sometimes" && d === "digest") return "Urgent ones right away, the rest in the digest";
  return d === "instant" ? "Right away" : "Daily digest";
}
