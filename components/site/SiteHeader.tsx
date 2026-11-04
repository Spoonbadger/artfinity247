"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Logo from "@/components/af/Logo";
import { useCart, useUser } from "@/components/contexts";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/art", label: "Browse art" },
  { href: "/artists", label: "Artists" },
  { href: "/#how", label: "How it works" },
];

export default function SiteHeader() {
  const { currentUser } = useUser();
  const { cartItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const search = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    setOpen(false);
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };
  // close the phone menu on navigation and on Escape
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !(e.target as Element)?.closest?.("header") && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  const count = cartItems?.reduce((n: number, i: any) => n + (i.quantity || 1), 0) || 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1240px] items-center gap-6 px-4 py-3 sm:px-6">
        <Logo />
        <nav className="ml-auto hidden items-center gap-6 text-[15px] font-medium md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={cn("text-ink no-underline hover:text-scan", pathname === l.href && "text-scan")}>{l.label}</Link>
          ))}
          {currentUser ? null : <Link href="/login" className="text-ink no-underline hover:text-scan">Log in</Link>}
        </nav>
        <form onSubmit={search} role="search" className="hidden lg:block">
          <label className="flex h-10 w-44 items-center gap-2 rounded-full border-[1.5px] border-line bg-white pl-3 pr-1 transition-[width,border-color] focus-within:w-60 focus-within:border-ink">
            <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            <span className="sr-only">Search art, artists and cities</span>
            <input type="search" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" maxLength={80} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-2" />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/search" className="hidden h-11 w-11 place-items-center rounded-full text-ink hover:bg-wall md:grid lg:hidden" aria-label="Search">
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link href="/cart" className="relative grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-wall" aria-label={`Cart, ${count} items`}>
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && <span className="num absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-scan px-1 text-[11px] font-bold text-white">{count}</span>}
          </Link>
          {currentUser ? (
            <Link href="/studio" className="btn btn-blue btn-sm min-h-[44px] px-4 md:min-h-0">My Studio</Link>
          ) : (
            <Link href="/register" className="btn btn-blue btn-sm hidden sm:inline-flex">Start selling free</Link>
          )}
          <button type="button" className="-mr-1.5 grid h-11 w-11 place-items-center rounded-full hover:bg-wall md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="grid gap-1 border-t border-line px-4 pb-4 pt-3 md:hidden" aria-label="Mobile">
          <form onSubmit={search} role="search" className="mb-1">
            <label className="flex h-12 items-center gap-2 rounded-full border-2 border-ink bg-white pl-4 pr-1.5 focus-within:border-scan">
              <Search className="h-5 w-5 shrink-0 text-ink-2" aria-hidden="true" />
              <span className="sr-only">Search art, artists and cities</span>
              <input type="search" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search art, artists, cities" maxLength={80} enterKeyHint="search" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-2" />
              <button type="submit" className="btn btn-blue btn-sm min-h-[38px]">Go</button>
            </label>
          </form>
          {LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-lg font-semibold text-ink no-underline hover:bg-wall">{l.label}</Link>)}
          {!currentUser && <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-lg font-semibold text-ink no-underline hover:bg-wall">Log in</Link>}
          {!currentUser && <Link href="/register" onClick={() => setOpen(false)} className="btn btn-blue mt-2">Start selling free</Link>}
        </nav>
      )}
    </header>
  );
}
