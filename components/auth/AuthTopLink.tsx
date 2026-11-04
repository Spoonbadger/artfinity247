"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Top-right link in the auth bar: points to whichever screen you are not on. */
export default function AuthTopLink() {
  const path = usePathname() || "";
  if (path.startsWith("/register")) {
    return (
      <span className="text-[14.5px] text-ink-2">
        <span className="hidden sm:inline">Have a page? </span>
        <Link href="/login" className="font-bold text-ink underline decoration-2 underline-offset-4 hover:text-scan">Log in</Link>
      </span>
    );
  }
  return <Link href="/register" className="btn btn-blue btn-sm">Start selling free</Link>;
}
