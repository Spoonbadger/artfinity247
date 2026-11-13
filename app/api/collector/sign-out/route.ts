// POST /api/collector/sign-out → clears the collector-token cookie (the artist login is separate and untouched).
import { NextResponse } from "next/server";
import { COLLECTOR_COOKIE, sessionCookieOptions } from "@/lib/collector";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COLLECTOR_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
