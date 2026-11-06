"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Heart, Lock, Mail, Package, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitParcelTag } from "@/lib/artistEmails";
import { shortDate, type Stage } from "./format";
import { failed, problemFrom, saved } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";

export type ThreadMessage = {
  id: string;
  direction: string;
  subject: string | null;
  body: string;
  sentAt: string | null;
  createdAt: string;
  orderId: string | null;
};

export type ComposerOrder = { id: string; label: string; title: string; stage: Stage };

type Mode = "thank_you" | "note";

function thankYouText(buyer: string, title: string, artistFirst: string) {
  return (
    `Hi ${buyer},\n\n` +
    `Thank you for bringing home ${title}. It means a lot to know it will hang on your wall.\n\n` +
    `I hope it makes you smile every time you walk past it.\n\n` +
    `Warmly,\n${artistFirst}`
  );
}

function when(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${shortDate(iso, d.getFullYear() !== new Date().getFullYear())}, ${time}`;
}

function MessageItem({ m, titleFor, onDelete }: { m: ThreadMessage; titleFor: (id: string | null) => string | null; onDelete: (id: string) => void }) {
  const piece = titleFor(m.orderId);
  if (m.direction === "note") {
    return (
      <li className="relative grid gap-1.5 rounded-[4px] border border-[#eadb9a] bg-[#fff7cf] p-3 pr-10 shadow-[0_2px_0_#eadb9a]">
        <span className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-ink-2">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />Private note · {when(m.createdAt)}{piece ? ` · ${piece}` : ""}
        </span>
        <p className="whitespace-pre-wrap text-[14.5px] text-ink">{m.body}</p>
        <button
          type="button"
          onClick={() => onDelete(m.id)}
          className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full text-ink-2 hover:bg-white/70 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-scan"
          aria-label="Delete note"
          title="Delete note"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </li>
    );
  }
  const { parcel, subject } = splitParcelTag(m.subject);
  const inbound = m.direction === "in";
  return (
    <li className={cn("grid gap-1.5 rounded-[4px] border border-line bg-white p-3 shadow-[0_2px_0_var(--af-line)]", inbound ? "border-l-[3px] border-l-[#c98a5a]" : "border-l-[3px] border-l-scan")}>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-ink-2">
        {inbound ? <Mail className="h-3.5 w-3.5" aria-hidden="true" /> : <Heart className="h-3.5 w-3.5 text-scan" aria-hidden="true" />}
        {inbound ? "From them" : "Emailed"} · {when(m.sentAt || m.createdAt)}
        {parcel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sticker px-2 py-px text-[12px] font-bold text-ink">
            <Package className="h-3 w-3" aria-hidden="true" />In the parcel
          </span>
        )}
      </span>
      {subject && <b className="text-[14px]">{subject}</b>}
      <p className="whitespace-pre-wrap text-[14.5px] text-ink">{m.body}</p>
    </li>
  );
}

export default function Conversation({
  email, buyerFirstName, artistName, artistFirstName, orders, initial,
}: {
  email: string;
  buyerFirstName: string;
  artistName: string;
  artistFirstName: string;
  orders: ComposerOrder[];
  initial: ThreadMessage[];
}) {
  const [messages, setMessages] = useState(initial);
  const [mode, setMode] = useState<Mode>("thank_you");
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const order = orders.find((o) => o.id === orderId) ?? orders[0];
  const template = useMemo(() => thankYouText(buyerFirstName, order?.title ?? "your print", artistFirstName), [buyerFirstName, order?.title, artistFirstName]);
  const [thanks, setThanks] = useState(template);
  const [note, setNote] = useState("");
  const [parcel, setParcel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const lastTemplate = useRef(template);
  const listEnd = useRef<HTMLLIElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Switching the piece re-fills the note, unless the artist already edited it.
  useEffect(() => {
    setThanks((cur) => (cur === lastTemplate.current ? template : cur));
    lastTemplate.current = template;
  }, [template]);

  const canParcel = !!order && (order.stage === "paid" || order.stage === "printing");
  useEffect(() => { if (!canParcel) setParcel(false); }, [canParcel]);

  const titleFor = (id: string | null) => (id ? orders.find((o) => o.id === id)?.title ?? null : null);
  const text = mode === "thank_you" ? thanks : note;

  // Grow the box with the note so the sign-off is never hidden.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 4, 520)}px`;
  }, [text, mode]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (!text.trim()) {
      setStatus({ ok: false, text: mode === "thank_you" ? "Write a few words first." : "Write the note first." });
      textRef.current?.focus();
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/studio/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode, body: text, orderId: order?.id, parcel: mode === "thank_you" && parcel }),
      });
      if (!res.ok) {
        const p = await problemFrom(res, mode === "thank_you" ? "The note didn't send." : "Couldn't save the note.");
        setStatus({ ok: false, text: p.message });
        failed(p.message, { description: res.status < 500 ? "" : undefined, fix: p.fix, retry: p.fix || res.status < 500 ? undefined : () => submit() });
        return;
      }
      const data = await res.json().catch(() => ({}));
      const m = data.message;
      setMessages((list) => [...list, { ...m, sentAt: m.sentAt ?? null, createdAt: m.createdAt }]);
      if (mode === "thank_you") {
        setThanks(template);
        setParcel(false);
        setStatus({ ok: true, text: `Sent to ${buyerFirstName}.` });
        saved(`Thank-you sent to ${buyerFirstName}`, { description: parcel ? "It'll be printed in the parcel too. Replies go to your inbox." : "Replies go to your inbox." });
      } else {
        setNote("");
        setStatus({ ok: true, text: "Note saved." });
        saved("Note saved", { description: "Only you can see it." });
      }
      requestAnimationFrame(() => listEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    } catch {
      setStatus({ ok: false, text: "You seem to be offline. Your note is still here." });
      failed("You seem to be offline", { description: "Your note is still here. Check your connection and try again.", retry: () => submit() });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this note?")) return;
    try {
      const res = await fetch(`/api/studio/messages/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessages((list) => list.filter((m) => m.id !== id));
        saved("Note deleted");
      } else {
        const p = await problemFrom(res, "Couldn't delete that note.");
        failed(p.message, { description: res.status < 500 ? "" : undefined, fix: p.fix, retry: p.fix || res.status < 500 ? undefined : () => remove(id) });
      }
    } catch {
      failed("You seem to be offline", { description: "Check your connection and try again.", retry: () => remove(id) });
    }
  }

  return (
    <section aria-labelledby="talk-h" className="grid gap-3 lg:sticky lg:top-6">
      <h2 id="talk-h" className="t-card">Notes &amp; messages</h2>

      {messages.length === 0 ? (
        <EmptyState compact title="No notes yet" body="Buyers who hear from you come back. A short thank-you below is plenty." />
      ) : (
        <ol className="grid max-h-[560px] gap-2.5 overflow-y-auto p-0.5" aria-label="Thread">
          {messages.map((m) => <MessageItem key={m.id} m={m} titleFor={titleFor} onDelete={remove} />)}
          <li ref={listEnd} aria-hidden="true" className="h-px" />
        </ol>
      )}

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-edge bg-white p-3 sm:p-4">
        <div role="radiogroup" aria-label="Note type" className="grid grid-cols-2 gap-1 rounded-full bg-wall p-1">
          {([
            { key: "thank_you", label: "Thank-you note", icon: Heart },
            { key: "note", label: "Private note", icon: Lock },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={mode === key}
              onClick={() => { setMode(key); setStatus(null); }}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-scan",
                mode === key ? "bg-ink text-white" : "text-ink hover:bg-white"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
            </button>
          ))}
        </div>

        {orders.length > 1 && (
          <label className="grid gap-1 text-[13px] font-semibold text-ink-2">
            About
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="min-h-[42px] rounded-xl border-2 border-line bg-white px-3 text-[15px] font-normal text-ink focus:border-scan focus:outline-none"
            >
              {orders.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        )}

        <label className="grid gap-1 text-[13px] font-semibold text-ink-2">
          {mode === "thank_you" ? `To ${buyerFirstName}, from ${artistName} via Artfinity` : "Only you see this"}
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => (mode === "thank_you" ? setThanks(e.target.value) : setNote(e.target.value))}
            rows={mode === "thank_you" ? 10 : 4}
            maxLength={4000}
            placeholder={mode === "note" ? "Loves big florals. Met at the Saturday market." : undefined}
            className={cn(
              "w-full resize-y rounded-xl border-2 px-3.5 py-3 text-[16px] font-normal leading-relaxed text-ink outline-none focus:border-scan focus:shadow-[0_0_0_3px_#d9dcff]",
              mode === "note" ? "border-[#eadb9a] bg-[#fffbe6]" : "border-line bg-white"
            )}
          />
        </label>

        {mode === "thank_you" && (
          <label className={cn("flex items-start gap-2.5 text-[14px]", !canParcel && "text-ink-2")}>
            <input
              type="checkbox"
              checked={parcel}
              disabled={!canParcel}
              onChange={(e) => setParcel(e.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#2b37f0]"
            />
            <span>
              Also print this note in the parcel
              {!canParcel && <span className="block text-[13px]">Already shipped</span>}
            </span>
          </label>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className={cn("text-[13.5px] font-semibold", status?.ok ? "text-earned" : "text-coral")}>
            {status?.text}
          </p>
          <div className="flex gap-2">
            {mode === "thank_you" && thanks !== template && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setThanks(template)}>Reset</button>
            )}
            <button type="submit" className="btn btn-blue btn-sm" disabled={busy}>
              {busy ? "Sending…" : mode === "thank_you" ? "Send note" : "Save note"}
            </button>
          </div>
        </div>
        {mode === "thank_you" && <p className="t-small -mt-1">Sent by email. Replies go to your inbox.</p>}
      </form>
    </section>
  );
}
