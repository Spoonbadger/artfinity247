// POST /api/studio/scanning/[id] { action: "cancel" }  The artist cancels a booking they haven't paid for yet.
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { artistCancel, ScanError } from "@/lib/scanning.server";
import { PAINTING_SCANS } from "@/lib/features";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!PAINTING_SCANS) return NextResponse.json({ error: "Painting scans aren’t available.", code: "scanning_off" }, { status: 404 });
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in to keep going.", code: "not_logged_in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (body.action !== "cancel") return NextResponse.json({ error: "That isn't something you can do here. Refresh and try again.", code: "bad_request" }, { status: 400 });
  try {
    await artistCancel(user.id, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ScanError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("[scanning] cancel failed", err);
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
