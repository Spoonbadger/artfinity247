"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withNext } from "./next";
import { useUser } from "@/components/contexts";

/** Top-right link in the auth bar: points to whichever screen you are not on. */
export default function AuthTopLink() {
  const path = usePathname() || "";
  const { currentUser } = useUser();
  const next = useSearchParams().get("next");
  if (currentUser && (path.startsWith("/change-password") || path.startsWith("/email-confirmed"))) {
    return <Link href="/studio" className="btn btn-ghost btn-sm">Studio</Link>;
  }
  if (path.startsWith("/register")) {
    return (
      <span className="text-[14.5px] text-ink-2">
        <span className="hidden sm:inline">Have a page? </span>
        <Link href={withNext("/login", next)} className="inline-flex min-h-[44px] items-center px-1 font-bold text-ink underline decoration-2 underline-offset-4 hover:text-scan">Log in</Link>
      </span>
    );
  }
  // A text link, not a button: the form below has the page's one primary button.
  return (
    <Link href={withNext("/register", next)} className="inline-flex min-h-[44px] items-center px-1 text-[14.5px] font-bold text-ink underline decoration-2 underline-offset-4 hover:text-scan">
      Start selling free
    </Link>
  );
}
