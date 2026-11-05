// Sentry on the Node.js server (loaded from instrumentation.ts only when a DSN is set). See DEPLOY.md → Sentry.
import * as Sentry from "@sentry/nextjs";
import { dataCollection, scrubBreadcrumb, scrubEvent, tracesRate } from "@/lib/sentryScrub";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: tracesRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    dataCollection: dataCollection(),
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
    beforeBreadcrumb: (b) => scrubBreadcrumb(b),
  });
}
