"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Result = { handle: string; available: boolean; suggestion: string | null; reason: string | null };

// Same rules as sign-up (app/api/auth/_lib/handle.ts): a–z, 0–9, dots and underscores, 3–30.
const clean = (v: string) => v.trim().replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 30);

/** "theartfinity.com/@yourname [Claim it]": checks the name live, then hands it to sign-up. */
export default function ClaimHandle({ className, dark = false, autoFocus = false }: { className?: string; dark?: boolean; autoFocus?: boolean }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [going, setGoing] = useState(false);
  const seq = useRef(0);

  async function check(h: string): Promise<Result | null> {
    const n = ++seq.current;
    setChecking(true);
    try {
      const r = await fetch(`/api/handles/check?h=${encodeURIComponent(h)}`, { cache: "no-store" });
      const data = r.ok ? ((await r.json()) as Result) : null;
      if (n === seq.current) setRes(data);
      return data;
    } catch {
      return null;
    } finally {
      if (n === seq.current) setChecking(false);
    }
  }

  useEffect(() => {
    if (value.length < 3) { seq.current++; setRes(null); setChecking(false); return; }
    const t = setTimeout(() => check(value), 280);
    return () => clearTimeout(t);
  }, [value]);

  function go(h: string) {
    setGoing(true);
    router.push(`/register?handle=${encodeURIComponent(h)}`);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (value.length < 3) { input.current?.focus(); return; }
    const r = res && res.handle === value ? res : await check(value);
    if (r?.available) go(r.handle);
    else if (!r) go(value); // checker unreachable: let sign-up decide
  }

  const tone = dark ? "text-white/75" : "text-ink-2";
  let status: React.ReactNode = null;
  if (value && value.length < 3) status = <span className={tone}>At least 3 letters or numbers.</span>;
  else if (checking && (!res || res.handle !== value)) status = <span className={cn("inline-flex items-center gap-1.5", tone)}><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Checking @{value}</span>;
  else if (res && res.available) status = <span className={cn("inline-flex items-center gap-1.5 font-semibold", dark ? "text-white" : "text-ink")}><span className={cn("grid h-4 w-4 place-items-center rounded-full", dark ? "bg-sticker text-ink" : "bg-scan text-white")}><Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /></span>@{res.handle} is yours to claim.</span>;
  else if (res && !res.available) {
    status = (
      <span className={cn("font-semibold", dark ? "text-[#ffb4a3]" : "text-[#c23a1d]")}>
        {res.reason === "invalid" ? "Use letters and numbers. Dots or underscores can’t start or end it." : `@${res.handle} is taken.`}
        {res.suggestion && (
          <> Try{" "}
            <button type="button" onClick={() => { setValue(res.suggestion!); input.current?.focus(); }} className={cn("rounded-full px-2 py-0.5 font-bold underline-offset-2 hover:underline", dark ? "bg-white/10 text-white" : "bg-scan-soft text-scan")}>
              @{res.suggestion}
            </button>
          </>
        )}
      </span>
    );
  }

  return (
    <div className={cn("w-full max-w-[520px]", className)}>
      <form onSubmit={submit} className={cn("flex items-center rounded-full border-2 bg-white p-[5px] transition focus-within:shadow-[0_0_0_4px_rgb(var(--af-scan-rgb)/0.22)]", dark ? "border-white" : "border-ink focus-within:border-scan")} autoComplete="off">
        <label htmlFor={id} className="flex min-w-0 flex-1 cursor-text items-center pl-3 text-[14px] min-[400px]:pl-4 min-[400px]:text-[16px]">
          <span className="shrink-0 text-ink-2"><span className="hidden min-[340px]:inline">theartfinity.com</span>/@</span>
          <input
            ref={input}
            id={id}
            name="handle"
            value={value}
            onChange={(e) => setValue(clean(e.target.value))}
            placeholder="yourname"
            autoFocus={autoFocus}
            autoCapitalize="none"
            spellCheck={false}
            inputMode="text"
            aria-describedby={`${id}-s`}
            className="w-full min-w-0 border-0 bg-transparent py-2.5 pl-0.5 pr-2 text-[16px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-2"
          />
        </label>
        <button type="submit" className="btn btn-blue shrink-0 px-4 py-3 text-[16px] min-[400px]:px-6" disabled={going || (!!res && res.handle === value && !res.available)}>
          {going ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Claim it
        </button>
      </form>
      <div id={`${id}-s`} role="status" aria-live="polite" className="mt-2.5 pl-4 text-[14px] empty:mt-0">{status}</div>
    </div>
  );
}
