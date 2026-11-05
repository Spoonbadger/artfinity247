// POST /api/auth/register
// Creates an artist account from the short sign-up flow and signs them in.
// Body: { handle, email, password, artist_name, city, state?, acceptedTerms: true, ref? }
// Social sign-up (Google/Apple/Facebook/Instagram): { oauth: true, handle, email?, artist_name, city, ... } and no
// password. The provider account comes ONLY from the signed af_oauth_signup cookie (lib/oauth/flow.ts), never
// from the body. A provider-verified email is used as-is; otherwise (Instagram, Facebook) the typed email is used
// and must not belong to another page. The artist gets password: null plus the OAuthAccount.
// ref: a referral code from /register?ref=CODE. Unknown codes are ignored; a match sets referredById.
// acceptedTerms covers both the Artist Terms (/artist-terms-and-agreement) and the
// Terms & Conditions (/terms-and-conditions). There is no column for it yet, so acceptance
// is saved on Artist.termsAcceptedAt and logged (TERMS_ACCEPTED).
// Errors: { code: "missing_fields" | "terms_required" | "invalid_email" | "weak_password" | "invalid_handle" | "handle_taken" | "email_taken"
//          | "oauth_expired" | "oauth_in_use" | "server_error" }
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { signAuthToken } from "@/lib/auth";
import { sendVerifyEmail } from "@/lib/emailVerify";
import slugify from "slugify";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import NewArtistNotificationEmail from "@/emails/NewArtistNotificationEmail";
import WelcomeArtistEmail from "@/emails/WelcomeArtistEmail";
import { checkHandle, normalizeHandle } from "../_lib/handle";
import { deviceCookie, recordDeviceSignal, referrerForCode } from "@/lib/referrals";
import { SIGNUP_COOKIE, openSignup, readCookie, signupCookieOptions } from "@/lib/oauth/flow";
import { copyAvatar } from "@/lib/oauth/avatar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const err = (code: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ code, ...extra }, { status });

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return err("missing_fields", 400); }

  const oauth = body.oauth === true ? await openSignup(readCookie(req, SIGNUP_COOKIE)) : null;
  if (body.oauth === true && !oauth) return err("oauth_expired", 400);

  const handle = normalizeHandle(String(body.handle ?? ""));
  const email = oauth?.emailVerified && oauth.email ? oauth.email.toLowerCase() : String(body.email ?? "").trim().toLowerCase();
  const password = oauth ? "" : String(body.password ?? "");
  const artist_name = String(body.artist_name ?? "").trim().slice(0, 60);
  const city = String(body.city ?? "").trim().slice(0, 60);
  const state = String(body.state ?? "").trim().slice(0, 40) || null;

  if (!handle || !email || (!oauth && !password) || !artist_name || !city) return err("missing_fields", 400);
  if (body.acceptedTerms !== true) return err("terms_required", 400);
  if (!EMAIL_RE.test(email)) return err("invalid_email", 400);
  if (!oauth && password.length < 8) return err("weak_password", 400);

  const hc = await checkHandle(handle);
  if (!hc.available) return err(hc.reason === "invalid" ? "invalid_handle" : "handle_taken", hc.reason === "invalid" ? 400 : 409, { suggestions: hc.suggestions });

  const existing = await prisma.artist.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (existing) return err("email_taken", 409);
  if (oauth) {
    const taken = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: oauth.provider, providerAccountId: oauth.providerAccountId } },
      select: { id: true },
    });
    if (taken) return err("oauth_in_use", 409);
  }

  const referredById = body.ref ? await referrerForCode(body.ref).catch(() => null) : null;

  let artist;
  try {
    artist = await prisma.artist.create({
      data: {
        name: artist_name,
        artist_name,
        email,
        password: oauth ? null : await hash(password, 10),
        phone: "",
        city,
        citySlug: slugify(city, { lower: true, strict: true }),
        state,
        country: body.country ? String(body.country).slice(0, 60) : null,
        slug: handle,
        role: "USER",
        termsAcceptedAt: new Date(),
        // A provider-verified email (Google, Apple) is confirmed already; anything typed gets a confirmation email.
        ...(oauth?.emailVerified && oauth.email === email ? { emailVerifiedAt: new Date() } : {}),
        referredById,
        ...(oauth
          ? {
              oauthAccounts: { create: { provider: oauth.provider, providerAccountId: oauth.providerAccountId, email: oauth.email, lastUsedAt: new Date() } },
              // Instagram gives us the handle: start their links with it.
              ...(oauth.instagram
                ? { links: { create: { kind: "instagram", label: "Instagram", url: `https://instagram.com/${oauth.instagram}`, position: 0 } } }
                : {}),
            }
          : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta as any)?.target ?? "");
      return err(target.includes("email") ? "email_taken" : target.includes("provider") ? "oauth_in_use" : "handle_taken", 409);
    }
    console.error("REGISTER_FAIL", e);
    return err("server_error", 500);
  }

  const termsAcceptedAt = new Date().toISOString();
  console.info("TERMS_ACCEPTED", JSON.stringify({
    artistId: artist.id,
    email,
    documents: ["/artist-terms-and-agreement", "/terms-and-conditions"],
    acceptedAt: termsAcceptedAt,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  }));

  const token = await signAuthToken(artist, "30d");

  // The provider's picture becomes their profile photo (copied to our storage; never blocks sign-up).
  if (oauth?.avatar) {
    const url = await copyAvatar(oauth.provider, oauth.avatar, artist.slug);
    if (url) await prisma.artist.update({ where: { id: artist.id }, data: { profileImage: url } }).catch(() => {});
  }

  const res = NextResponse.json({ artist: { id: artist.id, slug: artist.slug, name: artist.artist_name } }, { status: 201 });
  if (oauth) res.cookies.set({ ...signupCookieOptions, value: "", maxAge: 0 });
  res.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  // Hashed network + browser id, for the referral same-person check (lib/referrals.ts). Nothing raw is stored.
  res.cookies.set(deviceCookie(await recordDeviceSignal(artist.id, req, "signup")));

  // "Confirm your email" (lib/emailVerify.ts). Never blocks sign-up.
  if (!artist.emailVerifiedAt) await sendVerifyEmail(artist.id);

  // Emails never block sign-up.
  try {
    await resend.emails.send({
      from: "Artfinity <notifications@theartfinity.com>",
      to: "contact@theartfinity.com",
      subject: `New artist: ${artist_name} (@${handle})`,
      react: NewArtistNotificationEmail({ artistName: artist_name, email, city, state: state ?? "", createdAt: new Date().toLocaleString() }),
    });
    await resend.emails.send({
      from: "Artfinity <notifications@theartfinity.com>",
      to: email,
      subject: "Welcome to Artfinity",
      react: WelcomeArtistEmail({ artistName: artist_name }),
    });
  } catch (e) {
    console.error("REGISTER_EMAIL_FAIL", e);
  }

  return res;
}
