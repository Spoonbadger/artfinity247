"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Field = { name: string; label: string; type?: "text" | "textarea" | "number" | "select"; required?: boolean; placeholder?: string; defaultValue?: string; options?: { value: string; label: string }[]; hint?: string };

/**
 * A button that opens a confirm dialog (optionally with fields), POSTs `body` + field values as JSON to `url`,
 * toasts the result and refreshes the page.
 */
export default function ActionButton({
  url, body = {}, label, title, confirm, fields = [], confirmLabel, tone = "ghost", done, className, disabled, method = "POST",
}: {
  url: string;
  body?: Record<string, unknown>;
  label: ReactNode;
  title: string;
  confirm: ReactNode;
  fields?: Field[];
  confirmLabel?: string;
  tone?: "ghost" | "blue" | "danger";
  /** Toast text on success (or a function of the JSON response). */
  done?: string | ((d: any) => string);
  className?: string;
  disabled?: boolean;
  method?: "POST" | "PATCH";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    for (const f of fields) {
      const v = String(fd.get(f.name) ?? "").trim();
      if (f.required && !v) return setErr(`${f.label} is required.`);
      values[f.name] = f.type === "number" ? Number(v) : v;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...values }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Something went wrong.");
      toast.success(typeof done === "function" ? done(d) : done || "Done");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const btn = tone === "blue" ? "btn btn-blue btn-sm" : tone === "danger" ? "btn btn-ghost btn-sm text-coral hover:border-coral" : "btn btn-ghost btn-sm";
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErr(null); }}>
      <Dialog.Trigger asChild>
        <button type="button" disabled={disabled} className={cn(btn, className)}>{label}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] grid max-h-[90svh] w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-xl">
          <Dialog.Title className="text-[19px] font-bold">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="text-[14.5px] leading-relaxed text-ink-2">{confirm}</div>
          </Dialog.Description>
          <form onSubmit={submit} className="grid gap-3" noValidate>
            {fields.map((f) => (
              <label key={f.name} className="grid gap-1 text-[13px] font-semibold">
                {f.label}
                {f.type === "textarea" ? (
                  <textarea name={f.name} defaultValue={f.defaultValue} placeholder={f.placeholder} rows={3} maxLength={600} className="rounded-lg border-[1.5px] border-line px-3 py-2 text-[15px] font-normal text-ink focus:border-ink" />
                ) : f.type === "select" ? (
                  <select name={f.name} defaultValue={f.defaultValue} className="min-h-[42px] rounded-lg border-[1.5px] border-line bg-white px-2 text-[15px] font-normal text-ink">
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input name={f.name} type={f.type === "number" ? "number" : "text"} defaultValue={f.defaultValue} placeholder={f.placeholder} className="min-h-[42px] rounded-lg border-[1.5px] border-line px-3 text-[15px] font-normal text-ink focus:border-ink" />
                )}
                {f.hint && <span className="text-[12px] font-normal text-ink-2">{f.hint}</span>}
              </label>
            ))}
            {err && <p role="alert" className="text-[13.5px] font-semibold text-coral">{err}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild><button type="button" className="btn btn-ghost btn-sm">Cancel</button></Dialog.Close>
              <button type="submit" disabled={busy} className={tone === "danger" ? "btn btn-sm border-coral bg-coral text-white" : "btn btn-blue btn-sm"}>
                {busy ? "Working…" : confirmLabel || "Confirm"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
