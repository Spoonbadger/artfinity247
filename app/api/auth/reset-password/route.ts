import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { signAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic"

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password } = schema.parse(body);

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { artistId: true, expiresAt: true },
    });

    if (!record) {
      return NextResponse.json({ ok: false, error: "This link was already used or replaced by a newer one.", code: "reset_expired" }, { status: 400 });
    }

    if (record.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { tokenHash } });
      return NextResponse.json({ ok: false, error: "This link expired. Reset links work for 30 minutes.", code: "reset_expired" }, { status: 400 });
    }

    const hashedPw = await hash(password, 10);

    // New password signs out every existing session (sessionVersion, lib/auth.ts). The link was emailed, so the
    // address is confirmed too.
    const a = await prisma.artist.findUnique({ where: { id: record.artistId }, select: { emailVerifiedAt: true } });
    const updated = await prisma.artist.update({
      where: { id: record.artistId },
      data: {
        password: hashedPw,
        sessionVersion: { increment: 1 },
        ...(a && !a.emailVerifiedAt ? { emailVerifiedAt: new Date(), emailVerifyToken: null } : {}),
      },
    });

    // one-time use: this token and any others still out there
    await prisma.passwordResetToken.deleteMany({ where: { artistId: record.artistId } });

    // The emailed link proved who they are: sign this browser in (a session cookie, like an unticked "Remember me"),
    // so they land in the Studio instead of typing the new password straight back into the log-in form.
    if (updated.closedAt || updated.suspendedAt) return NextResponse.json({ ok: true, signedIn: false }, { status: 200 });
    const res = NextResponse.json({ ok: true, signedIn: true, admin: updated.role.toUpperCase() === "ADMIN" }, { status: 200 });
    res.cookies.set("auth-token", await signAuthToken(updated, "3h"), { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", sameSite: "lax" });
    return res;
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ ok: false, error: "Use at least 8 characters.", code: "weak_password" }, { status: 400 });
    return NextResponse.json({ ok: false, error: "Something went wrong on our side. Try again in a minute.", code: "server_error" }, { status: 500 });
  }
}
