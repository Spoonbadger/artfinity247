// Next.js instrumentation: starts Sentry on the server and edge runtimes, only when a DSN is set (DEPLOY.md → Sentry).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Server errors in routes and server components (Next 15+ calls this; harmless on 14).
export const onRequestError = Sentry.captureRequestError;
