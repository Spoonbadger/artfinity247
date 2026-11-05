import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { resend, emailEnabled } from "@/lib/resend";
import { rateLimit } from "@/lib/rateLimit"
import PasswordResetEmail from "@/emails/PasswordResetEmail"
import SocialSignInReminderEmail from "@/emails/SocialSignInReminderEmail"
import { PROVIDER_LABEL, isProviderId } from "@/lib/oauth/meta"

export const dynamic = "force-dynamic"

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const rawIp = req.headers.get("x-forwarded-for")
    const ip = rawIp?.split(",")[0]?.trim() || "unknown"
    if (!rateLimit(ip)) {
      return new NextResponse("Too many requests", { status: 429 });
    }

    const body = await req.json();
    const { email } = schema.parse(body);

    const artist = await prisma.artist.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, password: true, oauthAccounts: { select: { provider: true }, orderBy: { createdAt: "asc" } } },
    });

    // Always return 200 (anti-enumeration)
    if (!artist) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Rate limit: max 3 reset emails per artist per hour
    const oneHourAgo = new Date(Date.now() - 1000 * 60 * 60)

    const attemptsLastHour = await prisma.passwordResetToken.count({
      where: {
        artistId: artist.id,
        createdAt: { gte: oneHourAgo },
      },
    })

    if (attemptsLastHour >= 3) {
      // still return 200 to prevent email enumeration
      return NextResponse.json({ ok: true }, { status: 200 })
    }


    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error("Missing NEXT_PUBLIC_APP_URL");
    const fromEmail = process.env.RESEND_FROM_EMAIL || "Artfinity <no-reply@theartfinity.com>";

    // Signed up with Google/Apple/...: no password to reset, so remind them how they sign in instead.
    const providers = Array.from(new Set(artist.oauthAccounts.map((a) => a.provider))).filter(isProviderId).map((p) => PROVIDER_LABEL[p]);
    if (!artist.password && providers.length) {
      if (!rateLimit(`social-reminder:${artist.id}`, 3, 60 * 60 * 1000)) return NextResponse.json({ ok: true }, { status: 200 })
      if (!emailEnabled) console.log(`[email:dev] social sign-in reminder for ${artist.email}: ${providers.join(", ")}`);
      await resend.emails.send({
        from: fromEmail,
        to: artist.email,
        subject: `Log in to Artfinity with ${providers[0]}`,
        react: SocialSignInReminderEmail({ providers, loginLink: `${appUrl}/login` }),
      })
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 mins

    // Invalidate old tokens for this user
    await prisma.passwordResetToken.deleteMany({ 
      where: { 
        artistId: artist.id, 
        expiresAt: { lt: new Date() },
      } 
    })

    await prisma.passwordResetToken.create({
      data: {
        artistId: artist.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

    if (!emailEnabled) console.log(`[email:dev] password reset link for ${artist.email}: ${resetLink}`);

    await resend.emails.send({
      from: fromEmail,
      to: artist.email,
      subject: "Reset your Artfinity password",
      react: PasswordResetEmail({ resetLink }),
    })

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    // Still avoid leaking user existence; but return 200 only if you want silent failures.
    // I prefer 500 here so YOU notice problems during dev.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
