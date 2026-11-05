// GET /api/auth/verify-email?t=<token>   the link in "Confirm your email" (lib/emailVerify.ts).
// Confirms the email and sends the person to /email-confirmed?status=ok | expired | used | invalid, a page that says
// what happened and offers the next step (Studio, a fresh link, or log in first).
import { NextResponse } from "next/server";
import { consumeVerifyToken } from "@/lib/emailVerify";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`verify-email:${ip}`)) return NextResponse.json({ error: "Too many tries. Wait a minute, then open the link again.", code: "rate_limited" }, { status: 429 });
  const raw = new URL(req.url).searchParams.get("t") || "";
  // Tell an expired link from a used (or replaced) one; consumeVerifyToken answers null for both.
  const m = /^(\d{9,11})\.[\w-]{20,64}$/.exec(raw);
  const id = await consumeVerifyToken(raw);
  const status = id ? "ok" : !m ? "invalid" : Number(m[1]) * 1000 < Date.now() ? "expired" : "used";
  const res = NextResponse.redirect(`${base}/email-confirmed?status=${status}`, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
