"use client";

import { InputHTMLAttributes, ReactNode, forwardRef, useId, useState } from "react";
import { cn } from "@/lib/utils";

/** The ink-bordered card with a hard shadow that every auth screen sits in. */
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative min-w-0 rounded-[22px] border-2 border-ink bg-paper p-6 shadow-[8px_8px_0_var(--af-ink)] sm:p-9 sm:shadow-[10px_10px_0_var(--af-ink)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & { label: string; error?: string | null; hint?: ReactNode; prefix?: ReactNode; trailing?: ReactNode };

/** Label-in-box text field (the .af-field look) with an inline error line. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, hint, prefix, trailing, className, id, ...rest }, ref) {
  const auto = useId();
  const fid = id || auto;
  const msgId = `${fid}-msg`;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div
        className={cn("af-field cursor-text", error && "!border-coral focus-within:!shadow-[0_0_0_3px_#ffd9cf]")}
        onMouseDown={(e) => {
          // Clicking anywhere in the box focuses the input, like a label would.
          const t = e.target as HTMLElement;
          if (t.closest("input,button,label")) return;
          e.preventDefault();
          (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus();
        }}
      >
        <label htmlFor={fid} className="text-xs text-ink-2">{label}</label>
        <span className="flex min-w-0 items-baseline">
          {prefix && <span className="shrink-0 text-[17px] text-ink-2">{prefix}</span>}
          <input ref={ref} id={fid} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? msgId : undefined} {...rest} />
          {trailing}
        </span>
      </div>
      {(error || hint) && (
        <div id={msgId} className={cn("px-1 text-[13.5px]", error ? "font-semibold text-coral" : "text-ink-2")} aria-live="polite">
          {error || hint}
        </div>
      )}
    </div>
  );
});

/** Password field with a show/hide toggle. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, "type" | "trailing">>(function PasswordField(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <Field
      ref={ref}
      {...props}
      type={show ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="-my-3 -mr-2 ml-1 min-h-[44px] min-w-[44px] shrink-0 rounded-md px-2 text-[14px] font-semibold text-ink-2 hover:text-ink"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? "Hide" : "Show"}
        </button>
      }
    />
  );
});

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />;
}

export function FormAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "ok" }) {
  if (!children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border-[1.5px] px-3.5 py-2.5 text-[14.5px] font-semibold",
        tone === "error" ? "border-coral bg-[#fff1ec] text-ink" : "border-earned bg-earned-soft text-ink",
      )}
    >
      {children}
    </div>
  );
}
