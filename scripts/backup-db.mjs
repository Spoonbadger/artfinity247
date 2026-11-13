#!/usr/bin/env node
// Secondary database backup: a pg_dump of the database to a timestamped file, optionally uploaded to S3-compatible
// storage (AWS S3, Cloudflare R2, Backblaze B2, ...). Neon's point-in-time restore is the main backup (DEPLOY.md →
// Backups and restoring); this is the copy you keep yourself, outside Neon.
//
//   pnpm db:backup                       → ./backups/artfinity-2026-11-05T14-03-00Z.dump
//   node scripts/backup-db.mjs --out /some/dir
//
// Env (read from the environment, then .env if present):
//   BACKUP_DATABASE_URL  optional: the database to dump. Defaults to DIRECT_URL, then DATABASE_URL.
//                        On Neon use the DIRECT (non-pooled) connection string: pg_dump doesn't work through the pooler.
//   BACKUP_DIR           optional: output folder (default ./backups, ignored by git). --out wins.
//   BACKUP_KEEP          optional: keep only the newest N local dumps (default 14, 0 keeps all).
//   S3 upload (all optional; uploads only when BACKUP_S3_BUCKET is set):
//   BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY,
//   BACKUP_S3_REGION     (default us-east-1; "auto" for R2),
//   BACKUP_S3_ENDPOINT   (e.g. https://<account>.r2.cloudflarestorage.com; default AWS S3 for the region),
//   BACKUP_S3_PREFIX     (default "artfinity-backups/").
//
// Needs pg_dump on the PATH, the same major version as the server or newer (Neon: 16 or 17).
// The dump is pg_dump's custom format (-Fc, compressed). Restore with pg_restore: see DEPLOY.md.
import { spawn } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

function loadDotEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    process.env[m[1]] = v;
  }
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

/** Prisma-only URL options (schema, pgbouncer, connection_limit, ...) make pg_dump fail: drop them. */
function pgUrl(raw) {
  const u = new URL(raw);
  for (const k of ["schema", "pgbouncer", "connection_limit", "pool_timeout", "socket_timeout", "statement_cache_size"]) u.searchParams.delete(k);
  return { url: u.toString(), schema: new URL(raw).searchParams.get("schema") };
}

const redact = (s) => s.replace(/\/\/([^:/@]+):[^@]*@/, "//$1:***@");
const stamp = () => new Date().toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "pipe"], env: { ...process.env, ...env } });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(e.code === "ENOENT" ? new Error(`${cmd} not found. Install the PostgreSQL client tools (pg_dump), version 16 or newer.`) : e));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}: ${redact(err.trim()).slice(0, 1000)}`))));
  });
}

// ---- S3-compatible upload (AWS Signature V4, one PUT; fine for dumps up to 5 GB) ----
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
const encodeKey = (k) => k.split("/").map(encodeURIComponent).join("/");

async function uploadS3(file) {
  const bucket = process.env.BACKUP_S3_BUCKET;
  const accessKey = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) throw new Error("BACKUP_S3_BUCKET is set but BACKUP_S3_ACCESS_KEY_ID / BACKUP_S3_SECRET_ACCESS_KEY are missing.");
  const region = process.env.BACKUP_S3_REGION || "us-east-1";
  const endpoint = (process.env.BACKUP_S3_ENDPOINT || `https://s3.${region}.amazonaws.com`).replace(/\/+$/, "");
  const prefix = process.env.BACKUP_S3_PREFIX ?? "artfinity-backups/";
  const key = `${prefix}${path.basename(file)}`;
  const body = await fsp.readFile(file);
  const url = new URL(`${endpoint}/${bucket}/${encodeKey(key)}`); // path-style works on S3, R2, B2 and MinIO

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const headers = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const signed = Object.keys(headers).sort();
  const canonical = ["PUT", url.pathname, "", ...signed.map((h) => `${h}:${headers[h]}`), "", signed.join(";"), payloadHash].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, authorization: auth, "content-type": "application/octet-stream", "content-length": String(body.length) },
    body,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${(await res.text()).slice(0, 500)}`);
  return `${bucket}/${key}`;
}

async function prune(dir, keep) {
  if (!keep) return [];
  const files = (await fsp.readdir(dir)).filter((f) => /^artfinity-.*\.dump$/.test(f)).sort().reverse();
  const old = files.slice(keep);
  for (const f of old) await fsp.rm(path.join(dir, f), { force: true });
  return old;
}

async function main() {
  loadDotEnv();
  const raw = process.env.BACKUP_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!raw) throw new Error("Set DATABASE_URL (or BACKUP_DATABASE_URL / DIRECT_URL).");
  const { url, schema } = pgUrl(raw);
  if (/-pooler\./.test(new URL(url).hostname)) {
    console.warn("Note: this looks like a Neon pooled URL. If pg_dump fails, use the direct one (no -pooler in the host) in BACKUP_DATABASE_URL.");
  }
  const dir = path.resolve(arg("out") || process.env.BACKUP_DIR || "backups");
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, `artfinity-${stamp()}.dump`);

  console.log(`Dumping ${redact(url)} → ${file}`);
  const started = Date.now();
  await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", ...(schema ? ["--schema", schema] : []), "--file", file, url]);
  const { size } = await fsp.stat(file);
  if (size === 0) throw new Error("pg_dump wrote an empty file.");
  console.log(`Done: ${(size / 1024 / 1024).toFixed(2)} MB in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  if (process.env.BACKUP_S3_BUCKET) {
    const where = await uploadS3(file);
    console.log(`Uploaded to ${where}`);
  }
  const removed = await prune(dir, Number(process.env.BACKUP_KEEP ?? 14));
  if (removed.length) console.log(`Removed ${removed.length} older local dump(s).`);
}

main().catch((err) => {
  console.error(`Backup failed: ${err.message}`);
  process.exit(1);
});
