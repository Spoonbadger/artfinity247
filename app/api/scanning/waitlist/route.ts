// POST /api/scanning/waitlist { email, source? }  "Coming soon — join the waitlist" while the scanning service is off
// (lib/scanning.server.ts). Public; a signed-in artist's id is saved with it.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { joinWaitlist, ScanError } from "@/lib/scanning.server";
import { PAINTING_SCANS } from "@/lib/features";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!PAINTING_SCANS) return NextResponse.json({ error: "Painting scans aren’t available.", code: "scanning_off" }, { status: 404 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`scan-waitlist:${ip}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Too many tries. Wait a few minutes.", code: "rate_limited" }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; source?: unknown };
  const user = await getUserFromCookie().catch(() => null);
  try {
    await joinWaitlist(String(body.email ?? ""), body.source === "studio" ? "studio" : "public", user?.id ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ScanError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("[scanning] waitlist failed", err);
    return NextResponse.json({ error: "We couldn't save that. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
