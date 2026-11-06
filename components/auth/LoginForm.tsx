"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Brushed } from "@/components/af/Brush";
import { useUser } from "@/components/contexts";
import { AuthCard, Field, FormAlert, PasswordField, Spinner } from "./ui";
import { safeNext, withNext } from "./next";
import SocialButtons, { OrDivider } from "./SocialButtons";
import { OAUTH_ERROR_MESSAGES, PROVIDER_LABEL, isProviderId, type ProviderId } from "@/lib/oauth/meta";

const MESSAGES: Record<string, string> = {
  user_not_found: "No account with that email.",
  bad_password: "That password doesn't match.",
  missing_fields: "Enter your email and password.",
  account_closed: "This account is closed — contact us to reopen.",
  account_suspended: "This account is paused — contact us.",
};

type LoginError = { text: string; link?: { label: string; href: string } };
const CONTACT = { label: "Contact us", href: "/contact" };

/** Social sign-in errors (?oauth_error=) that have a next step beyond "try the button again". */
function oauthError(code: string, email: string): LoginError {
  const text = OAUTH_ERROR_MESSAGES[code] || OAUTH_ERROR_MESSAGES.provider_error;
  if (code === "account_closed") return { text: "This account is closed. We can reopen it for you.", link: CONTACT };
  if (code === "account_suspended") return { text: "This account is paused. Message us and we'll sort it out.", link: CONTACT };
  if (code === "email_in_use") return { text, link: { label: "Forgot your password?", href: withNext("/recover-password", null, { email }) } };
  if (code === "already_linked") return { text, link: { label: "Help with social sign-in", href: "/help/account/social-sign-in" } };
  return { text };
}


export default function LoginForm({ providers = [] }: { providers?: ProviderId[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser } = useUser();
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  // ?oauth_error= from our social sign-in callback; ?error= in case a provider or an old link sends people back with it.
  const oauthErrorCode = params.get("oauth_error") || params.get("error");
  const [error, setError] = useState<LoginError | null>(oauthErrorCode ? oauthError(oauthErrorCode, params.get("email") || "") : null);
  const next = safeNext(params.get("next"));
  const closed = !!params.get("closed");
  const notice = params.get("reset")
    ? "Password updated. Log in with the new one."
    : closed
      ? <>Your account is closed. You&apos;ll still be paid what you&apos;ve earned. Want it back? <Link href="/contact" className="underline underline-offset-4">Contact us</Link> to reopen it.</>
      : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return setError({ text: MESSAGES.missing_fields });
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, remember }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.code as string | undefined;
        const typed = email.trim();
        const reset = withNext("/recover-password", next, { email: typed });
        if (res.status === 429) setError({ text: "Too many tries. Wait a minute and try again.", link: { label: "Reset your password instead", href: reset } });
        else if (code === "bad_password") setError({ text: MESSAGES.bad_password, link: { label: "Forgot it? Reset your password", href: reset } });
        else if (code === "user_not_found") setError({ text: `${MESSAGES.user_not_found} Check the spelling, or make a page with it.`, link: { label: "Claim your page", href: withNext("/register", next) } });
        else if (code === "social_only") {
          const names = ((data?.providers as string[]) || []).filter(isProviderId).map((p) => PROVIDER_LABEL[p]);
          setError(
            names.length
              ? { text: `This account logs in with ${names.join(" or ")}, not a password${providers.length ? ": use the button above" : ""}. Once you're in, you can add a password in Studio → My page.`, link: { label: `Can't use ${names[0]}? Contact us`, href: "/contact" } }
              : { text: "This account has no password yet. We can email you a link to set one.", link: { label: "Email me a link", href: reset } },
          );
        } else if (code === "account_closed" || code === "account_suspended") setError(oauthError(code, typed));
        else setError({ text: data?.error || MESSAGES[code || ""] || "Couldn't log you in. Try again." });
        setBusy(false);
        return;
      }
      await refreshUser();
      const admin = String(data?.artist?.role || "").toUpperCase() === "ADMIN";
      router.push(next || (admin ? "/admin/orders" : "/studio"));
      router.refresh();
    } catch {
      setError({ text: "Couldn't reach Artfinity. Check your connection." });
      setBusy(false);
    }
  }

  return (
    <AuthCard className="mx-auto w-full max-w-[460px]">
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <h1 className="t-page">
          Welcome <Brushed>back</Brushed>
        </h1>
        <FormAlert tone="ok">{notice}</FormAlert>
        <FormAlert>
          {error && (
            <>
              {error.text}
              {error.link && (
                <>
                  {" "}
                  <Link href={error.link.href} className="whitespace-nowrap underline underline-offset-4 hover:text-scan">{error.link.label}</Link>
                </>
              )}
            </>
          )}
        </FormAlert>
        {providers.length > 0 && (
          <>
            <SocialButtons providers={providers} next={next} />
            <OrDivider />
          </>
        )}
        <Field label="Email" type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!providers.length} required />
        <PasswordField label="Password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="flex flex-wrap items-center justify-between gap-3 text-[14.5px]">
          <label className="flex cursor-pointer select-none items-center gap-2 font-semibold">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--af-scan)]" />
            Keep me logged in
          </label>
          <Link href={withNext("/recover-password", next, { email: email.trim() })} className="font-semibold text-ink-2 underline underline-offset-4 hover:text-scan">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className="btn btn-blue btn-lg w-full" disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Logging in" : "Log in"}
        </button>
        <p className="text-center text-[15px] text-ink-2">
          New here?{" "}
          <Link href={withNext("/register", next)} className="font-bold text-ink underline decoration-2 underline-offset-4 hover:text-scan">
            Claim your page
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
