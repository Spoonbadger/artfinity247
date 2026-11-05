// Shared by the /api/studio/stripe/* routes: who's asking, and where to send them.
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ConnectError } from "@/lib/stripeConnect";

/** Runs `next` for the signed-in artist and redirects (303) to the URL it returns. Errors go back to Money. */
export async function go(req: NextRequest, next: (artistId: string) => Promise<string>) {
  const user = await requireUser().catch(() => null);
  if (!user?.id) return NextResponse.redirect(new URL("/login?next=/studio/money", req.url), 303);
  try {
    return NextResponse.redirect(new URL(await next(user.id), req.url), 303);
  } catch (err) {
    console.error("[stripe connect]", err);
    const code = err instanceof ConnectError ? "off" : "error";
    return NextResponse.redirect(new URL(`/studio/money?stripe=${code}`, req.url), 303);
  }
}
