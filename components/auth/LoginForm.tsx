"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Brushed } from "@/components/af/Brush";
import { useUser } from "@/components/contexts";
import { AuthCard, Field, FormAlert, PasswordField, Spinner } from "./ui";
import { safeNext, withNext } from "./next";

const MESSAGES: Record<string, string> = {
  user_not_found: "No account with that email.",
  bad_password: "That password doesn't match.",
  missing_fields: "Enter your email and password.",
};


export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser } = useUser();
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = safeNext(params.get("next"));
  const notice = params.get("reset") ? "Password updated. Log in with the new one." : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return setError(MESSAGES.missing_fields);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, remember }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(res.status === 429 ? "Too many tries. Wait a minute and try again." : MESSAGES[data?.code] || "Couldn't log you in. Try again.");
        setBusy(false);
        return;
      }
      await refreshUser();
      const admin = String(data?.artist?.role || "").toUpperCase() === "ADMIN";
      router.push(next || (admin ? "/admin/orders" : "/studio"));
      router.refresh();
    } catch {
      setError("Couldn't reach Artfinity. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <AuthCard className="mx-auto w-full max-w-[460px]">
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <h1 className="display text-[clamp(40px,9vw,54px)]">
          Welcome <Brushed>back</Brushed>
        </h1>
        <FormAlert tone="ok">{notice}</FormAlert>
        <FormAlert>{error}</FormAlert>
        <Field label="Email" type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
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
