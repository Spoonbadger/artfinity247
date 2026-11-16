import { test } from "node:test";
import assert from "node:assert/strict";
import { hostOf, migrateUrl } from "./migrateUrl.mjs";

const POOLED = "postgresql://u:p@ep-odd-darkness-123-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true";

test("DIRECT_URL wins when set", () => {
  const direct = "postgresql://u:p@ep-odd-darkness-123.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
  assert.equal(migrateUrl({ DIRECT_URL: direct, DATABASE_URL: POOLED }), direct);
});

test("without DIRECT_URL, the pooled host becomes the direct host and pgbouncer is dropped", () => {
  const out = migrateUrl({ DATABASE_URL: POOLED });
  assert.equal(hostOf(out), "ep-odd-darkness-123.c-2.us-east-1.aws.neon.tech");
  assert.ok(out.includes("sslmode=require"));
  assert.ok(!out.includes("pgbouncer"));
  assert.ok(out.startsWith("postgresql://u:p@"));
});

test("a DIRECT_URL pasted with pooling on is fixed too", () => {
  assert.equal(hostOf(migrateUrl({ DIRECT_URL: POOLED })), "ep-odd-darkness-123.c-2.us-east-1.aws.neon.tech");
});

test("non-Neon and local URLs pass through", () => {
  assert.equal(migrateUrl({ DATABASE_URL: "postgresql://postgres:postgres@localhost:54329/artfinity" }), "postgresql://postgres:postgres@localhost:54329/artfinity");
});

test("nothing set gives null; the log never shows credentials", () => {
  assert.equal(migrateUrl({}), null);
  assert.equal(hostOf(POOLED), "ep-odd-darkness-123-pooler.c-2.us-east-1.aws.neon.tech");
});
