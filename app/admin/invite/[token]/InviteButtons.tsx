"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function AcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="btn btn-blue"
      onClick={async () => {
        setBusy(true);
        try {
          const r = await fetch(`/api/admin/invite/${encodeURIComponent(token)}`, { method: "POST" });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || "");
          toast.success("Welcome to the team");
          router.push("/admin");
          router.refresh();
        } catch (e: any) {
          toast.error(e?.message || "Couldn't accept the invite.");
          setBusy(false);
        }
      }}
    >
      {busy ? "Joining…" : "Accept and open the admin"}
    </button>
  );
}

export function ResendConfirmButton() {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  return (
    <button
      type="button"
      disabled={state !== "idle"}
      className="btn btn-ghost"
      onClick={async () => {
        setState("busy");
        const r = await fetch("/api/auth/verify-email/resend", { method: "POST" }).catch(() => null);
        if (r?.ok) { setState("sent"); toast.success("Confirmation link sent. Click it, then come back here."); }
        else { setState("idle"); toast.error(r?.status === 429 ? "Too many tries. Wait a bit." : "Couldn't send it."); }
      }}
    >
      {state === "sent" ? "Sent: check your inbox" : state === "busy" ? "Sending…" : "Send the confirmation link again"}
    </button>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button type="button" className="btn btn-ghost" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => null); router.refresh(); }}>
      Log out
    </button>
  );
}
