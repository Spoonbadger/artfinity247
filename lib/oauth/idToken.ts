// OpenID Connect ID-token checks (Google, Apple, and the dev mock).
// Only imports `jose`, so the unit check (lib/oauth/oauth.test.mjs) can load it with plain Node.
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

export class IdTokenError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

export type IdTokenCheck = {
  /** Where the signing keys come from: a JWKS URL (cached by jose) or a key resolver (tests, mock). */
  keys: JWTVerifyGetKey;
  /** Accepted issuers (Google uses two spellings). */
  issuer: string | string[];
  /** Our client id. */
  audience: string;
  /** The nonce we sent in the authorization request. Required: a token without it is refused. */
  nonce: string;
  /** Allowed signature algorithms. Google and Apple both sign with RS256. */
  algorithms?: string[];
  /** Clock skew allowed on exp/iat, in seconds. */
  clockTolerance?: number;
  /** For tests: "now" in seconds. */
  currentDate?: Date;
};

const jwksCache = new Map<string, JWTVerifyGetKey>();

/** A cached remote JWKS (keys are fetched on first use and refreshed when an unknown kid shows up). */
export function remoteKeys(url: string): JWTVerifyGetKey {
  let k = jwksCache.get(url);
  if (!k) {
    k = createRemoteJWKSet(new URL(url), { timeoutDuration: 5000, cooldownDuration: 30_000, cacheMaxAge: 6 * 3600_000 });
    jwksCache.set(url, k);
  }
  return k;
}

/**
 * Verifies an ID token's signature, issuer, audience, expiry, issue time and nonce. Returns the claims.
 * Throws IdTokenError on anything off.
 */
export async function verifyIdToken(token: string, check: IdTokenCheck): Promise<JWTPayload & Record<string, unknown>> {
  if (!token || typeof token !== "string") throw new IdTokenError("missing_id_token");
  if (!check.nonce) throw new IdTokenError("missing_nonce", "No nonce to compare against");
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, check.keys, {
      issuer: check.issuer,
      audience: check.audience,
      algorithms: check.algorithms ?? ["RS256"],
      clockTolerance: check.clockTolerance ?? 60,
      requiredClaims: ["sub", "iat", "exp"],
      currentDate: check.currentDate,
    }));
  } catch (e) {
    throw new IdTokenError("invalid_id_token", (e as Error)?.message);
  }
  // An ID token issued long ago is suspicious even if it hasn't expired.
  const now = Math.floor((check.currentDate?.getTime() ?? Date.now()) / 1000);
  if (typeof payload.iat !== "number" || payload.iat > now + (check.clockTolerance ?? 60) || now - payload.iat > 24 * 3600) {
    throw new IdTokenError("invalid_id_token", "Bad iat");
  }
  if (typeof payload.sub !== "string" || !payload.sub) throw new IdTokenError("invalid_id_token", "No sub");
  if (payload.nonce !== check.nonce) throw new IdTokenError("nonce_mismatch");
  return payload as JWTPayload & Record<string, unknown>;
}

/** Providers send email_verified as a boolean (Google) or the string "true" (Apple). */
export function claimTrue(v: unknown): boolean {
  return v === true || v === "true";
}
