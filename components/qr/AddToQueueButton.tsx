"use client";
// "Add its code to the print queue" for one piece (after upload): its plain code, in the artist's last-used look.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ListPlus, Loader2 } from "lucide-react";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export default function AddToQueueButton({ slug, title, className, label = "Add its code to the print queue" }: { slug: string; title: string; className?: string; label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"" | "busy" | "done">("");
  async function add() {
    setState("busy");
    try {
      const r = await fetch("/api/studio/print-queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs: [slug], look: "last" }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't add it to your print queue. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : add });
        setState("");
        return;
      }
      const j = await r.json().catch(() => ({}));
      saved(`${title}'s code is in your print queue`, { description: `As a ${String(j.formatName || "card").toLowerCase()}. Print it with the rest, or have us mail it.`, next: { label: "Open print queue", href: "/studio/qr/queue" } });
      setState("done");
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Couldn't add it to your print queue. Try again."), { retry: add });
      setState("");
    }
  }
  if (state === "done") {
    return <Link href="/studio/qr/queue" className={cn("btn btn-ghost", className)}><Check className="h-4 w-4" aria-hidden="true" />In your print queue</Link>;
  }
  return (
    <button type="button" className={cn("btn btn-ghost", className)} onClick={add} disabled={state === "busy"}>
      {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ListPlus className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
  );
}
