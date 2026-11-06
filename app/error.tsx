"use client";

import Link from "next/link";
import CrookedFrame from "@/components/browse/Crooked";
import { useUser } from "@/components/contexts";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { currentUser } = useUser();
  return (
    <main className="grid min-h-[70svh] place-content-center gap-8 px-4 py-14 text-center">
      <CrookedFrame stroke="var(--af-coral)">
        <svg viewBox="0 0 100 80" className="w-[70%]" aria-hidden="true">
          <path d="M18 30C14 14 36 6 52 12s36 4 34 22-8 30-30 32-34-18-38-36Z" fill="var(--af-coral)" />
          <circle cx="82" cy="62" r="5" fill="var(--af-coral)" />
          <circle cx="16" cy="64" r="3.5" fill="var(--af-coral)" />
        </svg>
      </CrookedFrame>
      <div className="grid justify-items-center gap-3">
        <h1 className="t-page">Paint spilled.</h1>
        <p className="t-body max-w-[44ch] text-ink-2">Something broke on our side. Nothing you saved is lost.</p>
        {error?.digest && <p className="t-small">Ref {error.digest}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => reset()} className="btn btn-blue">Try again</button>
          {currentUser ? <Link href="/studio" className="btn btn-ghost">Go to my Studio</Link> : <Link href="/" className="btn btn-ghost">Go home</Link>}
        </div>
        <p className="t-small mt-2">
          Keeps happening? <Link href="/contact" className="inline-flex min-h-[40px] items-center font-semibold text-ink underline underline-offset-4">Tell us</Link>
          {error?.digest ? " and mention the ref above" : ""}
          <span aria-hidden="true"> · </span>
          <Link href="/art" className="inline-flex min-h-[40px] items-center font-semibold text-ink underline underline-offset-4">Browse art</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/help" className="inline-flex min-h-[40px] items-center font-semibold text-ink underline underline-offset-4">Help center</Link>
        </p>
      </div>
    </main>
  );
}
