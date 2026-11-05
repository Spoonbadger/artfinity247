import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { compare } from "bcryptjs";
import { signAuthToken } from "@/lib/auth";
import { NextResponse } from "next/server";
import { deviceCookie, recordDeviceSignal } from "@/lib/referrals";
export const runtime = "nodejs"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const rawIp = req.headers.get("x-forwarded-for");
    const ip = rawIp?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: "Too many tries. Wait a minute and try again.", code: "rate_limited" }, { status: 429 });
    }


    const { email, password, remember = false } = await req.json();
    const emailTrim = (email || "").trim();

    if (!emailTrim || !password) {
      return NextResponse.json({ error: "Enter your email and password.", code: "missing_fields" }, { status: 400 });
    }

    // ⬇️ case-insensitive email lookup
    const artist = await prisma.artist.findFirst({
      where: { email: { equals: emailTrim, mode: "insensitive" } },
    });

    if (!artist) {
      return NextResponse.json({ error: "No account with that email.", code: "user_not_found" }, { status: 401 });
    }

    // Made with Google/Apple/...: there's no password to check. Say which button to use (or how to add a password).
    if (!artist.password) {
      const providers = await prisma.oAuthAccount.findMany({ where: { artistId: artist.id }, select: { provider: true } });
      return NextResponse.json(
        { error: "This account signs in with a connected account, not a password.", code: "social_only", providers: providers.map((p) => p.provider) },
        { status: 401 },
      );
    }

    const isValid = await compare(password, artist.password);
    if (!isValid) {
      return NextResponse.json({ error: "That password doesn't match.", code: "bad_password" }, { status: 401 });
    }

    if (artist.closedAt) {
      return NextResponse.json({ error: "This account is closed. Message us to reopen it.", code: "account_closed" }, { status: 403 });
    }

    // Paused by an admin: no logging in (social sign-in refuses the same way, lib/oauth/account.ts loginBlock).
    if (artist.suspendedAt) {
      return NextResponse.json({ error: "This account is paused. Message us and we'll sort it out.", code: "account_suspended" }, { status: 403 });
    }

    const jwtExpire = remember ? "30d" : "3h";
    // Carries sessionVersion, so a password change/reset or suspension signs this session out (lib/auth.ts).
    const token = await signAuthToken(artist, jwtExpire);

    const response = NextResponse.json({
      message: "Logged in",
      artist: {
        id: artist.id,
        name: artist.name,
        slug: artist.slug,
        email: artist.email,
        role: artist.role.toUpperCase(),
      },
    });

    // Hashed network + browser id, for the referral same-person check (lib/referrals.ts).
    response.cookies.set(deviceCookie(await recordDeviceSignal(artist.id, req, "login")));

    const cookieBase = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax" as const,
    };

    if (remember) {
      // Same lifetime as the 30-day JWT above; secure everywhere but localhost dev.
      response.cookies.set("auth-token", token, {
        ...cookieBase,
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    } else {
      // session cookie (expires with browser session)
      response.cookies.set("auth-token", token, cookieBase);
    }

    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a minute.", code: "server_error" }, { status: 500 });
  }
}
