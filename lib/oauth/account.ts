// What a successful provider sign-in turns into (server only). The linking rules are security-sensitive:
//   1. An OAuthAccount for (provider, providerAccountId) exists        -> log in as its artist.
//   2. The provider VOUCHES for the email (Google email_verified, Apple) and an artist has that email
//                                                                       -> connect the provider to them, log in.
//   3. The email is unverified (Facebook) or missing (Instagram) and an artist has it
//                                                                       -> refuse ("email_in_use"); never link.
//   4. Otherwise                                                        -> a new person: finish sign-up.
// Closed accounts never get in (same message as password login); suspended accounts follow the password login
// route (lib/oauth/account.ts loginBlock).
import { Prisma } from "@prisma/client";
import { SignJWT } from "jose";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deviceCookie, recordDeviceSignal } from "@/lib/referrals";
import type { ProviderId } from "./meta";
import type { OAuthProfile } from "./providers";
import type { PendingSignup } from "./flow";

const artistSelect = { id: true, email: true, slug: true, role: true, closedAt: true, suspendedAt: true, password: true } as const;
export type SessionArtist = Prisma.ArtistGetPayload<{ select: typeof artistSelect }>;

/**
 * Why this artist can't sign in, or null. Mirrors POST /api/auth/login: a closed account is refused with
 * "account_closed". Suspension is not checked there (a suspended artist can still log in to see why), so it
 * isn't checked here either; change both together.
 */
export function loginBlock(a: Pick<SessionArtist, "closedAt" | "suspendedAt">): "account_closed" | "account_suspended" | null {
  if (a.closedAt) return "account_closed";
  return null;
}

export type Resolution =
  | { kind: "login"; artist: SessionArtist; linked: boolean }
  | { kind: "blocked"; code: "account_closed" | "account_suspended" }
  | { kind: "email_in_use" }
  | { kind: "signup"; pending: PendingSignup };

const findByEmail = (email: string) =>
  prisma.artist.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: artistSelect });

export async function resolveSignIn(provider: ProviderId, p: OAuthProfile): Promise<Resolution> {
  const key = { provider_providerAccountId: { provider, providerAccountId: p.providerAccountId } };
  const existing = await prisma.oAuthAccount.findUnique({ where: key, select: { id: true, artist: { select: artistSelect } } });
  if (existing) {
    const block = loginBlock(existing.artist);
    if (block) return { kind: "blocked", code: block };
    await prisma.oAuthAccount.update({ where: { id: existing.id }, data: { lastUsedAt: new Date(), ...(p.email ? { email: p.email } : {}) } });
    return { kind: "login", artist: existing.artist, linked: false };
  }

  const match = p.email ? await findByEmail(p.email) : null;
  if (match && p.email && p.emailVerified) {
    const block = loginBlock(match);
    if (block) return { kind: "blocked", code: block };
    try {
      await prisma.oAuthAccount.create({ data: { artistId: match.id, provider, providerAccountId: p.providerAccountId, email: p.email, lastUsedAt: new Date() } });
    } catch (e) {
      // Two tabs racing: the other one linked it first. Only fine if it went to the same artist.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      const again = await prisma.oAuthAccount.findUnique({ where: key, select: { artistId: true } });
      if (again?.artistId !== match.id) return { kind: "email_in_use" };
    }
    return { kind: "login", artist: match, linked: true };
  }
  if (match) return { kind: "email_in_use" };

  return {
    kind: "signup",
    pending: {
      provider,
      providerAccountId: p.providerAccountId,
      email: p.email,
      emailVerified: !!p.email && p.emailVerified,
      name: p.name,
      avatar: p.avatar,
      instagram: p.instagram ?? null,
    },
  };
}

export type LinkResult = { ok: true } | { ok: false; code: "already_linked" | "provider_already_connected" | "not_logged_in" | "account_closed" | "account_suspended" };

/** Studio "Connect": attach this provider account to the signed-in artist. */
export async function linkToArtist(artistId: string, provider: ProviderId, p: OAuthProfile): Promise<LinkResult> {
  const me = await prisma.artist.findUnique({ where: { id: artistId }, select: artistSelect });
  if (!me) return { ok: false, code: "not_logged_in" };
  const block = loginBlock(me);
  if (block) return { ok: false, code: block };
  const key = { provider_providerAccountId: { provider, providerAccountId: p.providerAccountId } };
  const existing = await prisma.oAuthAccount.findUnique({ where: key, select: { id: true, artistId: true } });
  if (existing) {
    if (existing.artistId !== artistId) return { ok: false, code: "already_linked" };
    await prisma.oAuthAccount.update({ where: { id: existing.id }, data: { lastUsedAt: new Date() } });
    return { ok: true };
  }
  const other = await prisma.oAuthAccount.findFirst({ where: { artistId, provider }, select: { id: true } });
  if (other) return { ok: false, code: "provider_already_connected" };
  try {
    await prisma.oAuthAccount.create({ data: { artistId, provider, providerAccountId: p.providerAccountId, email: p.email, lastUsedAt: new Date() } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, code: "already_linked" };
    throw e;
  }
  return { ok: true };
}

/**
 * Signs the artist in on `res`: the same auth-token JWT as password login ("keep me logged in", 30 days) and the
 * same device signal for the referral checks.
 */
export async function issueSession(res: NextResponse, artist: Pick<SessionArtist, "id" | "email" | "slug" | "role">, req: Request, kind: "login" | "signup" = "login") {
  const token = await new SignJWT({ id: artist.id, email: artist.email, slug: artist.slug, role: artist.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
  res.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set(deviceCookie(await recordDeviceSignal(artist.id, req, kind)));
}

/** Sign-in methods an artist has: password and/or connected providers. */
export async function signInMethods(artistId: string) {
  const a = await prisma.artist.findUnique({
    where: { id: artistId },
    select: { password: true, oauthAccounts: { select: { provider: true, email: true, createdAt: true, lastUsedAt: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!a) return null;
  return { hasPassword: !!a.password, accounts: a.oauthAccounts };
}
