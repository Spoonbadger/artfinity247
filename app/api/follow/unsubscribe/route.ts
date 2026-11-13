// One-click unsubscribe for the List-Unsubscribe header (RFC 8058: mail apps POST here).
// People clicking the link in an email land on /follow/unsubscribe instead.
import { NextResponse } from "next/server";
import { unsubscribe } from "@/lib/followers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(req: Request) {
  const t = new URL(req.url).searchParams.get("t") || "";
  const f = t ? await unsubscribe(t) : null;
  return NextResponse.json({ ok: !!f }, { status: f ? 200 : 404 });
}

export const POST = handle;

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") || "";
  return NextResponse.redirect(new URL(`/follow/unsubscribe?t=${encodeURIComponent(t)}`, req.url), 303);
}
