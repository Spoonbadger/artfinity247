// Unit checks for the security-critical pure parts of social sign-in. No test runner needed:
//   node --test lib/oauth/oauth.test.mjs        (Node 22.18+ strips the TypeScript types itself;
//                                              on older Node add --experimental-strip-types)
// Covers: ID-token verification (signature, issuer, audience, expiry, iat, nonce, alg) with locally generated
// keys, and the guard that keeps the mock provider out of production.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";

// Computed paths keep TypeScript/Next from trying to resolve ".ts" imports in this plain-JS file.
const here = (f) => new URL(f, import.meta.url).href;
const { verifyIdToken, claimTrue } = await import(here("./idToken" + ".ts"));
const { mockOAuthAllowed } = await import(here("./mockGuard" + ".ts"));

const ISS = "https://accounts.google.com";
const AUD = "client-123.apps.googleusercontent.com";
const NONCE = "n-0S6_WzA2Mj";

const good = await generateKeyPair("RS256");
const evil = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(good.publicKey)), kid: "k1", alg: "RS256" };
const keys = createLocalJWKSet({ keys: [jwk] });

async function token(claims = {}, opts = {}) {
  const t = new SignJWT({ nonce: NONCE, email: "maya@example.com", email_verified: true, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: opts.kid ?? "k1" })
    .setIssuer(opts.iss ?? ISS)
    .setAudience(opts.aud ?? AUD)
    .setSubject(opts.sub ?? "10769150350006150715113082367")
    .setIssuedAt(opts.iat ?? Math.floor(Date.now() / 1000))
    .setExpirationTime(opts.exp ?? "5m");
  return t.sign(opts.key ?? good.privateKey);
}
const check = (o = {}) => ({ keys, issuer: [ISS, "accounts.google.com"], audience: AUD, nonce: NONCE, ...o });

test("accepts a valid token and returns its claims", async () => {
  const c = await verifyIdToken(await token(), check());
  assert.equal(c.sub, "10769150350006150715113082367");
  assert.equal(c.email, "maya@example.com");
  assert.equal(claimTrue(c.email_verified), true);
});

test("accepts Google's second issuer spelling", async () => {
  await verifyIdToken(await token({}, { iss: "accounts.google.com" }), check());
});

const rejects = (name, make, o, code = "invalid_id_token") =>
  test(`rejects ${name}`, async () => {
    await assert.rejects(verifyIdToken(await make(), check(o)), (e) => e.code === code);
  });

rejects("a token signed by another key", () => token({}, { key: evil.privateKey }));
rejects("the wrong issuer", () => token({}, { iss: "https://evil.example" }));
rejects("the wrong audience", () => token({}, { aud: "someone-elses-client" }));
rejects("an expired token", () => token({}, { iat: Math.floor(Date.now() / 1000) - 7200, exp: Math.floor(Date.now() / 1000) - 3600 }));
rejects("a token issued in the future", () => token({}, { iat: Math.floor(Date.now() / 1000) + 3600, exp: Math.floor(Date.now() / 1000) + 7200 }));
rejects("a token issued more than a day ago", () => token({}, { iat: Math.floor(Date.now() / 1000) - 2 * 86400, exp: Math.floor(Date.now() / 1000) + 600 }));
rejects("a different nonce (replay)", () => token({ nonce: "someone-else" }), {}, "nonce_mismatch");
rejects("a missing nonce", () => token({ nonce: undefined }), {}, "nonce_mismatch");
rejects("an unknown key id", () => token({}, { kid: "nope" }));
rejects("garbage", async () => "not.a.jwt");

test("rejects alg=none and HS256 tokens", async () => {
  const none = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ iss: ISS, aud: AUD, sub: "x", nonce: NONCE, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 })).toString("base64url") + ".";
  await assert.rejects(verifyIdToken(none, check()), (e) => e.code === "invalid_id_token");
  const hs = await new SignJWT({ nonce: NONCE }).setProtectedHeader({ alg: "HS256" }).setIssuer(ISS).setAudience(AUD).setSubject("x").setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode("k".repeat(32)));
  await assert.rejects(verifyIdToken(hs, check()), (e) => e.code === "invalid_id_token");
});

test("refuses to verify without an expected nonce", async () => {
  await assert.rejects(verifyIdToken(await token(), check({ nonce: "" })), (e) => e.code === "missing_nonce");
});

test("email_verified: only true or \"true\" count", () => {
  assert.equal(claimTrue("true"), true);
  assert.equal(claimTrue(true), true);
  for (const v of [false, "false", 1, "1", undefined, null, "yes"]) assert.equal(claimTrue(v), false);
});

test("mock provider is never allowed in production", () => {
  assert.equal(mockOAuthAllowed({ NODE_ENV: "production", ALLOW_MOCK_OAUTH: "1" }), false);
  assert.equal(mockOAuthAllowed({ NODE_ENV: "production", ALLOW_TEST_CHECKOUT: "1" }), false);
  assert.equal(mockOAuthAllowed({ NODE_ENV: "production", ALLOW_MOCK_OAUTH: "1", ALLOW_TEST_CHECKOUT: "1" }), false);
});

test("mock provider needs an explicit opt-in outside production", () => {
  assert.equal(mockOAuthAllowed({ NODE_ENV: "development" }), false);
  assert.equal(mockOAuthAllowed({ NODE_ENV: "development", ALLOW_MOCK_OAUTH: "true" }), false);
  assert.equal(mockOAuthAllowed({ NODE_ENV: "development", ALLOW_MOCK_OAUTH: "1" }), true);
  assert.equal(mockOAuthAllowed({ NODE_ENV: "test", ALLOW_TEST_CHECKOUT: "1" }), true);
  assert.equal(mockOAuthAllowed({}), false);
});
