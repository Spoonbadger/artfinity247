"use client";

import Link from "next/link";
import CrookedFrame from "@/components/browse/Crooked";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
        <h1 className="display text-[44px] sm:text-[60px]">Paint spilled.</h1>
        <p className="text-[17px] text-ink-2">Something broke on our side. Try again.</p>
        {error?.digest && <p className="text-[12.5px] text-ink-2">Ref {error.digest}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn btn-ghost">Go home</Link>
          <button type="button" onClick={() => reset()} className="btn btn-blue">Try again</button>
        </div>
      </div>
    </main>
  );
}
