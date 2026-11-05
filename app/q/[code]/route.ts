// GET /q/<CODE> (any case; /Q/<CODE> is rewritten here by middleware.ts).
// Printed QR codes hold only this short link, so the artist can change what's behind it after printing.
//   unknown code       → 302 /?code=unknown
//   ended or inactive  → 302 /@handle?expired=1
//   live               → record the scan (in the background), 302 /@handle/art/<slug>?c=<CODE> or /@handle?c=<CODE>
import { NextRequest, NextResponse } from "next/server";
import { artistPath, artPath } from "@/lib/urls";
import { CODE_COOKIE, isLive, newVisitorId, recordScanLater, resolveCode, scanContext, validVisitorId, VISITOR_COOKIE } from "@/lib/shortlinks";

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
  // A closed or suspended account's codes go nowhere (its page is offline).
  if (!qr || qr.artist.closedAt || qr.artist.suspendedAt) return go(req, "/?code=unknown");

  const handle = qr.artist.slug;
  if (!isLive(qr)) return go(req, `${artistPath(handle)}?expired=1`);

  const art = qr.artwork && qr.artwork.status === "APPROVED" && qr.artwork.slug ? qr.artwork : null;
  // Straight to the artist-handle URL (no second hop through /art/<slug>).
  const res = go(req, art ? `${artPath(handle, art.slug!)}?c=${qr.code}` : `${artistPath(handle)}?c=${qr.code}`);

  // Remember the code for a week so a sale a few clicks later is still credited to it.
  res.cookies.set(CODE_COOKIE, qr.code, { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 7 });

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
  if (!qr || qr.artist.closedAt || qr.artist.suspendedAt) return go(req, "/?code=unknown");
  const handle = qr.artist.slug;
  if (!isLive(qr)) return go(req, `${artistPath(handle)}?expired=1`);
  return go(req, qr.artwork?.slug ? `${artPath(handle, qr.artwork.slug)}?c=${qr.code}` : `${artistPath(handle)}?c=${qr.code}`);
}
