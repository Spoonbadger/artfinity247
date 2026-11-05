"use client";

import { useState } from "react";
import { toast } from "sonner";

export type AdminNoteRow = { id: string; adminEmail: string; body: string; createdAt: string };

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Support notes on an artist or order: newest first, add at the top. */
export default function NotesPanel({ targetType, targetId, notes: initial }: { targetType: "artist" | "order"; targetId: string; notes: AdminNoteRow[] }) {
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save the note.");
      setNotes((n) => [{ ...d.note, createdAt: d.note.createdAt }, ...n]);
      setBody("");
      toast.success("Note saved");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save the note.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`notes-${targetId}`} className="af-card grid content-start gap-3 p-4">
      <h2 id={`notes-${targetId}`} className="text-[17px] font-bold">Notes <span className="num text-[13px] font-semibold text-ink-2">{notes.length}</span></h2>
      <form onSubmit={add} className="grid gap-2">
        <label className="sr-only" htmlFor={`note-${targetId}`}>New note</label>
        <textarea
          id={`note-${targetId}`} value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000}
          placeholder={targetType === "artist" ? "Called about payout, prefers email…" : "Buyer asked to change address…"}
          className="rounded-lg border-[1.5px] border-line px-3 py-2 text-[14.5px] text-ink focus:border-ink"
        />
        <button type="submit" disabled={busy || !body.trim()} className="btn btn-ghost btn-sm justify-self-start">Add note</button>
      </form>
      {notes.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">No notes yet. Only admins see these.</p>
      ) : (
        <ul className="grid gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-wall/70 px-3 py-2">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{n.body}</p>
              <p className="mt-1 text-[12px] text-ink-2">{n.adminEmail || "admin"} · {when(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
