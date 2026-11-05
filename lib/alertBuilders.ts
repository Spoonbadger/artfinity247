// Titles, keys and severities for each admin alert, shared by the code that raises an alert as it happens and the
// sweep (lib/alertSweep.ts) that backfills and resolves them. No imports beyond lib/alerts, so lib code
// (printer, payouts, reprints...) can use it without import cycles.
import { alertKey, type RaiseAlertInput } from "@/lib/alerts";

const orderNo = (orderId: string) => orderId.slice(-8).toUpperCase();
const monthName = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return y && m ? new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : month;
};

export function reportAlert(r: { id: string; reason: string; artworkUrl?: string | null; artwork?: { title: string } | null }): RaiseAlertInput {
  const rights = r.reason === "copyright" || r.reason === "counter";
  const what = r.artwork?.title ? `“${r.artwork.title}”` : r.artworkUrl || "a link";
  const label = r.reason === "copyright" ? "DMCA notice" : r.reason === "counter" ? "DMCA counter-notice" : `Art report (${r.reason})`;
  return { kind: "report", key: alertKey.report(r.id), title: `${label}: ${what}`, link: "/admin/reports", severity: rights ? "urgent" : "normal" };
}
export const duplicateAlert = (artworkId: string, title: string, artist: string): RaiseAlertInput => ({
  kind: "duplicate", key: alertKey.duplicate(artworkId), title: `Possible duplicate: “${title}” by ${artist}`, link: "/admin/moderation", severity: "normal",
});
export const moderationAlert = (artworkId: string, title: string, artist: string): RaiseAlertInput => ({
  kind: "moderation", key: alertKey.moderation(artworkId), title: `To review: “${title}” by ${artist}`, link: "/admin/moderation", severity: "low",
});
export const reviewAlert = (reviewId: string, rating: number, buyer: string): RaiseAlertInput => ({
  kind: "review_flagged", key: alertKey.reviewFlagged(reviewId), title: `${rating}★ review by ${buyer} held for a look`, link: "/admin/reviews", severity: "low",
});
export const verificationAlert = (artistId: string, name: string, requestedAt: Date): RaiseAlertInput => ({
  kind: "verification", key: alertKey.verification(artistId, requestedAt), title: `${name} asked to be verified`, link: "/admin/verification", severity: "low",
});
export const workOrderAlert = (orderId: string, error: string): RaiseAlertInput => ({
  kind: "work_order_failed", key: alertKey.workOrderFailed(orderId), title: `Work order #${orderNo(orderId)} didn't reach the print lab${error ? `: ${error}` : ""}`, link: `/admin/orders/${orderId}`, severity: "normal",
});
export const payoutFailedAlert = (artistId: string, name: string, month: string, reason: string): RaiseAlertInput => ({
  kind: "payout_failed", key: alertKey.payoutFailed(artistId, month), title: `Payout to ${name} for ${monthName(month)} failed${reason ? `: ${reason}` : ""}`, link: "/admin/payouts", severity: "urgent",
});
export const reprintAlert = (requestId: string, orderId: string, reason?: string): RaiseAlertInput => ({
  kind: "reprint", key: alertKey.reprint(requestId), title: `Reprint request on order #${orderNo(orderId)}${reason ? ` (${reason})` : ""}`, link: "/admin/reprints", severity: "normal",
});
