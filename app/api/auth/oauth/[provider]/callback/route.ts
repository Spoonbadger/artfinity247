// GET  /api/auth/oauth/[provider]/callback?code=&state=     Google, Facebook, Instagram, mock
// POST /api/auth/oauth/[provider]/callback  (form_post)     Apple
// Checks state against the af_oauth cookie, exchanges the code (PKCE / nonce / ID-token checks live in
// lib/oauth/providers), then logs in, links, or hands a new person to sign-up (lib/oauth/account.ts).
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { issueSession, linkToArtist, resolveSignIn } from "@/lib/oauth/account";
import { FLOW_COOKIE, appBase, flowCookieOptions, openFlow, readCookie, redirectUri, safeEqual, sealSignup, signupCookieOptions } from "@/lib/oauth/flow";
import { getProvider, ProviderError } from "@/lib/oauth/providers";
import { isProviderId } from "@/lib/oauth/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request, providerParam: string, q: URLSearchParams, form: URLSearchParams | null) {
  const base = appBase(req);
  const flow = await openFlow(readCookie(req, FLOW_COOKIE));
  const linking = flow?.mode === "link";
  const go = (path: string) => {
    // 303 so Apple's POST becomes a GET.
    const res = NextResponse.redirect(`${base}${path}`, 303);
    // The flow cookie is single-use, whatever happened.
    if (isProviderId(providerParam)) res.cookies.set({ ...flowCookieOptions(providerParam), value: "", maxAge: 0 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  const fail = (code: string) => {
    if (linking) return go(`/studio/page?oauth_error=${code}#connected`);
    const n = flow?.next ? `&next=${encodeURIComponent(flow.next)}` : "";
    return go(`/login?oauth_error=${code}${n}`);
  };

  const provider = getProvider(providerParam);
  if (!provider) return fail("unavailable");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`oauth-callback:${ip}`)) return new NextResponse("Too many requests", { status: 429 });

  // The person said no (access_denied / user_cancelled_authorize) or the provider errored.
  if (q.get("error")) return fail(/denied|cancel/i.test(q.get("error") || "") ? "cancelled" : "provider_error");
  if (!flow || flow.provider !== provider.id) return fail("expired");
  if (!safeEqual(q.get("state") || "", flow.state)) return fail("state_mismatch");
  const code = q.get("code");
  if (!code) return fail("provider_error");

  let profile;
  try {
    profile = await provider.exchange({ code, verifier: flow.verifier, nonce: flow.nonce, redirectUri: redirectUri(req, provider.id), form });
  } catch (e) {
    console.error(`[oauth] ${provider.id} exchange failed:`, e instanceof ProviderError ? e.code : "", (e as Error)?.message);
    return fail("provider_error");
  }

  // ---- Studio "Connect" ----
  if (linking) {
    const me = await requireUser().catch(() => null); // same check as the start of the flow: not paused or closed
    if (!me?.id || me.id !== flow.linkArtistId) return fail("not_logged_in");
    const r = await linkToArtist(me.id, provider.id, profile);
    if (!r.ok) return fail(r.code);
    return go(`/studio/page?connected=${provider.id}#connected`);
  }

  // ---- Continue with <provider> ----
  const r = await resolveSignIn(provider.id, profile);
  if (r.kind === "blocked") return fail(r.code);
  if (r.kind === "email_in_use") return fail("email_in_use");
  if (r.kind === "signup") {
    const q2 = new URLSearchParams({ oauth: provider.id });
    if (flow.handle) q2.set("handle", flow.handle);
    if (flow.ref) q2.set("ref", flow.ref);
    if (flow.next) q2.set("next", flow.next);
    const res = go(`/register?${q2}`);
    res.cookies.set({ ...signupCookieOptions, value: await sealSignup(r.pending) });
    return res;
  }
  const admin = String(r.artist.role).toUpperCase() === "ADMIN";
  const res = go(flow.next || (admin ? "/admin/orders" : "/studio"));
  await issueSession(res, r.artist, req, "login");
  // A half-finished sign-up from earlier is moot now.
  res.cookies.set({ ...signupCookieOptions, value: "", maxAge: 0 });
  return res;
}

export async function GET(req: Request, { params }: { params: { provider: string } }) {
  return handle(req, params.provider, new URL(req.url).searchParams, null);
}

// Apple's response_mode=form_post. Only Apple uses it; anything else posting here is refused.
export async function POST(req: Request, { params }: { params: { provider: string } }) {
  if (params.provider !== "apple") return new NextResponse("Method not allowed", { status: 405 });
  let form: URLSearchParams;
  try {
    const fd = await req.formData();
    form = new URLSearchParams();
    fd.forEach((v, k) => typeof v === "string" && form.set(k, v));
  } catch {
    form = new URLSearchParams();
  }
  return handle(req, params.provider, form, form);
}
