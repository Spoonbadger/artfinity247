// GET /q/<CODE> (any case; /Q/<CODE> is rewritten here by middleware.ts).
// Printed QR codes hold only this short link, so the artist can change what's behind it after printing.
//   unknown code       → 302 /?code=unknown
//   ended or inactive  → 302 /@handle?expired=1
//   live               → record the scan (in the background), 302 /art/<slug>?c=<CODE> or /@handle?c=<CODE>
import { NextRequest, NextResponse } from "next/server";
import { isLive, newVisitorId, recordScanLater, resolveCode, scanContext, validVisitorId, VISITOR_COOKIE } from "@/lib/shortlinks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function go(req: NextRequest, path: string) {
  const res = NextResponse.redirect(new URL(path, req.nextUrl.origin), 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const qr = await resolveCode(params.code).catch((e) => { console.error("[q] lookup failed", e); return null; });
  if (!qr) return go(req, "/?code=unknown");

  const handle = encodeURIComponent(qr.artist.slug);
  if (!isLive(qr)) return go(req, `/@${handle}?expired=1`);

  const art = qr.artwork && qr.artwork.status === "APPROVED" && qr.artwork.slug ? qr.artwork : null;
  const res = go(req, art ? `/art/${encodeURIComponent(art.slug!)}?c=${qr.code}` : `/@${handle}?c=${qr.code}`);

  const ctx = scanContext(req.headers);
  if (!ctx.bot) {
    let vid = validVisitorId(req.cookies.get(VISITOR_COOKIE)?.value);
    if (!vid) {
      vid = newVisitorId();
      // First-party, random, no personal data: only used to count unique visitors.
      res.cookies.set(VISITOR_COOKIE, vid, { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    recordScanLater({ qrCodeId: qr.id, device: ctx.device, city: ctx.city, region: ctx.region, country: ctx.country, visitorId: vid });
  }
  return res;
}

// Link checkers send HEAD: answer the same redirect, count nothing.
export async function HEAD(req: NextRequest, { params }: { params: { code: string } }) {
  const qr = await resolveCode(params.code).catch(() => null);
  if (!qr) return go(req, "/?code=unknown");
  const handle = encodeURIComponent(qr.artist.slug);
  if (!isLive(qr)) return go(req, `/@${handle}?expired=1`);
  return go(req, qr.artwork?.slug ? `/art/${encodeURIComponent(qr.artwork.slug)}?c=${qr.code}` : `/@${handle}?c=${qr.code}`);
}
