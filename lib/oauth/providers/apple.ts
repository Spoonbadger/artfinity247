// Sign in with Apple: authorization code + nonce, response_mode=form_post (Apple POSTs back to the callback).
// Apple doesn't document PKCE for the web flow, so the code is protected by state + the signed client secret.
// The client secret is an ES256 JWT signed with the .p8 key (made fresh for each exchange, valid 5 minutes).
// Apple sends the person's name (and email) in a `user` form field on the FIRST sign-in only; we keep it in the
// pending sign-up cookie straight away. Emails may be private relay addresses (@privaterelay.appleid.com):
// they work like any other address once the sending domain is registered with Apple (see AUTH_SETUP.md).
// Env: APPLE_CLIENT_ID (the Services ID), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (.p8 contents)
import { SignJWT, importPKCS8 } from "jose";
import { claimTrue, remoteKeys, verifyIdToken } from "../idToken";
import { postForm, str, withQuery } from "./http";
import type { OAuthProvider } from "./types";

export const APPLE_ISSUER = "https://appleid.apple.com";
const JWKS = "https://appleid.apple.com/auth/keys";

/** The .p8 key from an env var: real newlines, "\n" escapes, or the bare base64 body all work. */
export function applePrivateKeyPem(raw: string): string {
  const v = raw.trim().replace(/\\n/g, "\n");
  if (v.includes("BEGIN PRIVATE KEY")) return v;
  const body = v.replace(/\s+/g, "");
  return `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----`;
}

export async function appleClientSecret(env = process.env): Promise<string> {
  const key = await importPKCS8(applePrivateKeyPem(env.APPLE_PRIVATE_KEY || ""), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID! })
    .setIssuer(env.APPLE_TEAM_ID!)
    .setSubject(env.APPLE_CLIENT_ID!)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

/** Apple's one-time `user` field: {"name":{"firstName","lastName"},"email"}. */
export function appleUserName(form: URLSearchParams | null): string | null {
  const raw = form?.get("user");
  if (!raw) return null;
  try {
    const u = JSON.parse(raw);
    const n = [u?.name?.firstName, u?.name?.lastName].filter((x) => typeof x === "string" && x.trim()).join(" ").trim();
    return n ? n.slice(0, 60) : null;
  } catch {
    return null;
  }
}

export const apple: OAuthProvider = {
  id: "apple",
  pkce: false,
  enabled: () =>
    !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
  authorizationUrl: ({ state, nonce, redirectUri }) =>
    withQuery("https://appleid.apple.com/auth/authorize", {
      client_id: process.env.APPLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "form_post",
      scope: "name email",
      state,
      nonce,
    }),
  async exchange({ code, nonce, redirectUri, form }) {
    const tok = await postForm("https://appleid.apple.com/auth/token", {
      client_id: process.env.APPLE_CLIENT_ID!,
      client_secret: await appleClientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const claims = await verifyIdToken(String(tok.id_token || ""), {
      keys: remoteKeys(JWKS),
      issuer: APPLE_ISSUER,
      audience: process.env.APPLE_CLIENT_ID!,
      nonce,
    });
    const email = str(claims.email, 254)?.toLowerCase() ?? null;
    return {
      providerAccountId: String(claims.sub),
      email,
      // Apple sends email_verified "true" for addresses it has checked, private relay ones included.
      emailVerified: !!email && claimTrue(claims.email_verified),
      name: appleUserName(form),
      avatar: null,
    };
  },
};
