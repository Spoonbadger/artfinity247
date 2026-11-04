"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Brushed } from "@/components/af/Brush";
import { AuthCard, FormAlert, PasswordField, Spinner } from "./ui";

export default function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthCard className="mx-auto w-full max-w-[460px]">
        <div className="grid gap-5">
          <h1 className="display text-[clamp(40px,9vw,54px)]">That link is broken</h1>
          <p className="text-[16px] text-ink-2">Ask for a fresh one. It only takes a second.</p>
          <Link href="/recover-password" className="btn btn-blue btn-lg w-full">Send a new link</Link>
        </div>
      </AuthCard>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) throw new Error();
      router.push("/login?reset=1");
    } catch {
      setError("This link has expired or was already used.");
      setBusy(false);
    }
  }

  return (
    <AuthCard className="mx-auto w-full max-w-[460px]">
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <h1 className="display text-[clamp(40px,9vw,54px)]">
          Pick a new <Brushed>password</Brushed>
        </h1>
        <FormAlert>
          {error && (
            <>
              {error}{" "}
              <Link href="/recover-password" className="underline underline-offset-4">Get a new link</Link>
            </>
          )}
        </FormAlert>
        <PasswordField label="New password" name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="8 or more characters" autoFocus required minLength={8} />
        <button type="submit" className="btn btn-blue btn-lg w-full" disabled={busy}>
          {busy && <Spinner />}
          Save and log in
        </button>
      </form>
    </AuthCard>
  );
}
