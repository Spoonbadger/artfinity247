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
