// GET /api/auth/verify-email?t=<token>   the link in "Confirm your email" (lib/emailVerify.ts).
// Confirms and sends the artist to /studio?verified=1; an unknown or expired link goes to /studio?verified=expired
// (where the banner offers a fresh one).
import { NextResponse } from "next/server";
import { consumeVerifyToken } from "@/lib/emailVerify";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`verify-email:${ip}`)) return new NextResponse("Too many requests", { status: 429 });
  const id = await consumeVerifyToken(new URL(req.url).searchParams.get("t") || "");
  const res = NextResponse.redirect(`${base}/studio?verified=${id ? "1" : "expired"}`, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
