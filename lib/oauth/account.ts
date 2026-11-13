// What a successful provider sign-in turns into (server only). The linking rules are security-sensitive:
//   1. An OAuthAccount for (provider, providerAccountId) exists        -> log in as its artist.
//   2. The provider VOUCHES for the email (Google email_verified, Apple) and an artist has that email
//                                                                       -> connect the provider to them, log in.
//   3. The email is unverified (Facebook) or missing (Instagram) and an artist has it
//                                                                       -> refuse ("email_in_use"); never link.
//   4. Otherwise                                                        -> a new person: finish sign-up.
//      If that artist never confirmed their email, whoever made the page may not own the address
//      (pre-registration takeover), so the provider wins: the email is marked confirmed, the password is cleared,
//      every old session is signed out (sessionVersion + 1) and the address gets a heads-up email.
// Closed and suspended accounts never get in (same messages as password login, see loginBlock).
import { Prisma } from "@prisma/client";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAuthToken } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { deviceCookie, recordDeviceSignal } from "@/lib/referrals";
import { PROVIDER_LABEL, type ProviderId } from "./meta";
import type { OAuthProfile } from "./providers";
import type { PendingSignup } from "./flow";

const artistSelect = {
  id: true, email: true, slug: true, role: true, closedAt: true, suspendedAt: true, password: true, emailVerifiedAt: true, sessionVersion: true,
} as const;
export type SessionArtist = Prisma.ArtistGetPayload<{ select: typeof artistSelect }>;

/** Why this artist can't sign in, or null. Mirrors POST /api/auth/login (closed, then suspended). */
export function loginBlock(a: Pick<SessionArtist, "closedAt" | "suspendedAt">): "account_closed" | "account_suspended" | null {
  if (a.closedAt) return "account_closed";
  if (a.suspendedAt) return "account_suspended";
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
    const takeover = !match.emailVerifiedAt;
    let artist: SessionArtist = match;
    try {
      artist = await prisma.$transaction(async (tx) => {
        await tx.oAuthAccount.create({ data: { artistId: match.id, provider, providerAccountId: p.providerAccountId, email: p.email, lastUsedAt: new Date() } });
        if (!takeover) return match;
        // Unconfirmed page: the provider has just proved who owns the address. Lock out whoever set the password.
        await tx.passwordResetToken.deleteMany({ where: { artistId: match.id } });
        return tx.artist.update({
          where: { id: match.id },
          data: { emailVerifiedAt: new Date(), emailVerifyToken: null, password: null, sessionVersion: { increment: 1 } },
          select: artistSelect,
        });
      });
    } catch (e) {
      // Two tabs racing: the other one linked it first. Only fine if it went to the same artist.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      const again = await prisma.oAuthAccount.findUnique({ where: key, select: { artistId: true } });
      if (again?.artistId !== match.id) return { kind: "email_in_use" };
      artist = (await prisma.artist.findUnique({ where: { id: match.id }, select: artistSelect })) ?? match;
    }
    if (takeover) await sendTakeoverNotice(artist.email, provider, !!match.password);
    return { kind: "login", artist, linked: true };
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
  // The provider vouches for the same address the account uses: that confirms it.
  if (!me.emailVerifiedAt && p.emailVerified && p.email && p.email === me.email.toLowerCase()) {
    await prisma.artist.update({ where: { id: artistId }, data: { emailVerifiedAt: new Date(), emailVerifyToken: null } });
  }
  return { ok: true };
}

async function sendTakeoverNotice(to: string, provider: ProviderId, hadPassword: boolean) {
  const name = PROVIDER_LABEL[provider];
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Artfinity <no-reply@theartfinity.com>",
      to,
      subject: `Your Artfinity account is now linked to ${name}`,
      text:
        `Your Artfinity account is now linked to ${name}, and your email is confirmed.\n\n` +
        (hadPassword ? "If you set a password before, set a new one in Studio → My page → Sign-in methods. The old one no longer works, and other devices were signed out.\n\n" : "") +
        `From now on, log in with "Continue with ${name}".\n\nIf this wasn't you, reply to this email.\n\nArtfinity`,
    });
  } catch (e) {
    console.error("TAKEOVER_NOTICE_FAIL", e);
  }
}

/**
 * Signs the artist in on `res`: the same auth-token JWT as password login ("keep me logged in", 30 days) and the
 * same device signal for the referral checks.
 */
export async function issueSession(res: NextResponse, artist: Pick<SessionArtist, "id" | "email" | "slug" | "role" | "sessionVersion">, req: Request, kind: "login" | "signup" = "login") {
  const token = await signAuthToken(artist, "30d");
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
