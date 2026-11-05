import Link from "next/link";
import Logo from "@/components/af/Logo";
import CrookedFrame from "@/components/browse/Crooked";
import { getUserFromCookie } from "@/lib/auth";

export default async function NotFound() {
  // Signed in: the Studio is the most likely place they meant to go.
  const user = await getUserFromCookie().catch(() => null);
  return (
    <div className="flex min-h-[100svh] flex-col">
      <header className="border-b border-line px-4 py-3 sm:px-6"><Logo /></header>
      <main className="grid flex-1 place-content-center gap-8 px-4 py-14 text-center">
        <CrookedFrame>
          <b className="display text-[52px] text-scan sm:text-[60px]">404</b>
        </CrookedFrame>
        <div className="grid justify-items-center gap-3">
          <h1 className="display text-[44px] sm:text-[60px]">This wall is empty.</h1>
          <p className="max-w-[44ch] text-[17px] text-ink-2">The page moved, or never existed. Check the address, or pick up from one of these.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {user ? <Link href="/studio" className="btn btn-blue">Go to my Studio</Link> : <Link href="/" className="btn btn-blue">Go home</Link>}
            <Link href="/art" className="btn btn-ghost">Browse art</Link>
            {user ? <Link href="/" className="btn btn-ghost">Home</Link> : <Link href="/artists" className="btn btn-ghost">Find an artist</Link>}
          </div>
          <p className="mt-2 text-[14.5px] text-ink-2">
            Looking for something specific? <Link href="/help" className="whitespace-nowrap font-semibold text-ink underline underline-offset-4">Help center</Link>
            <span aria-hidden="true"> · </span>
            <Link href="/contact" className="whitespace-nowrap font-semibold text-ink underline underline-offset-4">Contact us</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
