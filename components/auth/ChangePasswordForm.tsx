"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Brushed } from "@/components/af/Brush";
import { useUser } from "@/components/contexts";
import { AuthCard, FormAlert, PasswordField, Spinner } from "./ui";

const MESSAGES: Record<string, string> = {
  bad_password: "Your current password doesn't match.",
  weak_password: "Use at least 8 characters for the new one.",
  missing_fields: "Fill in both passwords.",
  not_logged_in: "Log in first, then change your password.",
  rate_limited: "Too many tries. Wait a minute and try again.",
  has_password: "You already have a password. Refresh and change it instead.",
};

export default function ChangePasswordForm() {
  const { currentUser, loading } = useUser();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Accounts made with Google/Apple/... have no password yet: they set one (no "current" to type).
  const [hasPassword, setHasPassword] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    fetch("/api/auth/oauth/accounts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setHasPassword(d.hasPassword !== false))
      .catch(() => {});
  }, [currentUser]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if ((hasPassword && !current) || !next) return setError(MESSAGES.missing_fields);
    if (next.length < 8) return setError(MESSAGES.weak_password);
    setBusy(true);
    try {
      const res = await fetch(hasPassword ? "/api/auth/change-password" : "/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hasPassword ? { current, next } : { next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(MESSAGES[data?.code] || "Couldn't change it. Try again.");
      setDone(true);
      setHasPassword(true);
      setCurrent("");
      setNext("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !currentUser) {
    return (
      <AuthCard className="mx-auto w-full max-w-[460px]">
        <div className="grid gap-5">
          <h1 className="display text-[clamp(40px,9vw,54px)]">Log in first</h1>
          <p className="text-[16px] text-ink-2">Forgot your password? We can email you a link instead.</p>
          <Link href="/login?next=/change-password" className="btn btn-blue btn-lg w-full">Log in</Link>
          <Link href="/recover-password" className="text-center text-[15px] font-semibold text-ink-2 underline underline-offset-4 hover:text-scan">Email me a reset link</Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard className="mx-auto w-full max-w-[460px]">
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <h1 className="display text-[clamp(40px,9vw,54px)]">
          {hasPassword ? <>Change your <Brushed>password</Brushed></> : <>Set a <Brushed>password</Brushed></>}
        </h1>
        {!hasPassword && !done && <p className="text-[15px] text-ink-2">You log in with a connected account. Add a password to log in with your email too.</p>}
        <FormAlert tone="ok">{done ? "Saved. Use the new password next time." : null}</FormAlert>
        <FormAlert>
          {error && (
            <>
              {error}
              {error === MESSAGES.bad_password && (
                <> <Link href="/recover-password" className="whitespace-nowrap underline underline-offset-4">Forgot it? Reset it by email</Link></>
              )}
              {error === MESSAGES.not_logged_in && (
                <> <Link href="/login?next=/change-password" className="underline underline-offset-4">Log in</Link></>
              )}
              {error === MESSAGES.has_password && (
                <> <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-4">Refresh</button></>
              )}
            </>
          )}
        </FormAlert>
        {hasPassword && <PasswordField label="Current password" name="current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />}
        <PasswordField label="New password" name="next" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint="8 or more characters" required minLength={8} />
        <button type="submit" className="btn btn-blue btn-lg w-full" disabled={busy}>
          {busy && <Spinner />}
          Save new password
        </button>
        <p className="text-center text-[15px] text-ink-2">
          <Link href="/studio" className="font-bold text-ink underline decoration-2 underline-offset-4 hover:text-scan">Back to Studio</Link>
          <span className="mx-2" aria-hidden="true">·</span>
          <Link href="/recover-password" className="font-semibold underline underline-offset-4 hover:text-scan">Forgot it?</Link>
        </p>
      </form>
    </AuthCard>
  );
}
