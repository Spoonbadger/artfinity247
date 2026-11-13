// Sentry in the browser. @sentry/nextjs injects this file into the client bundle (next.config.mjs wraps the config
// only when a DSN is set). Sends nothing without NEXT_PUBLIC_SENTRY_DSN. No session replay: it could record personal data.
import * as Sentry from "@sentry/nextjs";
import { dataCollection, scrubBreadcrumb, scrubEvent, tracesRate } from "@/lib/sentryScrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: tracesRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.02),
    dataCollection: dataCollection(),
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (b) => scrubBreadcrumb(b),
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
