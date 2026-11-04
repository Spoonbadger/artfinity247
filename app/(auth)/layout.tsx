import { ReactNode } from "react";
import Logo from "@/components/af/Logo";
import AuthTopLink from "@/components/auth/AuthTopLink";
import WallBackdrop from "@/components/auth/WallBackdrop";

// Auth screens: a quiet gallery wall, the logo, and one card.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-[100svh] overflow-x-clip bg-wall">
      <WallBackdrop />
      <header className="relative z-10 mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:h-20 sm:px-8">
        <Logo />
        <AuthTopLink />
      </header>
      <main className="relative z-10 px-4 pb-16 pt-2 sm:px-8 sm:pt-8">{children}</main>
    </div>
  );
}
