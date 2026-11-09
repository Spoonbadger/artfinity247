// node --experimental-strip-types --test lib/adminCaps.test.mjs
// Who may do what (lib/adminCaps.ts), and which capability each admin API route checks.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cantReason, roleCan } from "./adminCaps.ts";

test("support: orders, reprints, reviews, moderation and viewing; no money, accounts, takedowns or settings", () => {
  for (const c of ["view", "orders", "reprints", "reviews", "moderation", "accountSupport"]) assert.equal(roleCan("support", c), true, c);
  for (const c of ["money", "accounts", "suspend", "takedown", "settings", "team", "deleteAccount", "disconnectOAuth", "admin", "owner"]) {
    assert.equal(roleCan("support", c), false, c);
  }
});

test("admin: everything except owner-only", () => {
  for (const c of ["view", "orders", "money", "accounts", "takedown", "admin"]) assert.equal(roleCan("admin", c), true, c);
  for (const c of ["settings", "team", "deleteAccount", "disconnectOAuth", "owner"]) assert.equal(roleCan("admin", c), false, c);
});

test("owner: everything; no role: nothing", () => {
  for (const c of ["money", "settings", "team", "owner"]) assert.equal(roleCan("owner", c), true, c);
  assert.equal(roleCan(null, "view"), false);
  assert.equal(roleCan(undefined, "view"), false);
});

test("reasons", () => {
  assert.equal(cantReason("money"), "Needs the admin or owner role.");
  assert.equal(cantReason("settings"), "Only an owner can do this.");
});

// Source checks: every admin API route goes through adminRoleGuard / requireAdminRole, and the money ones need "money".
const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : f === "route.ts" ? [p] : [];
});

test("no admin API route uses the old any-admin checks", () => {
  const offenders = walk(join(root, "app/api"))
    .filter((p) => /\b(getAdmin|adminGuard)\b|\brequireAdmin\(/.test(readFileSync(p, "utf8")))
    .map((p) => p.slice(root.length));
  assert.deepEqual(offenders, []);
});

test("every route under app/api/admin checks a role (except accepting an invite)", () => {
  const missing = walk(join(root, "app/api/admin"))
    .filter((p) => !p.includes("/invite/"))
    .filter((p) => !/\b(adminRoleGuard|requireAdminRole|currentAdmin)\b/.test(readFileSync(p, "utf8")))
    .map((p) => p.slice(root.length));
  assert.deepEqual(missing, []);
});

const EXPECT = {
  "app/api/admin/payouts/pay-all/route.ts": ['adminRoleGuard("money")'],
  "app/api/admin/payouts/route.ts": ['adminRoleGuard("money")'],
  "app/api/admin/orders/[id]/route.ts": ['adminRoleGuard("orders")', 'adminRoleGuard("money")'],
  "app/api/admin/reprints/[id]/route.ts": ['adminRoleGuard("reprints")', 'adminRoleGuard("money")'],
  "app/api/admin/artworks/[id]/route.ts": ['adminRoleGuard("moderation")', 'adminRoleGuard("money")'],
  "app/api/admin/artists/export/route.ts": ['adminRoleGuard("accounts")'],
  "app/api/admin/moderation/artworks/[id]/route.ts": ['adminRoleGuard("moderation")', 'adminRoleGuard("takedown")'],
  "app/api/admin/scenes/build/route.ts": ['adminRoleGuard("admin")'],
  "app/api/admin/scenes/annotation/route.ts": ['adminRoleGuard("admin")'],
};

test("money and other admin-only routes check the right capability", () => {
  for (const [file, needles] of Object.entries(EXPECT)) {
    const src = read(file);
    for (const n of needles) assert.ok(src.includes(n), `${file} should call ${n}`);
  }
});
