"use client";

// Studio → My page → Sign-in methods: connect or disconnect Google/Apple/Facebook/Instagram, and set a password
// for accounts made with one of them. The server refuses to remove the last way to sign in.
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { PROVIDER_MARK, oauthStartHref } from "@/components/auth/SocialButtons";
import { OAUTH_ERROR_MESSAGES, PROVIDER_LABEL, isProviderId, type ProviderId } from "@/lib/oauth/meta";
import { Problem } from "@/components/studio/Problem";
import { saved } from "@/lib/feedback";

type Linked = { provider: string; email: string | null; createdAt: string | Date; lastUsedAt: string | Date | null };

const LINK_ERRORS: Record<string, string> = {
  ...OAUTH_ERROR_MESSAGES,
  provider_already_connected: "You already have one of those connected. Disconnect it first to use a different one.",
  last_method: "That's your only way to sign in. Set a password or connect another account first.",
};

export default function ConnectedAccounts({ available, initial }: { available: ProviderId[]; initial: { hasPassword: boolean; accounts: Linked[] } }) {
  const router = useRouter();
  const params = useSearchParams();
  const [hasPassword, setHasPassword] = useState(initial.hasPassword);
  const [accounts, setAccounts] = useState(initial.accounts);
  const [busy, setBusy] = useState<string | null>(null);
  // An error can carry its fix: open the set-password form, or a page that sorts it out.
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string; fix?: { label: string; href?: string; onClick?: () => void } } | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");

  // Back from a provider: ?connected=google or ?oauth_error=...
  useEffect(() => {
    const c = params.get("connected");
    const e = params.get("oauth_error");
    if (c && isProviderId(c)) setMsg({ tone: "ok", text: `${PROVIDER_LABEL[c]} is connected. You can use it to log in.` });
    else if (e) setMsg({ tone: "error", text: LINK_ERRORS[e] || OAUTH_ERROR_MESSAGES.provider_error, fix: e === "already_linked" || e === "email_in_use" ? { label: "Get help", href: "/help/account/social-sign-in" } : undefined });
  }, [params]);

  const linkedIds = accounts.map((a) => a.provider).filter(isProviderId);
  // Connected ones always show (so they can be removed), plus whatever can be connected right now.
  const rows = Array.from(new Set<ProviderId>([...available, ...linkedIds]));
  const methods = accounts.length + (hasPassword ? 1 : 0);

  async function disconnect(p: ProviderId) {
    setBusy(p);
    setMsg(null);
    try {
      const res = await fetch(`/api/auth/oauth/accounts?provider=${p}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.code === "last_method") {
          setMsg({ tone: "error", text: d.error || LINK_ERRORS.last_method, fix: { label: "Set a password", onClick: () => setPwOpen(true) } });
          return;
        }
        throw new Error(d.error || LINK_ERRORS[d.code] || "Couldn't disconnect it. Try again.");
      }
      setAccounts((xs) => xs.filter((x) => x.provider !== p));
      setMsg({ tone: "ok", text: `${PROVIDER_LABEL[p]} is disconnected.` });
      saved(`${PROVIDER_LABEL[p]} disconnected`);
      router.refresh();
    } catch (err: any) {
      setMsg({ tone: "error", text: err.message === "Failed to fetch" ? "Couldn't reach Artfinity. Check your connection." : err.message, fix: { label: "Try again", onClick: () => disconnect(p) } });
    } finally {
      setBusy(null);
    }
  }

  async function setPassword(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ tone: "error", text: "Use at least 8 characters." });
    setBusy("password");
    setMsg(null);
    try {
      const res = await fetch("/api/auth/set-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ next: pw }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          d.code === "weak_password" ? "Use at least 8 characters." : d.code === "has_password" ? "You already have a password. Use Change password." : d.code === "rate_limited" ? "Too many tries. Wait a minute." : "Couldn't save it. Try again.",
        );
      }
      setHasPassword(true);
      setPw("");
      setPwOpen(false);
      setMsg({ tone: "ok", text: "Password set. You can now log in with your email too." });
      saved("Password set");
    } catch (err: any) {
      setMsg({ tone: "error", text: err.message, fix: /already have a password/.test(err.message) ? { label: "Change password", href: "/change-password" } : undefined });
    } finally {
      setBusy(null);
    }
  }

  if (!rows.length && hasPassword) return null;

  return (
    <section id="connected" aria-labelledby="signin-h" className="grid scroll-mt-24 gap-3">
      <div className="grid gap-1">
        <h2 id="signin-h" className="text-[18px] font-bold">Sign-in methods</h2>
        <p className="text-[13.5px] text-ink-2">Log in with any of these. Keep at least one.</p>
      </div>

      {msg && <Problem tone={msg.tone === "error" ? "error" : "success"} title={msg.text} fix={msg.fix} />}

      <ul className="grid divide-y divide-line overflow-hidden rounded-2xl border-[1.5px] border-line bg-white">
        <li className="flex min-h-[60px] flex-wrap items-center gap-3 px-4 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-[1.5px] border-line text-[15px] font-bold" aria-hidden="true">@</span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px]">Email and password</b>
            <span className="block text-[13px] text-ink-2">{hasPassword ? "Set" : "No password yet"}</span>
          </span>
          {hasPassword ? (
            <a href="/change-password" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">Change password</a>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0" onClick={() => setPwOpen((o) => !o)} aria-expanded={pwOpen}>
              Set a password
            </button>
          )}
          {pwOpen && !hasPassword && (
            <form onSubmit={setPassword} className="flex basis-full flex-wrap items-end gap-2 pb-1 pt-1">
              <label className="af-field min-w-[220px] flex-1">
                <span className="label">New password · 8 or more characters</span>
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} autoFocus />
              </label>
              <button type="submit" className="btn" disabled={busy === "password"}>
                {busy === "password" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Save password
              </button>
            </form>
          )}
        </li>
        {rows.map((p) => {
          const Mark = PROVIDER_MARK[p];
          const acct = accounts.find((a) => a.provider === p);
          const last = !!acct && methods <= 1;
          return (
            <li key={p} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-[1.5px] border-line bg-white">
                <Mark className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">{PROVIDER_LABEL[p]}</b>
                <span className="block truncate text-[13px] text-ink-2">
                  {acct ? (
                    <>
                      <Check className="mr-1 inline h-3.5 w-3.5 text-earned" aria-hidden="true" />
                      Connected{acct.email ? ` · ${acct.email}` : ""}
                    </>
                  ) : (
                    "Not connected"
                  )}
                </span>
              </span>
              {acct ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0"
                  onClick={() => disconnect(p)}
                  disabled={busy === p || last}
                  title={last ? "Your only way to sign in. Set a password first." : undefined}
                >
                  {busy === p && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Disconnect
                </button>
              ) : (
                <a href={oauthStartHref(p, { mode: "link" })} className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">
                  Connect
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {methods <= 1 && accounts.length > 0 && !hasPassword && !pwOpen && (
        <Problem tone="info" title={`${PROVIDER_LABEL[linkedIds[0]] || "This account"} is your only way to log in`} fix={{ label: "Set a password", onClick: () => setPwOpen(true) }}>
          To disconnect it, set a password or connect another account first, so you can still get in.
        </Problem>
      )}
    </section>
  );
}
