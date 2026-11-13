// Sign in with Apple's client secret: an ES256 JWT signed with the .p8 key from Apple Developer.
// Only imports `jose`, so the unit check (lib/oauth/oauth.test.mjs) can load it with plain Node.
import { SignJWT, importPKCS8 } from "jose";

type Env = Record<string, string | undefined>;

/** The .p8 key from an env var: real newlines, "\n" escapes, or the bare base64 body all work. */
export function applePrivateKeyPem(raw: string): string {
  const v = raw.trim().replace(/\\n/g, "\n");
  if (v.includes("BEGIN PRIVATE KEY")) return v;
  const body = v.replace(/\s+/g, "");
  return `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----`;
}

export async function appleClientSecret(env: Env = process.env): Promise<string> {
  const key = await importPKCS8(applePrivateKeyPem(env.APPLE_PRIVATE_KEY || ""), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID! })
    .setIssuer(env.APPLE_TEAM_ID!)
    .setSubject(env.APPLE_CLIENT_ID!)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

