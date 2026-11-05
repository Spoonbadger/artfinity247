// GET /api/auth/oauth/[provider]?next=/studio&handle=&ref=      start "Continue with <provider>"
// GET /api/auth/oauth/[provider]?mode=link                       Studio "Connect" (must be logged in)
// Sets the short-lived af_oauth cookie (state, PKCE verifier, nonce) and sends the browser to the provider.
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { appBase, cleanNext, flowCookieOptions, pkcePair, randomToken, redirectUri, sealFlow } from "@/lib/oauth/flow";
import { getProvider } from "@/lib/oauth/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const url = new URL(req.url);
  const base = appBase(req);
  const next = cleanNext(url.searchParams.get("next"));
  const mode = url.searchParams.get("mode") === "link" ? "link" : "login";
  const back = (code: string) =>
    NextResponse.redirect(mode === "link" ? `${base}/studio/page?oauth_error=${code}#connected` : `${base}/login?oauth_error=${code}`, 302);

  const provider = getProvider(params.provider);
  if (!provider) return back("unavailable");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`oauth-start:${ip}`)) return new NextResponse("Too many requests", { status: 429 });

  let linkArtistId: string | null = null;
  if (mode === "link") {
    try {
      linkArtistId = (await requireUser()).id;
    } catch {
      return NextResponse.redirect(`${base}/login?next=${encodeURIComponent("/studio/page")}&oauth_error=not_logged_in`, 302);
    }
  }

  const handle = (url.searchParams.get("handle") || "").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 30) || null;
  const ref = (url.searchParams.get("ref") || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 24) || null;
  const state = randomToken();
  const nonce = randomToken();
  const pkce = provider.pkce ? pkcePair() : null;

  const flow = await sealFlow({ provider: provider.id, state, nonce, verifier: pkce?.verifier ?? null, next, mode, linkArtistId, handle, ref });
  const res = NextResponse.redirect(
    provider.authorizationUrl({ state, nonce, challenge: pkce?.challenge ?? "", redirectUri: redirectUri(req, provider.id) }),
    302,
  );
  res.cookies.set({ ...flowCookieOptions(provider.id), value: flow });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
