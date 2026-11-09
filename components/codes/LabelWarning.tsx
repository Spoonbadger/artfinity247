"use client";
// "3 printed labels show ‘Prints from $55’. After this change scans show $65." Asked at the moment of saving a change
// to something a printed label shows (price, discount, title), with the three ways forward.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, Printer } from "lucide-react";

export type LabelWarningText = { title: string; body: string; gentle: boolean; codes: string[] };

export default function LabelWarning({ warning, busy, onReprint, onSave, onCancel }: {
  warning: LabelWarningText;
  busy?: "reprint" | "save" | null;
  onReprint: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); cancel.current(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); opener?.focus?.({ preventScroll: true }); };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[1000] grid place-items-end bg-ink/60 p-0 sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) cancel.current(); }}>
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="lw-title" aria-describedby="lw-body"
        className="grid w-full gap-4 rounded-t-2xl border border-edge bg-white p-5 shadow-[0_24px_60px_rgba(21,22,27,.35)] sm:max-w-[480px] sm:rounded-2xl sm:p-6">
        <div className="grid gap-1.5">
          <span className={`w-fit rounded-full px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-wide ${warning.gentle ? "bg-scan-soft text-ink" : "bg-sticker text-ink"}`}>
            {warning.gentle ? "Heads up" : "Printed labels"}
          </span>
          <h2 id="lw-title" className="t-card">{warning.title}</h2>
          <p id="lw-body" className="t-muted">{warning.body}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-blue" onClick={onReprint} disabled={!!busy} data-autofocus={warning.gentle ? undefined : true}>
            {busy === "reprint" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Printer className="h-4 w-4" aria-hidden="true" />}Save and reprint
          </button>
          <button type="button" className="btn btn-ghost" onClick={onSave} disabled={!!busy} data-autofocus={warning.gentle ? true : undefined}>
            {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Save anyway
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={!!busy}>Cancel</button>
        </div>
        <p className="t-small">Reprint adds {warning.codes.length === 1 ? "the code" : `the ${warning.codes.length} codes`} to your print queue with the same look.</p>
      </div>
    </div>,
    document.body,
  );
}

/** After "Save and reprint": queue the codes again. Returns how many went in, or throws with the server's message. */
export async function queueReprint(codes: string[]): Promise<{ queued: number; cards: number }> {
  const r = await fetch("/api/studio/code-prints/reprint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codes }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Couldn't add them to your print queue. Try again.");
  return j;
}
