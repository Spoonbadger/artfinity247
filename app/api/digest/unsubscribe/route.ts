// GET/POST /api/digest/unsubscribe?a=<artistId>&t=<sig>   One-click opt-out from the artist weekly digest (lib/digest.ts).
// GET (the link in the email) turns it off and shows a short page; &on=1 turns it back on. POST is the
// List-Unsubscribe-Post one-click from mail apps. Signed per artist (lib/artistPrefs.ts), no login needed.
import { NextRequest, NextResponse } from "next/server";
import { setPref, signPrefLink, verifyPrefLink } from "@/lib/artistPrefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>` +
      `<body style="font:16px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#15161b;background:#f7f5f0;margin:0;padding:24px 16px">` +
      `<main style="max-width:460px;margin:0 auto;background:#fff;border:1px solid #e6e3dc;border-radius:16px;padding:22px">${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const a = sp.get("a") || "";
  if (!verifyPrefLink(a, "digest", sp.get("t"))) return page("Link expired", "<h1>This link doesn't work</h1><p>Turn the weekly email off from your Studio instead.</p>", 403);
  const on = sp.get("on") === "1";
  await setPref(a, "digest", { off: !on });
  const toggle = `/api/digest/unsubscribe?a=${encodeURIComponent(a)}&t=${signPrefLink(a, "digest")}${on ? "" : "&on=1"}`;
  return on
    ? page("Weekly digest on", `<h1 style="font-size:22px">You're back on the list</h1><p>Your weekly Artfinity digest comes on Monday mornings.</p><p><a href="${toggle}" style="color:#8b2a4b">Turn it off</a></p>`)
    : page("Weekly digest off", `<h1 style="font-size:22px">Done. No more weekly digest.</h1><p>Sale, payout and order emails still come as usual.</p><p><a href="${toggle}" style="color:#8b2a4b">Changed your mind? Turn it back on</a></p>`);
}

export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const a = sp.get("a") || "";
  if (!verifyPrefLink(a, "digest", sp.get("t"))) return NextResponse.json({ error: "Invalid link" }, { status: 403 });
  await setPref(a, "digest", { off: true });
  return NextResponse.json({ ok: true });
}
