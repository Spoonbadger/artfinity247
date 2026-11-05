// POST /api/collector/verify { t } → { next } and the collector-token cookie. The emailed link opens /collector/verify,
// which posts here (a POST, so link scanners that open emails can't use up the one-time link).
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { COLLECTOR_COOKIE, consumeLink, saveToWishlist, sessionCookieOptions, signSession } from "@/lib/collector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REASON = {
  invalid: "This link isn't valid. Ask for a new one.",
  expired: "This link has expired (they last 15 minutes). Ask for a new one.",
  used: "This link was already used. Ask for a new one.",
};

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`collector-verify:${ip}`, 20, 15 * 60_000)) return NextResponse.json({ error: "Too many tries. Give it a few minutes." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { t?: unknown };
  const r = await consumeLink(body.t);
  if (!r.ok) return NextResponse.json({ error: REASON[r.reason], reason: r.reason }, { status: 400 });
  let saved = false;
  if (r.save) saved = await saveToWishlist(r.collector.id, r.save).catch(() => false);
  const res = NextResponse.json({ ok: true, next: r.next, saved, created: r.created });
  res.cookies.set(COLLECTOR_COOKIE, await signSession(r.collector), sessionCookieOptions);
  return res;
}
