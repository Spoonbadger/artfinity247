import { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import Logo from "@/components/af/Logo";

/** Quiet chrome for paying and after: logo, a lock, nothing to wander off to. */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100svh] flex-col bg-wall">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-2">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Secure checkout
          </span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="px-4 py-6 text-center text-[13px] text-ink-2">
        Questions? <Link href="/contact" className="font-semibold text-ink">Contact us</Link> · <Link href="/return-policy" className="font-semibold text-ink">Returns</Link>
      </footer>
    </div>
  );
}
