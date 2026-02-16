import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const artist = await prisma.artist.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    });

    // Always return 200 (anti-enumeration)
    if (!artist) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 mins

    // Optional: invalidate old tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { artistId: artist.id } });

    await prisma.passwordResetToken.create({
      data: {
        artistId: artist.id,
        tokenHash,
        expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error("Missing NEXT_PUBLIC_APP_URL");

    const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL; // e.g. "Artfinity <no-reply@yourdomain.com>"
    if (!resendKey || !fromEmail) throw new Error("Missing RESEND env vars");

    const resend = new Resend(resendKey);

    console.log("API KEY:", process.env.RESEND_API_KEY);
    console.log("FROM EMAIL:", process.env.RESEND_FROM_EMAIL);
    console.log("APP URL:", process.env.NEXT_PUBLIC_APP_URL);

    await resend.emails.send({
      from: fromEmail,
      to: artist.email,
      subject: "Reset your Artfinity password",
      html: getResetEmailHtml(resetLink),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    // Still avoid leaking user existence; but return 200 only if you want silent failures.
    // I prefer 500 here so YOU notice problems during dev.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

function getResetEmailHtml(resetLink: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Reset your password</h2>
      <p>Click the button below to reset your Artfinity password. This link expires in 30 minutes.</p>
      <p>
        <a href="${resetLink}"
           style="display:inline-block;padding:12px 16px;border-radius:6px;text-decoration:none;background:#111;color:#fff">
          Reset Password
        </a>
      </p>
      <p>If you didn’t request this, you can ignore this email.</p>
    </div>
  `;
}
