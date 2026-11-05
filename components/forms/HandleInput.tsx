"use client";
// Social handle or website field. Paste a full profile link or "@name" and it becomes the bare handle, with a live
// link underneath so the artist can check it opens the right page. Website links get https:// and lose spaces.
// The value is always what the field shows: a bare handle ("maya.paints") or a tidy site ("maya.art/shop").
import { ClipboardEvent, FocusEvent, ReactNode, forwardRef, useId, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_LABEL, parseSocialHandle, type SocialPlatform } from "@/lib/smartFields";

export type HandlePlatform = SocialPlatform | "website";

/** The handle or site in `value`, resolved: { handle, url } when it's good, { error } when it isn't, null when empty. */
export function resolveHandle(platform: HandlePlatform, value: string): { handle: string; url: string } | { error: string } | null {
  if (platform !== "website") return parseSocialHandle(platform, value);
  const s = value.trim();
  if (!s) return null;
  if (/\s/.test(s)) return { error: "Links can't have spaces. Copy it from your browser's address bar." };
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
    if (!/\.[a-z]{2,}$/i.test(u.hostname)) return { error: "That needs a domain ending, like yourname.com." };
    const pretty = (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "") + u.search).slice(0, 200);
    return { handle: pretty, url: u.toString() };
  } catch {
    return { error: "That link doesn't look right. Try yourname.com." };
  }
}

type Props = {
  platform: HandlePlatform;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: ReactNode;
  /** An error from the form (e.g. on submit). The field's own check shows after blur. */
  error?: string | null;
  variant?: "box" | "bare";
  className?: string;
  inputClassName?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Hide the "opens ↗" line (when the caller shows its own preview). */
  noPreview?: boolean;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
};

const HandleInput = forwardRef<HTMLInputElement, Props>(function HandleInput(
  { platform, value, onChange, label, hint, error, variant = "box", className, inputClassName, id, name, placeholder, autoFocus, noPreview, onBlur },
  ref,
) {
  const auto = useId();
  const fid = id || auto;
  const msgId = `${fid}-msg`;
  const [touched, setTouched] = useState(false);
  const r = resolveHandle(platform, value);
  const ownError = touched && r && "error" in r ? r.error : null;
  const shownError = error || ownError;
  const isSite = platform === "website";
  const at = !isSite && !/[/:]/.test(value);

  function tidy(raw: string) {
    const x = resolveHandle(platform, raw);
    return x && "handle" in x ? x.handle : raw.trim();
  }

  function paste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const x = resolveHandle(platform, text);
    if (x && "handle" in x) {
      e.preventDefault();
      onChange(x.handle);
      setTouched(true);
    }
  }

  const input = (
    <input
      ref={ref}
      id={fid}
      name={name}
      value={value}
      onChange={(e) => {
        onChange(isSite ? e.target.value.replace(/\s/g, "") : e.target.value.replace(/^@+/, "").replace(/\s/g, ""));
        if (touched) setTouched(false);
      }}
      onPaste={paste}
      onBlur={(e) => {
        if (value.trim()) {
          const t = tidy(value);
          if (t !== value) onChange(t);
        }
        setTouched(true);
        onBlur?.(e);
      }}
      type={isSite ? "url" : "text"}
      inputMode="url"
      autoComplete={isSite ? "url" : "off"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder={placeholder ?? (isSite ? "yourname.com" : "yourname")}
      maxLength={isSite ? 300 : 200}
      autoFocus={autoFocus}
      aria-invalid={shownError ? true : undefined}
      aria-describedby={msgId}
      className={cn("min-w-0 flex-1 bg-transparent outline-none", inputClassName)}
    />
  );

  const below = (
    <div id={msgId} aria-live="polite" className={cn("min-h-0 px-1 text-[13px]", variant === "bare" && "px-0")}>
      {shownError ? (
        <span className="font-semibold text-coral">{shownError}</span>
      ) : r && "handle" in r && !noPreview ? (
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-scan underline-offset-2 hover:underline">
          {r.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only"> (opens in a new tab, to check it)</span>
        </a>
      ) : hint ? (
        <span className="text-ink-2">{hint}</span>
      ) : null}
    </div>
  );

  if (variant === "bare")
    return (
      <div className={cn("grid gap-1", className)}>
        <span className="flex min-w-0 items-baseline">
          {at && <span className="shrink-0 text-ink-2" aria-hidden="true">@</span>}
          {input}
        </span>
        {below}
      </div>
    );

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={fid} className={cn("af-field cursor-text", shownError && "!border-coral focus-within:!shadow-[0_0_0_3px_#ffd9cf]")}>
        <span className="label">{label ?? (isSite ? "Website" : `${PLATFORM_LABEL[platform]} handle`)}</span>
        <span className="flex min-w-0 items-baseline text-[17px]">
          {at && <span className="shrink-0 text-ink-2" aria-hidden="true">@</span>}
          {input}
        </span>
      </label>
      {below}
    </div>
  );
});

export default HandleInput;
