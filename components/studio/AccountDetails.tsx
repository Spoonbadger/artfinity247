"use client";

import { FormEvent, InputHTMLAttributes, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Lock } from "lucide-react";
import { useUser } from "@/components/contexts";
import { checks } from "@/lib/smartFields";
import { stateCode } from "@/lib/places";

export type Account = { first_name: string; last_name: string; email: string; phone: string; state: string };
type Key = keyof Account;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Private legal details: never shown on the public page. */
export default function AccountDetails({ initial }: { initial: Account }) {
  const router = useRouter();
  const { refreshUser } = useUser();
  const [saved, setSaved] = useState(initial);
  const [a, setA] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ msg: string; field?: Key } | null>(null);
  const changed = (Object.keys(a) as Key[]).filter((k) => a[k].trim() !== saved[k]);
  const dirty = changed.length > 0;

  function set(k: Key, v: string) {
    setA((x) => ({ ...x, [k]: v }));
    if (error?.field === k) setError(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!a.first_name.trim()) return setError({ msg: "Add your first name.", field: "first_name" });
    if (!a.last_name.trim()) return setError({ msg: "Add your last name.", field: "last_name" });
    if (!EMAIL_RE.test(a.email.trim())) return setError({ msg: "Enter a real email.", field: "email" });
    setSaving(true);
    try {
      const body: Partial<Account> = {};
      for (const k of changed) body[k] = a[k].trim();
      const res = await fetch("/api/studio/account", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setError({ msg: d.error || "Could not save. Try again.", field: d.field });
      const next: Account = {
        first_name: d.account.first_name ?? "",
        last_name: d.account.last_name ?? "",
        email: d.account.email ?? "",
        phone: d.account.phone ?? "",
        state: d.account.state ?? "",
      };
      setA(next);
      setSaved(next);
      if (body.email && !d.emailVerified) {
        toast.success("Saved. Confirm your new email", { description: `We sent a link to ${next.email}. Payouts and newsletters wait until you click it.`, duration: 8000 });
      } else toast.success("Account details saved");
      if (body.email) refreshUser();
      router.refresh();
    } catch {
      setError({ msg: "Couldn't reach Artfinity. Check your connection." });
    } finally {
      setSaving(false);
    }
  }

  const field = (k: Key, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={"af-field" + (error?.field === k ? " !border-coral" : "")}>
      <span className="label">{label}</span>
      <input
        name={k}
        value={a[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={error?.field === k || undefined}
        aria-describedby={error?.field === k ? "acct-err" : undefined}
        {...props}
      />
    </label>
  );

  return (
    <section id="account-details" aria-labelledby="acct-details-h" className="grid scroll-mt-24 gap-4">
      <div className="grid gap-1">
        <h2 id="acct-details-h" className="t-card">Account details</h2>
        <p className="flex items-center gap-1.5 text-[13.5px] text-ink-2">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Private. For payouts and tax only.
        </p>
      </div>
      <form onSubmit={save} className="grid gap-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("first_name", "Legal first name", { autoComplete: "given-name", maxLength: 60, required: true })}
          {field("last_name", "Legal last name", { autoComplete: "family-name", maxLength: 60, required: true })}
        </div>
        {field("email", "Email", { type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "none", spellCheck: false, maxLength: 254, required: true, onBlur: (e) => { const m = e.target.value.trim() ? checks.email(e.target.value) : null; if (m) setError({ msg: m, field: "email" }); } })}
        {/* No phone field: Artfinity contacts people by email only. A phone already on file is kept, not shown. */}
        <div className="grid gap-3 sm:max-w-[200px]">
          {field("state", "State", { autoComplete: "address-level1", autoCapitalize: "characters", maxLength: 40, placeholder: "NY", onBlur: (e) => { const c = stateCode(e.target.value); if (c && c !== a.state) set("state", c); } })}
        </div>
        {error && (
          <p id="acct-err" role="alert" className="rounded-xl border-2 border-coral bg-[#fff1ed] px-3.5 py-2.5 text-[14px] font-semibold">
            {error.msg}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn" disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Save details
          </button>
          {!dirty && !saving && (
            <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
              <Check className="h-4 w-4" aria-hidden="true" />All saved
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
