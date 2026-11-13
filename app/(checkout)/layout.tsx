import { ReactNode } from "react";
import Link from "next/link";
import Logo from "@/components/af/Logo";
import SecureBadge from "./SecureBadge";

/** Quiet chrome for paying and after: logo, a lock while paying, nothing to wander off to. */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100svh] flex-col bg-wall">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <SecureBadge />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="t-small px-4 py-6 text-center">
        Questions? <Link href="/contact" className="font-semibold text-ink">Contact us</Link> · <Link href="/return-policy" className="font-semibold text-ink">Returns</Link>
      </footer>
    </div>
  );
}
