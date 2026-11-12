// GET   /api/studio/account : the signed-in artist's private account details.
// PATCH /api/studio/account { first_name?, last_name?, email?, phone?, state? }
// Legal name, email, phone and state are private (used for payouts and tax), never shown on the public page.
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, signAuthToken } from "@/lib/auth";
import { sendVerifyEmail } from "@/lib/emailVerify";
import { citySlugFor } from "@/lib/citySlug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+().\-\s]{7,25}$/;
const NAME_RE = /^[\p{L}\p{M}' .\-]{1,60}$/u;
const SELECT = { first_name: true, last_name: true, email: true, phone: true, state: true } as const;

const fail = (error: string, status = 400, field?: string, code?: string) =>
  NextResponse.json({ error, field, code: code ?? (status === 401 ? "not_logged_in" : status === 409 ? "email_taken" : status >= 500 ? "server_error" : "invalid") }, { status });

async function auth() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await auth();
  if (!user) return fail("Log in first.", 401);
  const account = await prisma.artist.findUnique({ where: { id: user.id }, select: SELECT });
  if (!account) return fail("Account not found.", 404);
  return NextResponse.json({ account });
}

export async function PATCH(req: Request) {
  const user = await auth();
  if (!user) return fail("Log in first.", 401);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Nothing to save.");

  const data: Prisma.ArtistUpdateInput = {};
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : undefined);

  for (const k of ["first_name", "last_name"] as const) {
    const v = str(k);
    if (v === undefined) continue;
    if (!v) return fail(k === "first_name" ? "Add your first name." : "Add your last name.", 400, k);
    if (!NAME_RE.test(v)) return fail("Use letters, spaces, apostrophes or hyphens.", 400, k);
    data[k] = v;
  }

  const email = str("email")?.toLowerCase();
  if (email !== undefined) {
    if (!EMAIL_RE.test(email) || email.length > 254) return fail("Enter a real email.", 400, "email");
    const clash = await prisma.artist.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, NOT: { id: user.id } },
      select: { id: true },
    });
    if (clash) return fail("That email is already on another Artfinity page. Use a different one, or message us if it's yours.", 409, "email");
    data.email = email;
    // A new address needs confirming again (payouts and newsletters wait for it).
    if (email !== user.email?.toLowerCase()) {
      data.emailVerifiedAt = null;
      data.emailVerifyToken = null;
    }
  }

  const phone = str("phone");
  if (phone !== undefined) {
    if (phone && (!PHONE_RE.test(phone) || phone.replace(/\D/g, "").length < 7)) return fail("That phone number looks off.", 400, "phone");
    data.phone = phone; // column is non-null; empty string means none
  }

  const state = str("state");
  if (state !== undefined) {
    if (state.length > 40) return fail("Keep the state under 40 characters.", 400, "state");
    data.state = state || null;
    // The state is part of the place key (lib/citySlug.ts), so keep citySlug in step with it.
    const cur = await prisma.artist.findUnique({ where: { id: user.id }, select: { city: true } });
    if (cur?.city) data.citySlug = citySlugFor(cur.city, state || null);
  }

  if (!Object.keys(data).length) return fail("Nothing to save.");

  let account;
  try {
    account = await prisma.artist.update({ where: { id: user.id }, data, select: { ...SELECT, id: true, slug: true, role: true, sessionVersion: true, emailVerifiedAt: true } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail("That email is already in use.", 409, "email");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return fail("Account not found.", 404);
    console.error("ACCOUNT_UPDATE_FAIL", e);
    return fail("Could not save. Try again.", 500);
  }

  const { id, slug, role, sessionVersion, emailVerifiedAt, ...out } = account;
  if (data.email && !emailVerifiedAt) await sendVerifyEmail(id);
  const res = NextResponse.json({ account: out, emailVerified: !!emailVerifiedAt });

  // The session token carries the email; re-issue it with the same expiry so it stays in sync.
  if (data.email && data.email !== user.email) {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const old = cookies().get("auth-token")?.value;
    let exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    if (old) {
      try {
        const { payload } = await jwtVerify(old, secret);
        if (payload.exp) exp = payload.exp;
      } catch {}
    }
    const token = await signAuthToken({ id, email: account.email, slug, role, sessionVersion }, exp);
    const left = exp - Math.floor(Date.now() / 1000);
    const base = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
    // "Remember me" logins (30-day tokens) keep a persistent cookie; short sessions stay session cookies.
    res.cookies.set("auth-token", token, left > 60 * 60 * 4 ? { ...base, maxAge: left } : base);
  }
  return res;
}
