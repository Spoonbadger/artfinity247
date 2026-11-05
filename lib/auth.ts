// lib/auth.ts (server-side)
// The session is a JWT in the httpOnly `auth-token` cookie. It carries `sv`, the artist's sessionVersion when it
// was issued: bumping Artist.sessionVersion (password reset or change, admin suspend, the social-sign-in takeover
// fix in lib/oauth/account.ts) signs out every older token. Tokens from before `sv` existed count as version 0.
import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export type JwtUser = { id: string; slug?: string; email?: string; role?: "ADMIN" | "USER"; sv?: number };
type SessionRow = { closedAt: Date | null; suspendedAt: Date | null; sessionVersion: number };

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

/** Signs a session token. Every place that sets `auth-token` goes through here so `sv` is never left out. */
export function signAuthToken(
  a: { id: string; email: string; slug: string; role: string; sessionVersion: number },
  expiresIn: string | number,
): Promise<string> {
  return new SignJWT({ id: a.id, email: a.email, slug: a.slug, role: a.role, sv: a.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .sign(SECRET);
}

// One small query per artist per request (deduped by React's request cache in server components).
const sessionRow = cache(async (id: string): Promise<SessionRow | null> => {
  const { prisma } = await import("@/lib/prisma");
  return prisma.artist.findUnique({ where: { id }, select: { closedAt: true, suspendedAt: true, sessionVersion: true } });
});

/** Signature + expiry + session version. Returns the token's user and the artist's row, or null. */
async function checkToken(token: string | undefined | null): Promise<{ user: JwtUser; row: SessionRow } | null> {
  if (!token) return null;
  let user: JwtUser;
  try {
    user = (await jwtVerify(token, SECRET, { algorithms: ["HS256"] })).payload as JwtUser;
  } catch {
    return null;
  }
  if (!user?.id || typeof user.id !== "string") return null;
  const row = await sessionRow(user.id);
  if (!row) return null; // removed account
  if ((typeof user.sv === "number" ? user.sv : 0) !== row.sessionVersion) return null; // signed out elsewhere
  return { user, row };
}

/**
 * The signed-in user, or null. Rejects bad, expired and revoked (old sessionVersion) tokens. Closed and suspended
 * accounts still come back here (pages can explain); requireUser() refuses them.
 */
export async function getUserFromCookie(): Promise<JwtUser | null> {
  return (await checkToken(cookies().get("auth-token")?.value))?.user ?? null;
}

/** Same checks for a raw token string (older routes that read the cookie themselves). */
export async function verifyAuthToken(token: string | undefined | null): Promise<JwtUser | null> {
  return (await checkToken(token))?.user ?? null;
}

/** verifyAuthToken that throws instead of returning null (drop-in for jose's jwtVerify in older routes). */
export async function verifyAuthTokenOrThrow(token: string): Promise<JwtUser> {
  const u = await verifyAuthToken(token);
  if (!u) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return u;
}

// keep if you also want header auth for API clients
export async function getUserFromRequestAuthHeader(req: Request): Promise<JwtUser | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyAuthToken(auth.slice(7));
}

export async function requireUser(): Promise<JwtUser> {
  const s = await checkToken(cookies().get("auth-token")?.value);
  // A closed, suspended or removed account's old login stops working everywhere.
  if (!s || s.row.closedAt || s.row.suspendedAt) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return s.user;
}

export async function requireAdmin(): Promise<JwtUser> {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw Object.assign(new Error("Forbidden"), { status: 403 });
  return u;
}
