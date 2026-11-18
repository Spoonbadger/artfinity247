// GET → Print codes with this piece ticked. Older "artwork is live" emails and bookmarks link here; it used to send a
// full sheet of identical gallery labels. Print codes asks for a login, then prints one card (or any number) instead.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  return NextResponse.redirect(new URL(`/studio/print?pieces=${encodeURIComponent(params.slug || "")}`, req.url), 307);
}
