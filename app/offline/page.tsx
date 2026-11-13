import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/af/Logo";
import CrookedFrame from "@/components/browse/Crooked";
import RetryButton from "./RetryButton";

// The page the service worker (public/sw.js) shows when a page can't load. It is cached once,
// so it must stay static and personal-data free. Changing it? Bump VERSION in public/sw.js.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-wall">
      <header className="border-b border-line bg-white px-4 py-3 sm:px-6">
        <Logo />
      </header>
      <main className="grid flex-1 place-content-center gap-8 px-4 py-14 text-center">
        <CrookedFrame>
          <svg viewBox="0 0 64 64" className="h-14 w-14 text-scan sm:h-16 sm:w-16" aria-hidden="true">
            <path d="M8 26a34 34 0 0 1 48 0M16 34a22 22 0 0 1 32 0M24 42a10 10 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <circle cx="32" cy="50" r="4" fill="currentColor" />
            <path d="M10 10l44 44" stroke="var(--af-coral)" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </CrookedFrame>
        <div className="grid justify-items-center gap-3">
          <h1 className="display text-[44px] sm:text-[60px]">You&rsquo;re offline.</h1>
          <p className="max-w-[34ch] text-[17px] text-ink-2">
            This page needs a connection. Nothing you saved is lost.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <RetryButton />
            <Link href="/studio" className="btn btn-ghost">Open the Studio</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
