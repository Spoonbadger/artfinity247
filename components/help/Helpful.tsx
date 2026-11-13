"use client";

// "Was this helpful?" One vote per article per browser (remembered in localStorage), sent to /api/help/feedback.
import { useEffect, useState } from "react";
import Link from "next/link";

type Vote = "up" | "down";
const key = (slug: string) => `af_help_vote:${slug}`;

export default function Helpful({ slug }: { slug: string }) {
  const [vote, setVote] = useState<Vote | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(key(slug));
      if (v === "up" || v === "down") setVote(v);
    } catch {}
  }, [slug]);

  function send(v: Vote) {
    if (vote) return;
    setVote(v);
    try { localStorage.setItem(key(slug), v); } catch {}
    fetch("/api/help/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, vote: v }), keepalive: true }).catch(() => {});
  }

  return (
    <section aria-label="Feedback" className="af-panel flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      {vote ? (
        <p role="status" className="text-[15.5px]">
          {vote === "up" ? (
            <>Thanks! Glad it helped.</>
          ) : (
            <>Thanks for telling us. <Link href="/contact" className="font-semibold text-scan underline underline-offset-2">Message us</Link> and we&apos;ll get back to you.</>
          )}
        </p>
      ) : (
        <>
          <b className="text-[16px]">Was this helpful?</b>
          <div className="flex gap-2">
            <button type="button" onClick={() => send("up")} className="btn btn-ghost btn-sm min-h-[44px] px-4" aria-label="Yes, this was helpful">
              <span aria-hidden="true">👍</span> Yes
            </button>
            <button type="button" onClick={() => send("down")} className="btn btn-ghost btn-sm min-h-[44px] px-4" aria-label="No, this wasn't helpful">
              <span aria-hidden="true">👎</span> No
            </button>
          </div>
        </>
      )}
    </section>
  );
}
