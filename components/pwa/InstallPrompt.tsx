"use client";

import { useEffect, useId, useState } from "react";
import { Share, X } from "lucide-react";
import { LogoMark } from "@/components/af/Logo";
import {
  clearInstallPrompt,
  installPromptEvent,
  isIosSafari,
  isStandalone,
  mayShowPrompt,
  onInstallPromptChange,
  remember,
} from "@/lib/pwa/install";

type Mode = "hidden" | "prompt" | "ios";

/**
 * "Install the Studio app" card at the top of the Studio.
 * Chrome/Edge/Android: offers the browser's install dialog (beforeinstallprompt).
 * iPhone/iPad Safari: short Share → Add to Home Screen instructions.
 * Shown at most once a week; dismissing (or installing) is remembered in localStorage.
 */
export default function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("hidden");
  const titleId = useId();

  useEffect(() => {
    if (isStandalone() || !mayShowPrompt()) return;
    const decide = () => {
      if (installPromptEvent()) setMode("prompt");
      else setMode((m) => (m === "prompt" ? "hidden" : m));
    };
    if (isIosSafari()) setMode("ios");
    else decide();
    return onInstallPromptChange(decide);
  }, []);

  // Count it as shown the first time it appears, so a reload doesn't bring it straight back.
  useEffect(() => {
    if (mode !== "hidden") remember();
  }, [mode]);

  if (mode === "hidden") return null;

  const dismiss = () => {
    remember();
    setMode("hidden");
  };

  const install = async () => {
    const e = installPromptEvent();
    if (!e) return setMode("hidden");
    clearInstallPrompt(); // the event can only be used once
    try {
      await e.prompt();
      await e.userChoice;
    } catch {
      /* the browser refused to show it: nothing to do */
    }
    dismiss();
  };

  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-4 sm:px-6 lg:px-10 lg:pt-6">
    <section aria-labelledby={titleId} className="flex max-w-[640px] items-start gap-3 rounded-2xl border border-edge bg-wall p-3.5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-white" aria-hidden="true">
        <LogoMark className="h-7 w-7" />
      </span>
      <div className="min-w-0 flex-1">
        <p id={titleId} className="font-display text-[17px] font-extrabold leading-tight text-ink">Install the Studio app</p>
        {mode === "prompt" ? (
          <>
            <p className="mt-0.5 text-[14px] leading-snug text-ink-2">Check sales and approve things from your home screen.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" onClick={install} className="btn btn-blue btn-sm">Install</button>
              <button type="button" onClick={dismiss} className="btn btn-ghost btn-sm">Not now</button>
            </div>
          </>
        ) : (
          <p className="mt-0.5 text-[14px] leading-snug text-ink-2">
            Tap <b className="text-ink">Share</b> <Share className="inline h-4 w-4 -translate-y-0.5 text-scan" aria-hidden="true" /> in Safari, then{" "}
            <b className="text-ink">Add to Home Screen</b>.
          </p>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss the install suggestion" className="-mr-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white hover:text-ink">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </section>
    </div>
  );
}
