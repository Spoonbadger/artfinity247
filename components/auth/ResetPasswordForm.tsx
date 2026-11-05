"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Brushed } from "@/components/af/Brush";
import { AuthCard, FormAlert, PasswordField, Spinner } from "./ui";

const DEAD_LINK = {
  missing: { title: "That link is broken", body: "It's missing part of the address. Ask for a fresh one. It only takes a second." },
  expired: { title: "That link expired", body: "Reset links work for 30 minutes. Ask for a fresh one and use it right away." },
  used: { title: "That link was already used", body: "Each link works once, and asking for a new one cancels the old ones. Ask for a fresh link, or log in if you've already set a new password." },
} as const;

export default function ResetPasswordForm({ status = "ok" }: { status?: "ok" | keyof typeof DEAD_LINK }) {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dead = !token ? DEAD_LINK.missing : status !== "ok" ? DEAD_LINK[status] : null;
  if (dead) {
    return (
      <AuthCard className="mx-auto w-full max-w-[460px]">
        <div className="grid gap-5">
          <h1 className="display text-[clamp(40px,9vw,54px)]">{dead.title}</h1>
          <p className="text-[16px] text-ink-2">{dead.body}</p>
          <Link href="/recover-password" className="btn btn-blue btn-lg w-full">Send a new link</Link>
          <Link href="/login" className="text-center text-[15px] font-semibold text-ink-2 underline underline-offset-4 hover:text-scan">Back to log in</Link>
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
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "This link has expired or was already used.");
      }
      router.push("/login?reset=1");
    } catch (err: any) {
      setError(err?.message && err.message !== "Failed to fetch" ? err.message : "Couldn't reach Artfinity. Check your connection.");
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
              <Link href="/recover-password" className="underline underline-offset-4">Send a new link</Link>
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
