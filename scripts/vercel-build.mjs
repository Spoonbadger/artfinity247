#!/usr/bin/env node
// Vercel build (vercel.json "buildCommand"): apply database migrations over Neon's direct connection, then build.
// See lib/migrateUrl.mjs for why migrations must not go through the pooler. A failed migration is retried twice
// (a sleeping Neon branch or a lock still being released usually clears within seconds), then the build stops.
import { spawnSync } from "node:child_process";
import { hostOf, migrateUrl } from "../lib/migrateUrl.mjs";

const bin = (name) => `node_modules/.bin/${name}`;
const run = (cmd, args, env = process.env) => spawnSync(cmd, args, { stdio: "inherit", env }).status === 0;
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
  if ((migrated = run(bin("prisma"), ["migrate", "deploy"], { ...process.env, DATABASE_URL: url }))) break;
}
if (!migrated) {
  console.error("Migrations failed three times. The live site keeps its last deploy. See DEPLOY.md → Troubleshooting.");
  process.exit(1);
}

process.exit(run(bin("next"), ["build"]) ? 0 : 1);
