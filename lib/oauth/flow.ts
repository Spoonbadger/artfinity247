// Short-lived, signed cookies for the OAuth round trip (server only).
//   af_oauth         state + PKCE verifier + nonce + where to go next, 10 minutes, only sent to /api/auth/oauth
//   af_oauth_signup  a new person's provider profile while they finish sign-up, 30 minutes
// Both are HS256 JWTs signed with a key derived from JWT_SECRET for this purpose only, so they can never be
// mistaken for (or replayed as) an auth-token.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { safeNext } from "@/components/auth/next";
import type { ProviderId } from "./meta";
import { isProviderId } from "./meta";

export const FLOW_COOKIE = "af_oauth";
export const SIGNUP_COOKIE = "af_oauth_signup";
const FLOW_TTL = 10 * 60;
const SIGNUP_TTL = 30 * 60;

function key(purpose: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return createHmac("sha256", secret).update(`artfinity-oauth:${purpose}`).digest();
}

const b64url = (b: Buffer) => b.toString("base64url");
export const randomToken = (bytes = 32) => b64url(randomBytes(bytes));

/** PKCE (RFC 7636) S256 pair. */
export function pkcePair() {
  const verifier = randomToken(48); // 64 chars, inside the 43-128 range
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The base URL redirect URIs are built from. Must match what's registered with each provider. */
export function appBase(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  return (env || new URL(req.url).origin).replace(/\/$/, "");
}

export const redirectUri = (req: Request, provider: ProviderId) => `${appBase(req)}/api/auth/oauth/${provider}/callback`;

/** Only a same-site relative path survives (no //host, no backslashes, no scheme). */
export function cleanNext(raw: string | null | undefined): string | null {
  const n = safeNext(raw);
  if (!n) return null;
  try {
    const u = new URL(n, "http://x.invalid");
    return u.origin === "http://x.invalid" ? n : null;
  } catch {
    return null;
  }
}

// ---------- flow cookie ----------

export type FlowMode = "login" | "link";
export type Flow = {
  provider: ProviderId;
  state: string;
  verifier: string | null;
  nonce: string;
  next: string | null;
  mode: FlowMode;
  /** "link" mode: the signed-in artist who asked to connect. */
  linkArtistId: string | null;
  /** Sign-up carry-overs (plain UI values, re-validated later). */
  handle: string | null;
  ref: string | null;
};

export async function sealFlow(f: Flow): Promise<string> {
  return new SignJWT({ typ: "oauth-flow", ...f })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${FLOW_TTL}s`)
    .sign(key("flow"));
}

export async function openFlow(token: string | undefined | null): Promise<Flow | null> {
  if (!token) return null;
  try {
    const { payload: p } = await jwtVerify(token, key("flow"), { algorithms: ["HS256"] });
    if (p.typ !== "oauth-flow" || !isProviderId(p.provider) || typeof p.state !== "string" || typeof p.nonce !== "string") return null;
    return {
      provider: p.provider,
      state: p.state,
      verifier: typeof p.verifier === "string" ? p.verifier : null,
      nonce: p.nonce,
      next: cleanNext(p.next as string | null),
      mode: p.mode === "link" ? "link" : "login",
      linkArtistId: typeof p.linkArtistId === "string" ? p.linkArtistId : null,
      handle: typeof p.handle === "string" ? p.handle : null,
      ref: typeof p.ref === "string" ? p.ref : null,
    };
  } catch {
    return null;
  }
}

/**
 * Cookie options for the flow cookie. Apple returns with a cross-site POST (response_mode=form_post), which
 * SameSite=Lax cookies don't ride on, so Apple's flow cookie is SameSite=None (which requires Secure).
 */
export function flowCookieOptions(provider: ProviderId) {
  const crossSitePost = provider === "apple";
  return {
    name: FLOW_COOKIE,
    httpOnly: true,
    secure: crossSitePost || process.env.NODE_ENV === "production",
    sameSite: (crossSitePost ? "none" : "lax") as "none" | "lax",
    path: "/api/auth/oauth",
    maxAge: FLOW_TTL,
  };
}

// ---------- pending sign-up cookie ----------

export type PendingSignup = {
  provider: ProviderId;
  providerAccountId: string;
  email: string | null;
  /** True only when the provider vouched for the email (Google email_verified, Apple). */
  emailVerified: boolean;
  name: string | null;
  avatar: string | null;
  /** Instagram username, to prefill the Instagram link. */
  instagram: string | null;
};

export async function sealSignup(p: PendingSignup): Promise<string> {
  return new SignJWT({ typ: "oauth-signup", ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SIGNUP_TTL}s`)
    .sign(key("signup"));
}

export async function openSignup(token: string | undefined | null): Promise<PendingSignup | null> {
  if (!token) return null;
  try {
    const { payload: p } = await jwtVerify(token, key("signup"), { algorithms: ["HS256"] });
    if (p.typ !== "oauth-signup" || !isProviderId(p.provider) || typeof p.providerAccountId !== "string" || !p.providerAccountId) return null;
    const str = (v: unknown) => (typeof v === "string" && v ? v : null);
    return {
      provider: p.provider,
      providerAccountId: p.providerAccountId,
      email: str(p.email),
      emailVerified: p.emailVerified === true && !!str(p.email),
      name: str(p.name),
      avatar: str(p.avatar),
      instagram: str(p.instagram),
    };
  } catch {
    return null;
  }
}

export const signupCookieOptions = {
  name: SIGNUP_COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SIGNUP_TTL,
};

/** Reads one cookie from a raw request (route handlers get a plain Request for POST form callbacks too). */
export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
