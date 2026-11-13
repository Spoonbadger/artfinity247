// POST /api/auth/verify-email/resend   a fresh "Confirm your email" link for the signed-in artist (3 an hour).
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { isEmailVerified, sendVerifyEmail } from "@/lib/emailVerify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Log in first, then we'll send a fresh link.", code: "not_logged_in" }, { status: 401 });
  }
  if (await isEmailVerified(user.id)) return NextResponse.json({ ok: true, verified: true });
  if (!rateLimit(`verify-resend:${user.id}`, 3, 60 * 60 * 1000)) return NextResponse.json({ error: "We've sent a few already. Check your spam folder, or try again in an hour.", code: "rate_limited" }, { status: 429 });
  const sent = await sendVerifyEmail(user.id);
  return sent ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "We couldn't send the email just now. Try again in a minute.", code: "send_failed" }, { status: 502 });
}
