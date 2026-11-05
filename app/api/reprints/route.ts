// POST /api/reprints  { orderId, t, items: [{ id, qty }], reason, photos: string[], note? }
// A buyer reports a damaged, misprinted or wrong print from the signed help link (lib/reprints.ts).
// Saves the request for admin (/admin/reprints) and emails the buyer that we got it.
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { createRequest, ReprintError, verifyHelp } from "@/lib/reprints";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const input = await req.json().catch(() => null);
  if (!input || typeof input !== "object") return bad("Send the request as JSON.");
  const orderId = typeof input.orderId === "string" ? input.orderId : "";
  if (!verifyHelp(orderId, input.t)) return bad("This link isn't valid. Use the link in your email from Artfinity.", 403);
  if (!rateLimit(`help:${orderId}`, 8, 10 * 60_000) || !rateLimit(`help-ip:${ip}`, 30, 10 * 60_000)) {
    return bad("That's a lot of tries. Give it a few minutes.", 429);
  }
  try {
    const id = await createRequest(orderId, input);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof ReprintError) return bad(err.message, err.status);
    console.error("Reprint request failed", err);
    return bad("Something went wrong on our side. Try again, or write to us.", 500);
  }
}
