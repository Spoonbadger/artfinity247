"use client";
// Password fields. `PasswordStrength` is the small meter for new-password fields (pass it as the field's hint);
// `PasswordInput` is a label-in-box password field with Show/Hide for forms outside the auth screens.
import { InputHTMLAttributes, forwardRef, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { passwordStrength } from "@/lib/smartFields";

const BAR = ["bg-coral", "bg-sticker", "bg-earned", "bg-earned"];
const WORD = ["text-coral", "text-ink", "text-earned", "text-earned"];

/** Four-step meter with one word and, when it helps, one tip. Empty password: the fallback hint. */
export function PasswordStrength({ value, fallback = "8 or more characters" }: { value: string; fallback?: string }) {
  if (!value) return <span>{fallback}</span>;
  const s = passwordStrength(value);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i key={i} className={cn("block h-1.5 w-7 rounded-full transition-colors", i < Math.max(1, s.score) ? BAR[s.score] : "bg-line")} />
        ))}
      </span>
      <b className={cn("font-semibold", WORD[s.score])}>{s.label}</b>
      {s.tip && <span className="text-ink-2">{s.tip}</span>}
    </span>
  );
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  /** "new" shows the strength meter and sets autoComplete="new-password"; "current" sets current-password. */
  kind?: "new" | "current";
  error?: string | null;
};

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput({ label, kind = "current", error, className, id, value, ...rest }, ref) {
  const auto = useId();
  const fid = id || auto;
  const [show, setShow] = useState(false);
  const v = typeof value === "string" ? value : "";
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className={cn("af-field", error && "!border-coral")}>
        <label htmlFor={fid} className="text-xs text-ink-2">{label}</label>
        <span className="flex min-w-0 items-center">
          <input
            ref={ref}
            id={fid}
            type={show ? "text" : "password"}
            autoComplete={kind === "new" ? "new-password" : "current-password"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${fid}-msg`}
            {...rest}
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"} className="-my-3 -mr-2 ml-1 min-h-[44px] min-w-[44px] shrink-0 rounded-md px-2 text-[14px] font-semibold text-ink-2 hover:text-ink">
            {show ? "Hide" : "Show"}
          </button>
        </span>
      </div>
      <div id={`${fid}-msg`} className={cn("px-1 text-[13.5px]", error ? "font-semibold text-coral" : "text-ink-2")}>
        {error || (kind === "new" ? <PasswordStrength value={v} /> : null)}
      </div>
    </div>
  );
});
