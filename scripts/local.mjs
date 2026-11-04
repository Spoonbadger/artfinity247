// One command to run Artfinity on your computer: `pnpm local`
// Starts a built-in Postgres (no Docker needed), sets up the database and demo data the first time,
// then runs the site at http://localhost:3000. Ctrl+C stops everything.
import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import EmbeddedPostgres from "embedded-postgres";

const root = process.cwd();
const dataDir = path.join(root, ".localdb");
const PORT = 54329;
const DB_URL = `postgresql://artfinity:artfinity@localhost:${PORT}/artfinity`;
const firstRun = !fs.existsSync(path.join(dataDir, "PG_VERSION"));

// .env: create it from the example on first run, and point it at the built-in database
const envPath = path.join(root, ".env");
if (!fs.existsSync(envPath)) fs.copyFileSync(path.join(root, ".env.example"), envPath);
let env = fs.readFileSync(envPath, "utf8");
if (!env.includes(DB_URL)) {
  env = /^DATABASE_URL=.*$/m.test(env) ? env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${DB_URL}"`) : `DATABASE_URL="${DB_URL}"\n${env}`;
  fs.writeFileSync(envPath, env);
}

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "artfinity", password: "artfinity", port: PORT, persistent: true, onLog: () => {} });
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, DATABASE_URL: DB_URL } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
};

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  try { await pg.stop(); } catch {}
  process.exit(code);
}

try {
  if (firstRun) { console.log("Setting up the local database (first run only)…"); await pg.initialise(); }
  await pg.start();
  if (firstRun) await pg.createDatabase("artfinity");
  run("npx", ["prisma", "migrate", "deploy"]);
  if (firstRun) { console.log("Loading demo artists, artworks and orders…"); run("node", ["--env-file=.env", "prisma/seed.mjs"]); }
} catch (e) {
  console.error("\nCould not start the local database:", e?.message || e);
  console.error("If it says the port is busy, an earlier run may still be open. Close it, or restart your computer, then try again.");
  await stop(1);
}

console.log(`\nArtfinity is starting at http://localhost:${process.env.PORT || 3000}`);
console.log(`Log in as maya@artfinity.local (artist) or admin@artfinity.local (admin), password artfinity123.\n`);
const webPort = process.env.PORT || "3000";
const next = spawn("npx", ["next", "dev", "-p", webPort], { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, DATABASE_URL: DB_URL } });
next.on("exit", (code) => stop(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { next.kill(sig); stop(0); });
