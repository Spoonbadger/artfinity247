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
  | "print_lab_problem" // Prodigi cancelled an order or reports a problem with it (lib/prodigiSync.ts)
  | "payout_failed" // Stripe transfer failed (urgent)
  | "payout_late" // a connected artist's payout is past due (transfer failed or didn't run; held balances never count)
  | "order_stuck" // paid 24h+ ago, not sent to the printer
  | "order_undelivered" // shipped 10+ days ago, not delivered
  | "job_failed" // a background job (JobRun) failed
  | "webhook_failed" // a Stripe webhook handler errored (lib/monitor.ts); Stripe retries it
  | "payout_insufficient_funds" // Stripe balance too low for the payout run (urgent, lib/jobs/monthly.ts)
  | "billing_failed" // an artist's Infinity subscription payment failed (low, lib/billing.ts)
  | "image_check_failed" // the automatic image check on upload is down (lib/moderation; uploads go through unchecked)
  | "social_post_failed" // an Instagram post for Artfinity's account failed (lib/social/publish.ts)
  | "social_token" // the Instagram token expired or expires within 7 days (lib/social/instagram.ts)
  | "code_print_order" // an artist paid for printed, laminated QR codes to be mailed (lib/codePrints.ts)
  | "scan_booking"; // an artist booked a painting scan (lib/scanning.server.ts)

/** urgent: "always" = every alert of this kind is urgent; "sometimes" = some are (DMCA among reports). */
type KindMeta = { kind: AlertKind; label: string; plural: string; queue: string; money?: boolean; urgent?: "always" | "sometimes"; defaultPref: NotifyPref };

export const ALERT_KINDS: KindMeta[] = [
  { kind: "report", label: "Reports and DMCA notices", plural: "new reports", queue: "/admin/reports", urgent: "sometimes", defaultPref: "digest" },
  { kind: "payout_failed", label: "Payout transfer failures", plural: "failed payouts", queue: "/admin/payouts", money: true, urgent: "always", defaultPref: "instant" },
  { kind: "work_order_failed", label: "Work orders that failed to send", plural: "work orders failed", queue: "/admin/orders?month=all&filter=print", defaultPref: "digest" },
  { kind: "print_lab_problem", label: "Print lab cancelled or flagged an order", plural: "print lab problems", queue: "/admin/orders?month=all&filter=print", urgent: "sometimes", defaultPref: "instant" },
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
  { kind: "webhook_failed", label: "Stripe webhook errors", plural: "webhook errors", queue: "/admin/alerts", urgent: "always", defaultPref: "instant" },
  { kind: "billing_failed", label: "Infinity subscription payments that failed", plural: "failed Infinity payments", queue: "/admin/artists?plan=infinity", money: true, defaultPref: "digest" },
  { kind: "image_check_failed", label: "Automatic image check errors", plural: "image check errors", queue: "/admin", defaultPref: "digest" },
  { kind: "social_post_failed", label: "Instagram posts that failed", plural: "failed Instagram posts", queue: "/admin/social#queue", defaultPref: "digest" },
  { kind: "social_token", label: "Instagram token expiring or expired", plural: "Instagram token warnings", queue: "/admin/social/setup", urgent: "sometimes", defaultPref: "instant" },
  { kind: "code_print_order", label: "New code print orders", plural: "code print orders to print", queue: "/admin/code-orders?status=paid", defaultPref: "instant" },
  { kind: "scan_booking", label: "Painting scan bookings", plural: "scan bookings", queue: "/admin/scanning", defaultPref: "instant" },
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
