// GET /api/auth/oauth-mock/authorize   DEV ONLY: the "consent screen" of the mock provider.
// 404 unless mockOAuthAllowed() (NODE_ENV !== "production" and ALLOW_MOCK_OAUTH=1).
// With ?sub=... it answers straight away (for curl/Playwright); otherwise it shows a small form to pick who to be.
import { NextResponse } from "next/server";
import { appBase } from "@/lib/oauth/flow";
import { mockOAuthAllowed } from "@/lib/oauth/mockGuard";
import { mockIssueCode } from "@/lib/oauth/providers/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET(req: Request) {
  if (!mockOAuthAllowed()) return new NextResponse("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const state = q.get("state") || "";
  const nonce = q.get("nonce") || "";
  const challenge = q.get("code_challenge") || "";
  const redirectUri = q.get("redirect_uri") || "";
  // Like a real provider: only the registered redirect URI.
  if (redirectUri !== `${appBase(req)}/api/auth/oauth/mock/callback`) return new NextResponse("redirect_uri not registered", { status: 400 });

  if (q.get("deny")) return NextResponse.redirect(`${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}`, 302);

  const sub = (q.get("sub") || "").trim();
  if (sub) {
    const code = await mockIssueCode(
      {
        sub,
        email: q.get("email")?.trim() || undefined,
        email_verified: q.get("email_verified") === "1" || q.get("email_verified") === "true",
        name: q.get("name")?.trim() || undefined,
        picture: q.get("picture")?.trim() || undefined,
        username: q.get("username")?.trim() || undefined,
      },
      nonce,
      challenge,
      redirectUri,
    );
    return NextResponse.redirect(`${redirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, 302);
  }

  const hidden = [["state", state], ["nonce", nonce], ["code_challenge", challenge], ["redirect_uri", redirectUri]]
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mock sign-in (dev only)</title>
<style>body{font:16px system-ui;max-width:440px;margin:40px auto;padding:0 16px;color:#15161b}label{display:grid;gap:4px;margin:10px 0;font-weight:600}
input[type=text],input[type=email]{font:inherit;padding:10px;border:2px solid #15161b;border-radius:10px}button{font:inherit;font-weight:700;padding:12px 18px;border-radius:999px;border:2px solid #15161b;background:#15161b;color:#fff;cursor:pointer}
.row{display:flex;gap:8px;align-items:center;font-weight:600}.note{background:#fff3c4;padding:10px;border-radius:10px;font-size:14px}</style></head>
<body><h1>Mock provider</h1><p class="note">Development only. Pretend to be any account to test sign-in, linking and sign-up.</p>
<form method="get">${hidden}
<label>Account id (sub)<input type="text" name="sub" value="mock-${Math.random().toString(36).slice(2, 8)}" required></label>
<label>Email<input type="email" name="email" placeholder="leave empty to act like Instagram"></label>
<div class="row"><input type="checkbox" id="ev" name="email_verified" value="1" checked><label for="ev" style="margin:0">Provider says the email is verified</label></div>
<label>Name<input type="text" name="name" value="Test Artist"></label>
<label>Instagram username (optional)<input type="text" name="username"></label>
<label>Picture URL (optional)<input type="text" name="picture" placeholder="${esc(appBase(req))}/seed/art-01.jpg"></label>
<p style="display:flex;gap:8px"><button type="submit">Continue</button><button type="submit" name="deny" value="1" style="background:#fff;color:#15161b">Cancel</button></p>
</form></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
