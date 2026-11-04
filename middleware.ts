// Passes the request path to Studio server components (layouts can't see it),
// so the login redirect can send people back where they were: /login?next=/studio/qr?art=...
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-af-path", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/studio", "/studio/:path*"] };
