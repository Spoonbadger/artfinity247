"use client";

import { ChangeEvent, FocusEvent, FormEvent, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { checks } from "@/lib/smartFields";

// Checked when the person leaves the field, so mistakes show before Send.
const BLUR: Record<string, (v: string) => string | null> = {
  name: (v) => (v.trim() ? null : "Add your name so we know who to reply to."),
  email: checks.email,
};

const TOPICS: [string, string][] = [["order", "An order"], ["artist", "Selling my art"], ["other", "Something else"]];

export default function ContactForm() {
  const [topic, setTopic] = useState("order");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending"); setErrors({}); setError("");
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.get("name"), email: f.get("email"), message: f.get("message"), website: f.get("website"), topic }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.ok) { setState("sent"); return; }
      setErrors(data.errors || {});
      setError(data.error || (data.errors ? "" : "Couldn’t send right now."));
    } catch {
      setError("Couldn’t send right now. Check your connection.");
    }
    setState("idle");
  }

  if (state === "sent") {
    return (
      <div className="af-card grid justify-items-start gap-3 p-7" role="status">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-scan text-white"><Check className="h-6 w-6" strokeWidth={3} aria-hidden="true" /></span>
        <h2 className="t-section">Got it.</h2>
        <p className="t-body text-ink-2">We’ll reply by email, usually within a day.</p>
        <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => setState("idle")}>Send another</button>
      </div>
    );
  }

  const onBlurCheck = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const k = e.currentTarget.name;
    const m = BLUR[k]?.(e.currentTarget.value);
    setErrors((x) => {
      const { [k]: _drop, ...rest } = x;
      return m ? { ...rest, [k]: m } : rest;
    });
  };
  const onFix = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const k = e.currentTarget.name;
    if (errors[k] && !BLUR[k]?.(e.currentTarget.value)) setErrors(({ [k]: _drop, ...rest }) => rest);
  };

  const err = (k: string) => errors[k] && <span id={`c-${k}-e`} className="pl-1 text-[13.5px] font-semibold text-[#c23a1d]">{errors[k]}</span>;

  return (
    <form onSubmit={submit} className="af-card grid gap-4 p-5 sm:p-7" noValidate>
      <h2 className="t-card">Send a message</h2>
      <fieldset>
        <legend className="mb-2 text-[14px] font-semibold">It’s about</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={topic === v} onClick={() => setTopic(v)}
              className={cn("min-h-[44px] rounded-full border-[1.5px] px-4 py-1.5 text-[14px] font-semibold transition md:min-h-0", topic === v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <label className="af-field" htmlFor="c-name"><span className="label">Your name</span><input id="c-name" name="name" autoComplete="name" autoCapitalize="words" required onBlur={onBlurCheck} onChange={onFix} aria-invalid={!!errors.name} aria-describedby={errors.name ? "c-name-e" : undefined} /></label>
          {err("name")}
        </div>
        <div className="grid gap-1">
          <label className="af-field" htmlFor="c-email"><span className="label">Email</span><input id="c-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required onBlur={onBlurCheck} onChange={onFix} aria-invalid={!!errors.email} aria-describedby={errors.email ? "c-email-e" : undefined} /></label>
          {err("email")}
        </div>
      </div>
      <div className="grid gap-1">
        <label className="af-field" htmlFor="c-msg"><span className="label">Message</span><textarea id="c-msg" name="message" rows={5} required onChange={onFix} className="resize-y" placeholder={topic === "order" ? "Order number and what happened" : ""} aria-invalid={!!errors.message} aria-describedby={errors.message ? "c-message-e" : undefined} /></label>
        {err("message")}
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p className="text-[14px] font-semibold text-[#c23a1d]" role="alert">{error}</p>}
      <button type="submit" className="btn btn-blue btn-lg w-full sm:w-fit" disabled={state === "sending"}>
        {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Send
      </button>
    </form>
  );
}
