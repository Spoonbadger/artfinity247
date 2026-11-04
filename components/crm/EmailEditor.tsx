"use client";

import { useMemo, useRef, useState } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TEMPLATES, EMAIL_KINDS, EMAIL_KIND_LABEL, EMAIL_KIND_WHEN, EMAIL_LIMITS, EMAIL_VARIABLES,
  renderArtistEmail, type EmailKind, type EmailVars,
} from "@/lib/artistEmails";

export type EditorTemplate = { subject: string; body: string; enabled: boolean; custom: boolean };

const KIND_DAB: Record<EmailKind, string> = { receipt: "#ffd43b", shipped: "#2b37f0", delivered: "#15161b", thank_you: "#e8743b" };

export default function EmailEditor({
  initial, artistName, sampleTitle,
}: {
  initial: Record<EmailKind, EditorTemplate>;
  artistName: string;
  sampleTitle: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [drafts, setDrafts] = useState(initial);
  const [kind, setKind] = useState<EmailKind>("shipped");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"subject" | "body">("body");

  const draft = drafts[kind];
  const dirty = (k: EmailKind) => {
    const a = drafts[k], b = saved[k];
    return a.subject !== b.subject || a.body !== b.body || a.enabled !== b.enabled;
  };
  const isDefaultText = draft.subject === DEFAULT_TEMPLATES[kind].subject && draft.body === DEFAULT_TEMPLATES[kind].body;

  const vars: EmailVars = useMemo(() => ({
    buyer_first_name: "Sam",
    artwork_title: sampleTitle,
    artist_name: artistName,
    order_link: "https://theartfinity.com/thank-you?session_id=…",
    size: "Medium, 8 × 12 in",
  }), [sampleTitle, artistName]);

  // The receipt goes out with the order summary under the artist's words (see lib/artistEmails.server.ts).
  const summary = kind === "receipt" ? `\n\nYour order\n${sampleTitle}, Medium, 8 × 12 in: $48.00\nTotal: $48.00` : "";
  const preview = renderArtistEmail(kind, { subject: draft.subject, body: draft.body + summary, enabled: true }, vars);

  const update = (patch: Partial<EditorTemplate>) => {
    setStatus(null);
    setDrafts((d) => ({ ...d, [kind]: { ...d[kind], ...patch } }));
  };

  function insert(token: string) {
    const field = lastField.current;
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const value = field === "subject" ? draft.subject : draft.body;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const text = `{${token}}`;
    const next = value.slice(0, start) + text + value.slice(end);
    update(field === "subject" ? { subject: next } : { body: next });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/studio/emails", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject: draft.subject, body: draft.body, enabled: draft.enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save.");
      const t: EditorTemplate = { subject: data.template.subject, body: data.template.body, enabled: data.template.enabled, custom: true };
      setSaved((s) => ({ ...s, [kind]: t }));
      setDrafts((d) => ({ ...d, [kind]: t }));
      setStatus({ ok: true, text: "Saved." });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (saved[kind].custom && !window.confirm(`Use Artfinity's ${EMAIL_KIND_LABEL[kind].toLowerCase()} email again?`)) return;
    setBusy(true);
    setStatus(null);
    try {
      if (saved[kind].custom) {
        const res = await fetch(`/api/studio/emails?kind=${kind}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Could not reset.");
      }
      const t: EditorTemplate = { ...DEFAULT_TEMPLATES[kind], enabled: true, custom: false };
      setSaved((s) => ({ ...s, [kind]: t }));
      setDrafts((d) => ({ ...d, [kind]: t }));
      setStatus({ ok: true, text: "Back to default." });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Could not reset." });
    } finally {
      setBusy(false);
    }
  }

  const state = (k: EmailKind) => {
    const s = saved[k];
    if (!s.custom) return k === "thank_you" ? "Not set" : "Standard";
    return s.enabled ? "Yours" : "Off";
  };

  const offNote = kind === "thank_you" ? "Off: not sent." : "Off: buyers get Artfinity's standard email.";

  return (
    <div className="grid gap-5">
      <div role="tablist" aria-label="Emails" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {EMAIL_KINDS.map((k) => {
          const on = k === kind;
          const st = state(k);
          return (
            <button
              key={k}
              type="button"
              role="tab"
              id={`tab-${k}`}
              aria-selected={on}
              aria-controls="email-panel"
              onClick={() => { setKind(k); setStatus(null); }}
              className={cn(
                "grid min-w-[132px] shrink-0 gap-0.5 rounded-xl border-2 px-3.5 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scan",
                on ? "border-ink bg-white shadow-[3px_3px_0_var(--af-ink)]" : "border-line bg-white/70 hover:border-ink"
              )}
            >
              <span className="flex items-center gap-2 text-[15px] font-bold text-ink">
                <i className="paint-dab" style={{ ["--dab" as string]: KIND_DAB[k] }} aria-hidden="true" />
                {EMAIL_KIND_LABEL[k]}
                {dirty(k) && <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-label="unsaved" />}
              </span>
              <span className={cn("text-[12px]", st === "Yours" ? "font-semibold text-scan" : "text-ink-2")}>{st}</span>
            </button>
          );
        })}
      </div>

      <div id="email-panel" role="tabpanel" aria-labelledby={`tab-${kind}`} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Editor */}
        <section aria-label={`${EMAIL_KIND_LABEL[kind]} email`} className="grid gap-4 rounded-2xl border-[1.5px] border-ink bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-2">
              <Clock className="h-4 w-4" aria-hidden="true" />{EMAIL_KIND_WHEN[kind]}
            </span>
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold">
              {kind === "thank_you" ? "Send it" : "Use my wording"}
              <button
                type="button"
                role="switch"
                aria-checked={draft.enabled}
                onClick={() => update({ enabled: !draft.enabled })}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scan",
                  draft.enabled ? "bg-scan" : "bg-wall"
                )}
              >
                <span className={cn("absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-white transition-all", draft.enabled ? "left-[22px]" : "left-0.5")} />
              </button>
            </label>
          </div>

          {!draft.enabled ? (
            <p className="-mt-2 text-[13px] text-ink-2">{offNote}</p>
          ) : !saved[kind].custom && kind !== "thank_you" ? (
            <p className="-mt-2 text-[13px] text-ink-2">Buyers get Artfinity&apos;s standard email until you save.</p>
          ) : null}
          {kind === "thank_you" && (
            <p className="-mt-2 rounded-lg bg-wall px-3 py-2 text-[12.5px] text-ink-2">Saved now. Automatic sending arrives with the next backend update.</p>
          )}

          <label className="af-field">
            <span className="label">Subject</span>
            <input
              ref={subjectRef}
              value={draft.subject}
              maxLength={EMAIL_LIMITS.subject}
              onChange={(e) => update({ subject: e.target.value })}
              onFocus={() => (lastField.current = "subject")}
            />
          </label>

          <label className="af-field">
            <span className="label">Message</span>
            <textarea
              ref={bodyRef}
              value={draft.body}
              rows={9}
              maxLength={EMAIL_LIMITS.body}
              onChange={(e) => update({ body: e.target.value })}
              onFocus={() => (lastField.current = "body")}
              className="resize-y !text-[16px] leading-relaxed"
            />
          </label>

          <div className="grid gap-1.5">
            <span className="text-[12px] font-semibold text-ink-2">Tap to insert</span>
            <div className="flex flex-wrap gap-1.5">
              {EMAIL_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(v)}
                  className="rounded-full border-[1.5px] border-ink bg-white px-2.5 py-1 text-[12.5px] font-semibold text-ink hover:bg-sticker focus-visible:outline focus-visible:outline-2 focus-visible:outline-scan"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-line pt-3">
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={busy || (!saved[kind].custom && isDefaultText && draft.enabled)}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Reset to default
            </button>
            <span className="flex items-center gap-3">
              <span aria-live="polite" className={cn("text-[13.5px] font-semibold", status?.ok ? "text-earned" : "text-coral")}>{status?.text}</span>
              <button type="button" className="btn btn-blue btn-sm" onClick={save} disabled={busy || (!dirty(kind) && saved[kind].custom)}>
                {busy ? "Saving…" : "Save"}
              </button>
            </span>
          </div>
        </section>

        {/* Preview */}
        <section aria-label="Preview" className="grid gap-2 lg:sticky lg:top-6">
          <span className="eyebrow">Preview</span>
          <div className={cn("overflow-hidden rounded-2xl border border-line bg-white shadow-[0_10px_30px_-18px_rgba(21,22,27,.45)]", !draft.enabled && "opacity-60")}>
            <div className="grid gap-1 border-b border-line bg-wall px-4 py-3 text-[13px]">
              <span className="flex gap-2"><span className="w-12 shrink-0 text-ink-2">From</span><b className="truncate">{artistName} via Artfinity</b></span>
              <span className="flex gap-2"><span className="w-12 shrink-0 text-ink-2">To</span><span className="truncate">Sam</span></span>
              <span className="flex gap-2"><span className="w-12 shrink-0 text-ink-2">Subject</span><b className="min-w-0 [overflow-wrap:anywhere]">{preview.subject || " "}</b></span>
            </div>
            <div className="[&_a]:break-all" dangerouslySetInnerHTML={{ __html: preview.html }} />
          </div>
          <p className="text-[12px] text-ink-2">Sample buyer: Sam. Real emails fill in each order.</p>
        </section>
      </div>
    </div>
  );
}
