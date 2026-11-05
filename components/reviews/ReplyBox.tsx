"use client";

// The artist's single public reply under a review, in the Studio. Write once, edit any time, or remove.
import { useState } from "react";
import { toast } from "sonner";

export default function ReplyBox({ reviewId, initial, buyerFirst }: { reviewId: string; initial: string | null; buyerFirst: string }) {
  const [reply, setReply] = useState(initial || "");
  const [draft, setDraft] = useState(initial || "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (text: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/studio/reviews/${reviewId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply: text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't save.");
      setReply(j.review?.artistReply || "");
      setDraft(j.review?.artistReply || "");
      setOpen(false);
      toast.success(text ? (reply ? "Reply updated" : "Reply posted") : "Reply removed");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  if (!open && reply) {
    return (
      <div className="rounded-xl border-l-[3px] border-sticker bg-wall px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">Your reply</p>
          <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-semibold underline underline-offset-4 hover:text-scan">Edit</button>
        </div>
        <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{reply}</p>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm w-fit">Reply to {buyerFirst}</button>
    );
  }
  return (
    <div className="grid gap-2">
      <label className="af-field">
        <span className="label">Your reply, shown under the review</span>
        <textarea
          rows={3}
          maxLength={500}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Thanks ${buyerFirst}! That spot by the window is perfect.`}
          className="resize-none text-[16px] leading-snug"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !draft.trim()} onClick={() => save(draft)} className="btn btn-blue btn-sm">{reply ? "Save reply" : "Post reply"}</button>
        <button type="button" disabled={busy} onClick={() => { setDraft(reply); setOpen(false); }} className="btn btn-ghost btn-sm">Cancel</button>
        {reply && (
          <button type="button" disabled={busy} onClick={() => confirm("Remove your reply?") && save("")} className="ml-auto text-[13px] font-semibold text-ink-2 underline-offset-2 hover:text-coral hover:underline">Remove</button>
        )}
      </div>
    </div>
  );
}
