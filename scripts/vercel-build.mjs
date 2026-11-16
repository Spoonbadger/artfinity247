#!/usr/bin/env node
// Vercel build (vercel.json "buildCommand"): apply database migrations over Neon's direct connection, then build.
// See lib/migrateUrl.mjs for why migrations must not go through the pooler. Before each try, a migration lock left
// behind by an earlier deploy (an idle session that has held it for over two minutes) is released. A failed
// migration is retried twice (a sleeping Neon branch usually wakes within seconds), then the build stops.
import { spawnSync } from "node:child_process";
import { hostOf, migrateUrl, STALE_LOCK_SQL } from "../lib/migrateUrl.mjs";

const bin = (name) => `node_modules/.bin/${name}`;
const run = (cmd, args, env = process.env) => spawnSync(cmd, args, { stdio: "inherit", env }).status === 0;
/** Ends idle sessions still holding Prisma's migration lock. Best effort: a failure here only gets logged. */
function releaseStaleLock(url) {
  const r = spawnSync(bin("prisma"), ["db", "execute", "--stdin", "--url", url], { input: STALE_LOCK_SQL, encoding: "utf8" });
  if (r.status !== 0) console.log("Couldn't check for a stale migration lock (continuing).");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const url = migrateUrl(process.env);
if (!url) {
  console.error("No DATABASE_URL or DIRECT_URL set: can't apply migrations. Add them in Vercel → Settings → Environment Variables.");
  process.exit(1);
}
console.log(`Applying migrations over ${hostOf(url)}${process.env.DIRECT_URL ? "" : " (direct host derived from DATABASE_URL; set DIRECT_URL to choose it)"}`);

let migrated = false;
for (const wait of [0, 5000, 15000]) {
  if (wait) {
    console.log(`Migration failed; trying again in ${wait / 1000}s…`);
    await sleep(wait);
  }
  releaseStaleLock(url);
  if ((migrated = run(bin("prisma"), ["migrate", "deploy"], { ...process.env, DATABASE_URL: url }))) break;
}
if (!migrated) {
  console.error("Migrations failed three times. The live site keeps its last deploy. See DEPLOY.md → Troubleshooting.");
  process.exit(1);
}

process.exit(run(bin("next"), ["build"]) ? 0 : 1);
