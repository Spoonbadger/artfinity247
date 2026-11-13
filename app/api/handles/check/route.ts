import { NextRequest, NextResponse } from "next/server";
import { checkHandle, normalizeHandle } from "@/app/api/auth/_lib/handle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Light per-IP limit; the claim box checks as you type (debounced).
const hits = new Map<string, { n: number; t: number }>();
function allowed(ip: string) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.t > 60_000) { hits.set(ip, { n: 1, t: now }); return true; }
  e.n++;
  return e.n <= 90;
}

/**
 * GET /api/handles/check?h=name → { handle, available, suggestion, suggestions, reason }
 * Same rules as sign-up (app/api/auth/_lib/handle.ts): a–z, 0–9, dots and underscores, 3–30 chars.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowed(ip)) return NextResponse.json({ error: "Too many checks. Try again in a minute." }, { status: 429 });

  // Normalise the way the claim box does: lowercase, drop anything sign-up won't accept.
  const handle = normalizeHandle(req.nextUrl.searchParams.get("h") || "").replace(/[^a-z0-9_.]/g, "").slice(0, 30);
  if (handle.length < 3) return NextResponse.json({ handle, available: false, suggestion: null, suggestions: [], reason: "short" });

  try {
    const r = await checkHandle(handle);
    const suggestions = r.suggestions ?? [];
    return NextResponse.json({ handle, available: r.available, suggestion: suggestions[0] ?? null, suggestions, reason: r.reason ?? null });
  } catch (err) {
    console.error("handle check failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
