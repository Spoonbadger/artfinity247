import Link from "next/link";
import Logo from "@/components/af/Logo";
import CrookedFrame from "@/components/browse/Crooked";

export default function NotFound() {
  return (
    <div className="flex min-h-[100svh] flex-col">
      <header className="border-b border-line px-4 py-3 sm:px-6"><Logo /></header>
      <main className="grid flex-1 place-content-center gap-8 px-4 py-14 text-center">
        <CrookedFrame>
          <b className="display text-[64px] text-scan sm:text-[80px]">404</b>
        </CrookedFrame>
        <div className="grid justify-items-center gap-3">
          <h1 className="display text-[44px] sm:text-[60px]">This wall is empty.</h1>
          <p className="text-[17px] text-ink-2">The page moved, or never existed.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link href="/art" className="btn btn-ghost">Browse art</Link>
            <Link href="/" className="btn btn-blue">Go home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
