"use client";

import { FormEvent, ReactNode, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import SensitiveImage from "@/components/site/SensitiveImage";
import { DMCA_STATEMENTS, REASON_LABEL, REPORT_REASONS, SITE_URL, type ReportReason } from "@/lib/reports";
import { cn } from "@/lib/utils";

export type ReportArt = { slug: string; title: string; imageUrl: string; sensitive: string[]; artist: string };

export default function ReportForm({ art, mode = "report" }: { art: ReportArt | null; mode?: "report" | "counter" }) {
  const counter = mode === "counter";
  const [reason, setReason] = useState<ReportReason | "">("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const dmca = reason === "copyright";
  const legal = dmca || counter; // needs address, phone, statements and a signature

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "");
    const on = (k: string) => f.get(k) === "on";
    setState("sending"); setErrors({}); setError("");
    try {
      const r = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          art: art?.slug ?? "",
          artworkUrl: s("artworkUrl"),
          reason: counter ? "counter" : reason || undefined,
          details: s("details"),
          original: s("original"),
          name: s("name"),
          email: s("email"),
          address: s("address"),
          phone: s("phone"),
          signature: s("signature"),
          accurate: on("accurate"),
          goodFaith: on("goodFaith"),
          perjury: on("perjury"),
          mistake: on("mistake"),
          jurisdiction: on("jurisdiction"),
          website: s("website"),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.ok) { setState("sent"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      setErrors(data.errors || {});
      // Jump to the first field that needs fixing.
      requestAnimationFrame(() => (document.querySelector('form [aria-invalid="true"]') as HTMLElement | null)?.focus());
      setError(data.error || (data.errors ? "Check the highlighted fields." : "Couldn’t send right now."));
    } catch {
      setError("Couldn’t send right now. Check your connection.");
    }
    setState("idle");
  }

  if (state === "sent") {
    return (
      <div className="af-card grid justify-items-start gap-3 p-7" role="status">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-scan text-white"><Check className="h-6 w-6" strokeWidth={3} aria-hidden="true" /></span>
        <h2 className="display text-[36px]">{counter ? "Counter-notice received." : "Thank you."}</h2>
        <p className="text-[16px] text-ink-2">
          {counter
            ? "We’ve emailed you a copy. We’ll pass it on and let you know when your work is back up."
            : "We review every report within 2 business days. If it’s infringing, we take it down. We’ll email you either way."}
        </p>
      </div>
    );
  }

  const err = (k: string) => errors[k] && <span id={`r-${k}-e`} className="pl-1 text-[13.5px] font-semibold text-[#c23a1d]">{errors[k]}</span>;
  const field = (k: string, label: string, input: ReactNode) => (
    <div className="grid gap-1">
      <label className="af-field" htmlFor={`r-${k}`}><span className="label">{label}</span>{input}</label>
      {err(k)}
    </div>
  );
  const aria = (k: string) => ({ id: `r-${k}`, name: k, "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `r-${k}-e` : undefined });
  const tick = (k: string, label: string) => (
    <div className="grid gap-1">
      <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-ink">
        <input type="checkbox" name={k} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--af-scan)]" aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `r-${k}-e` : undefined} />
        <span>{label}</span>
      </label>
      {err(k)}
    </div>
  );

  return (
    <form onSubmit={submit} className="af-card grid gap-5 p-5 sm:p-7" noValidate>
      {art ? (
        <div className="flex items-center gap-4 rounded-xl bg-wall p-3">
          <div className="h-20 w-16 shrink-0 overflow-hidden rounded-[3px] bg-gallery">
            <SensitiveImage labels={art.sensitive} light>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art.imageUrl} alt="" className="h-full w-full object-cover" />
            </SensitiveImage>
          </div>
          <div className="grid min-w-0 gap-0.5">
            <span className="eyebrow">{counter ? "Removed work" : "You’re reporting"}</span>
            <b className="truncate text-[17px]">{art.title}</b>
            <span className="truncate text-[14px] text-ink-2">by {art.artist}</span>
            <span className="truncate text-[12.5px] text-ink-2">{SITE_URL.replace(/^https?:\/\//, "")}/art/{art.slug}</span>
          </div>
        </div>
      ) : (
        field("artworkUrl", "Link to the art on Artfinity", <input {...aria("artworkUrl")} type="url" inputMode="url" placeholder="https://theartfinity.com/art/…" />)
      )}

      {!counter && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[14px] font-semibold">What’s wrong?</legend>
          {REPORT_REASONS.map((v) => (
            <label key={v} className={cn("flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2 text-[15.5px] font-semibold transition", reason === v ? "border-ink bg-sticker/30" : "border-line bg-white hover:border-ink")}>
              <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} className="h-[18px] w-[18px] accent-[var(--af-ink)]" />
              {REASON_LABEL[v]}
            </label>
          ))}
          {err("reason")}
        </fieldset>
      )}

      {dmca && (
        <p className="rounded-xl border-l-4 border-coral bg-wall px-3.5 py-2.5 text-[14.5px] text-ink-2">
          This is a formal copyright (DMCA) notice. We need a few legal details, and we may share it with the artist.
        </p>
      )}

      {dmca && field("original", "Your original work (a link or a short description)", <textarea {...aria("original")} rows={2} className="resize-y" placeholder="https://instagram.com/p/… or “Oil painting, Lake at Dusk, 2021”" />)}
      {counter && field("details", "What was removed, and why it’s yours", <textarea {...aria("details")} rows={3} className="resize-y" placeholder="It’s my original painting. Here’s my process video: …" />)}
      {!counter &&
        field(
          "details",
          dmca ? "Anything else (optional)" : reason === "other" ? "Tell us what’s going on" : "Details (optional)",
          <textarea {...aria("details")} rows={3} className="resize-y" placeholder={reason === "ai" ? "What makes you think so?" : ""} />
        )}

      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", legal ? "Full legal name" : "Your name", <input {...aria("name")} autoComplete="name" />)}
        {field("email", "Email", <input {...aria("email")} type="email" autoComplete="email" />)}
        {legal && field("address", "Mailing address", <input {...aria("address")} autoComplete="street-address" placeholder="Street, city, state, ZIP, country" />)}
        {legal && field("phone", "Phone", <input {...aria("phone")} type="tel" autoComplete="tel" />)}
      </div>

      <div className="grid gap-3 border-t border-line pt-4">
        {dmca && tick("goodFaith", DMCA_STATEMENTS.goodFaith)}
        {dmca && tick("perjury", DMCA_STATEMENTS.perjury)}
        {counter && tick("mistake", DMCA_STATEMENTS.mistake)}
        {counter && tick("jurisdiction", DMCA_STATEMENTS.jurisdiction)}
        {!legal && tick("accurate", DMCA_STATEMENTS.accurate)}
        {legal && field("signature", "Signature: type your full name", <input {...aria("signature")} autoComplete="name" className="font-display !text-[20px] italic" />)}
      </div>

      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p className="text-[14px] font-semibold text-[#c23a1d]" role="alert">{error}</p>}
      <button type="submit" className="btn btn-blue btn-lg w-full sm:w-fit" disabled={state === "sending"}>
        {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {counter ? "Send counter-notice" : dmca ? "Send DMCA notice" : "Send report"}
      </button>
    </form>
  );
}
