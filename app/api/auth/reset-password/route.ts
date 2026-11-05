import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

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
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (record.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { tokenHash } });
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const hashedPw = await hash(password, 10);

    // New password signs out every existing session (sessionVersion, lib/auth.ts). The link was emailed, so the
    // address is confirmed too.
    const a = await prisma.artist.findUnique({ where: { id: record.artistId }, select: { emailVerifiedAt: true } });
    await prisma.artist.update({
      where: { id: record.artistId },
      data: {
        password: hashedPw,
        sessionVersion: { increment: 1 },
        ...(a && !a.emailVerifiedAt ? { emailVerifiedAt: new Date(), emailVerifyToken: null } : {}),
      },
    });

    // one-time use: this token and any others still out there
    await prisma.passwordResetToken.deleteMany({ where: { artistId: record.artistId } });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
