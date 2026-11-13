// Checks who activeUserGuard() (lib/auth.ts) lets through. No test runner needed:
//   node --test lib/accountGate.test.mjs      (Node 22.18+ strips the TypeScript types itself;
//                                            on older Node add --experimental-strip-types)
import { test } from "node:test";
import assert from "node:assert/strict";

// Computed path keeps TypeScript/Next from trying to resolve a ".ts" import in this plain-JS file.
const here = (f) => new URL(f, import.meta.url).href;
const { accountState, gateResponse, NOT_SIGNED_IN, SUSPENDED_MESSAGE, CLOSED_MESSAGE } = await import(here("./accountGate" + ".ts"));

const day = new Date("2026-11-01T12:00:00Z");

test("account state from the artist row", () => {
  assert.equal(accountState({ closedAt: null, suspendedAt: null }), "active");
  assert.equal(accountState({ closedAt: null, suspendedAt: day }), "suspended");
  assert.equal(accountState({ closedAt: day, suspendedAt: null }), "closed");
  assert.equal(accountState({ closedAt: day, suspendedAt: day }), "closed", "closed wins over suspended");
});

test("an active account goes through", () => {
  assert.equal(gateResponse("active"), null);
  assert.equal(gateResponse("active", "Log in to upload."), null);
});

test("signed out: 401 with the log-in code, custom message when given", () => {
  assert.deepEqual(gateResponse(null), { status: 401, body: { error: NOT_SIGNED_IN, code: "not_logged_in" } });
  assert.deepEqual(gateResponse(null, "Log in to upload."), { status: 401, body: { error: "Log in to upload.", code: "not_logged_in" } });
  assert.equal(gateResponse(null, "").body.error, NOT_SIGNED_IN);
});

test("suspended: 403 with a plain message and the code the Contact us button keys on", () => {
  const r = gateResponse("suspended", "Log in to upload.");
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { error: SUSPENDED_MESSAGE, code: "account_suspended" });
  assert.match(r.body.error, /paused/);
});

test("closed: 403 account_closed", () => {
  const r = gateResponse("closed");
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { error: CLOSED_MESSAGE, code: "account_closed" });
});

test("unknown states never go through", () => {
  for (const s of [undefined, "", "ACTIVE", "admin"]) assert.notEqual(gateResponse(s), null, String(s));
});
