"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dabs } from "@/components/reviews/ReviewStars";

export type AdminReview = {
  id: string;
  rating: number;
  body: string;
  buyerName: string;
  buyerCity: string | null;
  buyerEmail: string;
  photoUrl: string | null;
  status: string;
  createdAt: string;
  artistReply: string | null;
  artworkTitle: string | null;
  artworkSlug: string | null;
  artistName: string;
  artistSlug: string;
  orderId: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  flagged: { label: "Held", cls: "bg-coral/15 text-coral" },
  published: { label: "Live", cls: "bg-earned-soft text-earned" },
  hidden: { label: "Hidden", cls: "bg-ink/10 text-ink-2" },
};

export default function ReviewsAdmin({ reviews: initial }: { reviews: AdminReview[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const setStatus = async (r: AdminReview, status: "published" | "hidden") => {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/reviews/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "");
      setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
      toast.success(status === "published" ? "Published" : "Hidden");
      router.refresh();
    } catch (e: any) {
      toast.error(`Couldn't update. ${e?.message || ""}`.trim());
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: AdminReview) => {
    if (!confirm(`Delete ${r.buyerName}'s review for good? They could write a new one from their link.`)) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/reviews/${r.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error();
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Deleted");
      router.refresh();
    } catch {
      toast.error("Couldn't delete.");
    } finally {
      setBusy(null);
    }
  };

  if (!items.length) {
    return (
      <div className="grid justify-items-center gap-2 rounded-2xl border border-line bg-white px-4 py-16 text-center">
        <span className="paint-dab h-7 w-7" style={{ ["--dab" as string]: "var(--af-earned)" }} />
        <p className="text-[17px] font-semibold">Nothing here.</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((r) => {
        const st = STATUS[r.status] ?? STATUS.published;
        return (
          <li key={r.id} className={cn("grid content-start gap-2.5 rounded-2xl border bg-white p-4", r.status === "flagged" ? "border-coral" : "border-line")}>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-bold", st.cls)}>{st.label}</span>
              <Dabs value={r.rating} size="sm" />
              <span className="ml-auto text-[12.5px] text-ink-2">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <p className="text-[13px] text-ink-2">
              <b className="text-ink">{r.buyerName}</b>{r.buyerCity ? ` · ${r.buyerCity}` : ""} · {r.buyerEmail}
              <br />
              on {r.artworkSlug ? <Link href={`/art/${r.artworkSlug}`} className="font-semibold text-ink hover:text-scan">{r.artworkTitle}</Link> : (r.artworkTitle || "a removed piece")}
              {" by "}
              <Link href={`/@${r.artistSlug}`} className="font-semibold text-ink hover:text-scan">{r.artistName}</Link>
            </p>
            {r.body ? <p className="whitespace-pre-line text-[15px] leading-relaxed [overflow-wrap:anywhere]">{r.body}</p> : <p className="text-[13px] italic text-ink-2">No words, just the rating.</p>}
            {r.photoUrl && (
              <a href={r.photoUrl} target="_blank" rel="noopener" className="block w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photoUrl} alt="Buyer's photo" className="h-28 w-auto rounded-[3px] object-cover" />
              </a>
            )}
            {r.artistReply && <p className="rounded-lg bg-wall px-3 py-2 text-[13.5px]"><b>Reply:</b> {r.artistReply}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {r.status !== "published" && (
                <button type="button" disabled={busy === r.id} onClick={() => setStatus(r, "published")} className="btn btn-blue btn-sm">Publish</button>
              )}
              {r.status !== "hidden" && (
                <button type="button" disabled={busy === r.id} onClick={() => setStatus(r, "hidden")} className="btn btn-ghost btn-sm">Hide</button>
              )}
              <button type="button" disabled={busy === r.id} onClick={() => remove(r)} className="ml-auto text-[13px] font-semibold text-ink-2 underline-offset-2 hover:text-coral hover:underline">
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
