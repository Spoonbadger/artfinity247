// GET    /api/auth/oauth/pending   the provider profile waiting to finish sign-up (from the signed cookie)
// DELETE /api/auth/oauth/pending   "Not you? Start over"
// Sign-up never trusts query params for any of this: only this signed, httpOnly cookie.
import { NextResponse } from "next/server";
import { SIGNUP_COOKIE, openSignup, readCookie, signupCookieOptions } from "@/lib/oauth/flow";
import { PROVIDER_LABEL } from "@/lib/oauth/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = await openSignup(readCookie(req, SIGNUP_COOKIE));
  if (!p) return NextResponse.json({ pending: null }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    {
      pending: {
        provider: p.provider,
        providerLabel: PROVIDER_LABEL[p.provider],
        email: p.email,
        emailVerified: p.emailVerified,
        name: p.name,
        avatar: p.avatar,
        instagram: p.instagram,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...signupCookieOptions, value: "", maxAge: 0 });
  return res;
}
