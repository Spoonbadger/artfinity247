"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brushed } from "@/components/af/Brush";
import { AuthCard, Field, FormAlert, Spinner } from "./ui";

export default function RecoverPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter the email you signed up with.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.status === 429) throw new Error("Too many tries. Wait a minute and try again.");
      if (!res.ok) throw new Error("Something went wrong. Try again.");
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard className="mx-auto w-full max-w-[460px]">
      {sent ? (
        <div className="grid gap-5" role="status">
          <h1 className="display text-[clamp(40px,9vw,54px)]">
            Check your <Brushed>email</Brushed>
          </h1>
          <p className="text-[16px] text-ink-2">
            If <b className="text-ink">{email.trim()}</b> has a page, a reset link is on its way. It works for 30 minutes.
          </p>
          <Link href="/login" className="btn btn-ghost w-full">Back to log in</Link>
          <button type="button" onClick={() => setSent(false)} className="text-[14.5px] font-semibold text-ink-2 underline underline-offset-4 hover:text-scan">
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <h1 className="display text-[clamp(40px,9vw,54px)]">
            Forgot your <Brushed>password?</Brushed>
          </h1>
          <p className="-mt-2 text-[16px] text-ink-2">We'll email you a link to set a new one.</p>
          <FormAlert>{error}</FormAlert>
          <Field label="Email" type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          <button type="submit" className="btn btn-blue btn-lg w-full" disabled={busy}>
            {busy && <Spinner />}
            Send the link
          </button>
          <p className="text-center text-[15px] text-ink-2">
            Remembered it?{" "}
            <Link href="/login" className="font-bold text-ink underline decoration-2 underline-offset-4 hover:text-scan">Log in</Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
