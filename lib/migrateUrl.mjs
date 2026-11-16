// The connection string for `prisma migrate deploy` on deploy (scripts/vercel-build.mjs).
// Migrations take a Postgres advisory lock. Through Neon's pooler (PgBouncer) that lock can stay held on a pooled
// server connection after the deploy that took it is gone, and the next deploy times out waiting (Prisma P1002).
// So migrations always go to the direct host: DIRECT_URL when set, else the pooled URL with "-pooler" taken out of
// the host name, which is how Neon names the two (ep-x-123-pooler.region.aws.neon.tech -> ep-x-123.region.aws.neon.tech).

/** @param {{ DIRECT_URL?: string, DATABASE_URL?: string }} env */
export function migrateUrl(env) {
  const raw = (env.DIRECT_URL || env.DATABASE_URL || "").trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return raw; // not a URL we understand: hand it to Prisma as is and let it report
  }
  u.hostname = u.hostname.replace(/-pooler\./, ".");
  u.searchParams.delete("pgbouncer"); // only meaningful for the pooler
  return u.toString();
}

/** Host only, for the build log (never the user or password). */
export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(unparsed)";
  }
}

/**
 * Releases Prisma's migration lock (pg_advisory_lock(72707369)) when an idle session has held it for over two
 * minutes: a deploy that died, or a pooled connection that kept it. A migration that is running is "active" and is
 * left alone. The key fits in 32 bits, so it shows in pg_locks as objid with objsubid 1.
 */
export const STALE_LOCK_SQL = `SELECT pg_terminate_backend(l.pid)
FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory' AND l.granted AND l.classid = 0 AND l.objid = 72707369 AND l.objsubid = 1
  AND a.pid <> pg_backend_pid() AND a.state LIKE 'idle%' AND a.state_change < now() - interval '2 minutes';`;
