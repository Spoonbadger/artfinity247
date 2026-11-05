"use client";

// Bottom-of-page delete for one painting (the edit page). Asks once, then goes back to My art with a toast.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";

export default function DeleteArtwork({ slug, title, sold }: { slug: string; title: string; sold: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/artworks/${encodeURIComponent(slug)}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const p = await problemFrom(res, `Couldn't delete ${title}. Try again.`);
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : remove });
        return;
      }
      saved(`Deleted ${title}`, { description: sold > 0 ? "Past sales stay in your records." : undefined, next: { label: "Upload art", href: "/studio/art/new" } });
      router.push("/studio/art");
      router.refresh();
    } catch (e) {
      failed(errorText(e, `Couldn't delete ${title}. Try again.`), { retry: remove });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="delete-h" className="grid gap-2 border-t border-line pt-6">
      <h2 id="delete-h" className="text-[16px] font-bold">Delete this piece</h2>
      {asking ? (
        <div role="alertdialog" aria-labelledby="delete-q" className="grid justify-items-start gap-3 rounded-xl border border-coral/50 bg-coral/10 p-4">
          <p id="delete-q" className="text-[14.5px]">
            <b>Delete {title} for good?</b> Its page goes away and its QR code opens your main page instead.{sold > 0 && " Past sales stay in your records."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm border-coral bg-coral" disabled={busy} onClick={remove} autoFocus>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              {busy ? "Deleting" : "Delete"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setAsking(false)}>Keep it</button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" className="btn btn-ghost btn-sm text-coral hover:border-coral" onClick={() => setAsking(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />Delete
          </button>
        </div>
      )}
    </section>
  );
}
