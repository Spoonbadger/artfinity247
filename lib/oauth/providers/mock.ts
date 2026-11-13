// DEV-ONLY mock provider for testing every sign-in path without real keys. Never on in production:
// enabled() goes through mockOAuthAllowed() (NODE_ENV !== "production" AND ALLOW_MOCK_OAUTH=1), and the
// authorize route and the callback both check it again.
//
// It behaves like a real OIDC provider: /api/auth/oauth-mock/authorize hands back a code (an HS256 JWT holding
// the chosen profile, the nonce, the PKCE challenge and the redirect URI); the exchange checks PKCE and the
// redirect URI, then mints an RS256 ID token with a throwaway key and runs it through the same verifyIdToken()
// that Google and Apple use (issuer, audience, nonce, expiry).
import { createHash, createHmac } from "crypto";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, type JWK } from "jose";
import { claimTrue, verifyIdToken } from "../idToken";
import { mockOAuthAllowed } from "../mockGuard";
import { str, withQuery } from "./http";
import { ProviderError, type OAuthProvider } from "./types";

export const MOCK_ISSUER = "https://mock-oauth.artfinity.invalid";
export const MOCK_AUDIENCE = "artfinity-mock-client";

const codeKey = () => createHmac("sha256", process.env.JWT_SECRET || "dev").update("artfinity-oauth:mock-code").digest();

export type MockProfile = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string; username?: string };

/** Called by the mock authorize page. */
export async function mockIssueCode(p: MockProfile, nonce: string, challenge: string, redirectUri: string): Promise<string> {
  if (!mockOAuthAllowed()) throw new ProviderError("unavailable");
  return new SignJWT({ typ: "mock-code", p, nonce, challenge, redirectUri })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2m")
    .sign(codeKey());
}

let keys: Promise<{ privateKey: CryptoKey; jwk: JWK }> | null = null;
function mockKeys() {
  keys ??= generateKeyPair("RS256").then(async ({ privateKey, publicKey }) => ({ privateKey, jwk: { ...(await exportJWK(publicKey)), kid: "mock-1", alg: "RS256" } }));
  return keys;
}

export const mock: OAuthProvider = {
  id: "mock",
  pkce: true,
  enabled: () => mockOAuthAllowed(),
  authorizationUrl: ({ state, challenge, nonce, redirectUri }) =>
    withQuery(`${new URL(redirectUri).origin}/api/auth/oauth-mock/authorize`, { state, nonce, code_challenge: challenge, redirect_uri: redirectUri }),
  async exchange({ code, verifier, nonce, redirectUri }) {
    if (!mockOAuthAllowed()) throw new ProviderError("unavailable");
    let c: any;
    try {
      ({ payload: c } = await jwtVerify(code, codeKey(), { algorithms: ["HS256"] }));
    } catch {
      throw new ProviderError("provider_rejected", "bad code");
    }
    if (c.typ !== "mock-code" || c.redirectUri !== redirectUri) throw new ProviderError("provider_rejected", "redirect_uri mismatch");
    const challenge = verifier ? createHash("sha256").update(verifier).digest("base64url") : "";
    if (!verifier || challenge !== c.challenge) throw new ProviderError("provider_rejected", "PKCE mismatch");
    // Mint the ID token the way a real provider would (nonce copied from the authorize request) ...
    const { privateKey, jwk } = await mockKeys();
    const p = c.p as MockProfile;
    const idToken = await new SignJWT({ nonce: c.nonce, email: p.email, email_verified: p.email_verified, name: p.name, picture: p.picture })
      .setProtectedHeader({ alg: "RS256", kid: "mock-1" })
      .setIssuer(MOCK_ISSUER)
      .setAudience(MOCK_AUDIENCE)
      .setSubject(String(p.sub))
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    // ... and verify it like Google's: signature, issuer, audience, expiry, and OUR nonce from the flow cookie.
    const claims = await verifyIdToken(idToken, { keys: createLocalJWKSet({ keys: [jwk] }), issuer: MOCK_ISSUER, audience: MOCK_AUDIENCE, nonce });
    const email = str(claims.email, 254)?.toLowerCase() ?? null;
    const username = str(p.username, 30)?.toLowerCase() ?? null;
    return {
      providerAccountId: String(claims.sub),
      email,
      emailVerified: !!email && claimTrue(claims.email_verified),
      name: str(claims.name, 60),
      avatar: str(claims.picture, 500),
      instagram: username && /^[a-z0-9._]{1,30}$/.test(username) ? username : null,
    };
  },
};
