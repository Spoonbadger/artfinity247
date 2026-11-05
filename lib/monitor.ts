// Error reporting for the things nobody is watching: background jobs and webhooks. Server only.
//
//   reportError(err, { area: "job", name: "payouts" })
//
// - Sentry: captured when SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) is set (sentry.server.config.ts). Otherwise a no-op.
// - ALERT_WEBHOOK_URL (optional): also posts one line to a Slack or Discord incoming webhook, so an alert reaches a
//   phone even without Sentry. Never includes emails or request bodies.
// - adminAlert: true also raises an admin alert (Alerts page + alert emails). Jobs raise their own (lib/jobs/run.ts).
// Never throws.
import * as Sentry from "@sentry/nextjs";
import { raiseAlert } from "@/lib/alerts";

export type MonitorContext = {
  /** "job" | "webhook" | ... : becomes the Sentry tag `area`. */
  area: string;
  /** Job or webhook name, e.g. "payouts", "stripe". */
  name: string;
  /** Safe, non-personal details (ids, event types). */
  extra?: Record<string, unknown>;
  level?: "error" | "warning";
  /** Raise an admin alert too (one open alert per area + name). */
  adminAlert?: boolean;
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
export const sentryEnabled = () => !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);

const messageOf = (err: unknown) => ((err as Error)?.message || String(err)).replace(/\s+/g, " ").replace(EMAIL, "[email]").slice(0, 300);

async function postWebhook(text: string) {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    // Slack reads `text`, Discord reads `content`; each ignores the other.
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) });
  } catch (e) {
    console.error("[monitor] ALERT_WEBHOOK_URL post failed", (e as Error)?.message);
  }
}

export async function reportError(err: unknown, ctx: MonitorContext): Promise<void> {
  const level = ctx.level ?? "error";
  const msg = messageOf(err);
  try {
    if (sentryEnabled()) {
      Sentry.withScope((scope) => {
        scope.setLevel(level);
        scope.setTag("area", ctx.area);
        scope.setTag(ctx.area, ctx.name);
        if (ctx.extra) scope.setExtras(ctx.extra);
        if (err instanceof Error) Sentry.captureException(err);
        else Sentry.captureMessage(`${ctx.area}:${ctx.name}: ${msg}`);
      });
      // Serverless functions can freeze right after the response: give the event a moment to leave.
      await Sentry.flush(2000);
    }
  } catch (e) {
    console.error("[monitor] Sentry capture failed", (e as Error)?.message);
  }
  if (level === "error") {
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "";
    await postWebhook(`⚠️ Artfinity${env && env !== "production" ? ` (${env})` : ""}: ${ctx.area} "${ctx.name}" failed: ${msg}`);
  }
  if (ctx.adminAlert) {
    await raiseAlert({
      kind: `${ctx.area}_failed`,
      key: `${ctx.area}_failed:${ctx.name}`,
      title: `${ctx.area === "webhook" ? "Webhook" : ctx.area} "${ctx.name}" failed: ${msg}`.slice(0, 200),
      link: "/admin/alerts",
      severity: "urgent",
    }).catch(() => null);
  }
}
