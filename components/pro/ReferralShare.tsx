"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

/** Copy and share buttons for the referral link. `primary` when it's the page's main action (already on Infinity). */
export default function ReferralShare({ link, code, primary = false }: { link: string; code: string; primary?: boolean }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  async function copy(what: "link" | "code") {
    try {
      await navigator.clipboard.writeText(what === "link" ? link : code);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked: the link is selectable below */
    }
  }

  async function share() {
    const data = { title: "Sell prints of your art on Artfinity", text: "I sell prints of my art with QR codes on Artfinity. Free to join.", url: link };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* cancelled */ }
    } else copy("link");
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="text-[13px] font-bold text-ink-2">Your link</span>
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="w-full min-w-0 rounded-xl border border-line bg-wall px-3 py-3 text-[15px] font-semibold text-ink" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primary ? "btn btn-blue" : "btn"} onClick={() => copy("link")}>
          {copied === "link" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={share}>
          <Share2 className="h-4 w-4" aria-hidden="true" /> Share
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => copy("code")} aria-label={`Copy code ${code}`}>
          {copied === "code" ? "Copied" : <>Code <b className="tracking-[0.04em]">{code}</b></>}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">{copied ? "Copied to clipboard" : ""}</span>
    </div>
  );
}
