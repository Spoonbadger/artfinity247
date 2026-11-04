// Passes the request path to Studio server components (layouts can't see it),
// so the login redirect can send people back where they were: /login?next=/studio/qr?art=...
// Also: printed QR codes hold upper-case links (HTTPS://THEARTFINITY.COM/Q/K7P2, smaller codes),
// and routes are case-sensitive, so /Q/<code> is rewritten to the short-link route at /q/<code>.
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/Q/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/q/" + pathname.slice(3);
    return NextResponse.rewrite(url);
  }
  const headers = new Headers(req.headers);
  headers.set("x-af-path", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/studio", "/studio/:path*", "/Q/:path*"] };
