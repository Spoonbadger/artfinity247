"use client";

// Small client islands for /collector: sign in, sign out, unfollow / resubscribe, remove from wishlist, delete the collection.
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Heart } from "lucide-react";

const post = async (url: string, method: string, body?: unknown) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong. Try again.");
  return d;
};

export function SignInForm({ next, defaultEmail = "" }: { next: string; defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const website = (new FormData(e.currentTarget).get("website") as string) || "";
    setBusy(true);
    setError(null);
    try {
      const d = await post("/api/collector/sign-in", "POST", { email: email.trim(), next, website });
      setMessage(d.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (message)
    return (
      <div className="grid gap-3 rounded-2xl border border-line bg-white p-5" aria-live="polite">
        <h2 className="text-[20px] font-bold">Check your email</h2>
        <p className="text-[15.5px] text-ink-2">{message}</p>
        <button type="button" onClick={() => setMessage(null)} className="btn btn-ghost btn-sm w-fit min-h-[44px] px-5">Use another email</button>
      </div>
    );
  return (
    <form onSubmit={submit} className="relative grid gap-3 rounded-2xl border border-line bg-white p-5">
      <label className="af-field">
        <span className="label">Email you used at checkout</span>
        <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-px w-px opacity-0" />
      {error && <p role="alert" className="text-[14px] font-semibold text-coral">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-blue w-full py-3 text-[16px]">{busy ? "Sending…" : "Email me a sign-in link"}</button>
      <p className="text-center text-[12.5px] text-ink-2">No password. The link works once, for 15 minutes.</p>
    </form>
  );
}

export function SignOutButton({ className = "btn btn-ghost btn-sm min-h-[44px] px-4" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        await post("/api/collector/sign-out", "POST").catch(() => {});
        window.location.href = "/";
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function FollowToggle({ id, following, name }: { id: string; following: boolean; name: string }) {
  const router = useRouter();
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);
  const flip = async () => {
    setBusy(true);
    try {
      const d = await post("/api/collector/follows", "POST", { id, action: on ? "unfollow" : "resubscribe" });
      setOn(!!d.following);
      toast.success(d.following ? `You'll hear about new work from ${name}` : `Unfollowed ${name}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={flip} disabled={busy} aria-label={on ? `Unfollow ${name}` : `Follow ${name} again`} className={on ? "btn btn-ghost btn-sm min-h-[40px] px-3.5" : "btn btn-blue btn-sm min-h-[40px] px-3.5"}>
      {on ? "Unfollow" : "Resubscribe"}
    </button>
  );
}

export function RemoveSaved({ artworkId, title }: { artworkId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Remove ${title} from your wishlist`}
      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ink-2 hover:bg-wall hover:text-ink"
      onClick={async () => {
        setBusy(true);
        try {
          await post("/api/collector/wishlist", "DELETE", { artworkId });
          router.refresh();
        } catch (e) {
          toast.error((e as Error).message);
          setBusy(false);
        }
      }}
    >
      <Heart className="h-4 w-4 fill-[rgb(var(--af-coral-rgb))] text-[rgb(var(--af-coral-rgb))]" aria-hidden /> {busy ? "Removing…" : "Remove"}
    </button>
  );
}

export function DeleteCollection({ email }: { email: string }) {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!sure)
    return (
      <button type="button" onClick={() => setSure(true)} className="btn btn-ghost btn-sm w-fit min-h-[44px] border-coral px-4 text-coral">
        Delete my collection
      </button>
    );
  return (
    <div className="grid gap-3 rounded-2xl border-[1.5px] border-coral bg-white p-4" role="alertdialog" aria-labelledby="del-h" aria-describedby="del-p">
      <b id="del-h" className="text-[16px]">Delete the collection for {email}?</b>
      <p id="del-p" className="text-[14.5px] text-ink-2">Your wishlist goes, and you&apos;re signed out. Orders stay on record for accounting, and the links in your order emails keep working.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="btn btn-sm min-h-[44px] border-coral bg-coral px-4 text-white"
          onClick={async () => {
            setBusy(true);
            try {
              await post("/api/collector/account", "DELETE");
              window.location.href = "/collector/sign-in?deleted=1";
            } catch (e) {
              toast.error((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "Deleting…" : "Yes, delete it"}
        </button>
        <button type="button" onClick={() => setSure(false)} className="btn btn-ghost btn-sm min-h-[44px] px-4">Keep it</button>
      </div>
    </div>
  );
}

/** /collector/verify: posts the one-time link token (so email scanners that open links can't use it up). */
export function VerifyLink({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState("");
  const go = async () => {
    setState("busy");
    try {
      const d = await post("/api/collector/verify", "POST", { t: token });
      window.location.replace(d.next || "/collector");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  };
  if (state === "error")
    return (
      <div className="grid justify-items-center gap-3" role="alert">
        <p className="text-[17px] text-ink-2">{error}</p>
        <a href="/collector/sign-in" className="btn btn-blue">Get a new link</a>
      </div>
    );
  return (
    <button type="button" onClick={go} disabled={state === "busy"} className="btn btn-blue btn-lg" autoFocus>
      {state === "busy" ? "Opening…" : "Open my collection"}
    </button>
  );
}
