"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Logo, { LogoMark } from "@/components/af/Logo";
import { useCart, useUser } from "@/components/contexts";
import { cn } from "@/lib/utils";
import { artistPath } from "@/lib/urls";

const LINKS = [
  { href: "/art", label: "Browse art" },
  { href: "/artists", label: "Artists" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

/** On an artist's pages the artist's name takes the wordmark's place. */
export type HeaderBrand = { handle: string; name: string; avatar: string | null };

// An artist's storefront pages (/@handle, /@handle/art/…, /@handle/collections…) render their own header,
// so the layout's copy steps aside there. (On the server the path may be the rewritten /artists/handle form.)
const STOREFRONT = /^\/(@|artists\/)[^/]+(\/(art|collections)(\/.*)?)?\/?$/;
function isStorefront(pathname: string | null) {
  let p = pathname || "";
  try { p = decodeURIComponent(p); } catch {}
  return STOREFRONT.test(p);
}

const DABS = ["#f7c8a8", "#b8c4ff", "#ffd43b", "#a8dcc4", "#f5b3c8"];

function ArtistBrand({ brand }: { brand: HeaderBrand }) {
  const href = artistPath(brand.handle);
  const initials = brand.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gallery shadow-[0_0_0_2px_#fff,0_0_0_3.5px_var(--af-line)] sm:h-11 sm:w-11">
        {brand.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center font-display text-[15px] font-extrabold text-ink" style={{ background: DABS[(brand.name.charCodeAt(0) || 0) % DABS.length] }}>{initials}</span>
        )}
      </Link>
      <div className="grid min-w-0 gap-1">
        <Link href={href} className="display truncate pb-0.5 text-[22px] leading-none text-ink no-underline hover:text-scan sm:text-[25px]">{brand.name}</Link>
        <Link href="/" className="inline-flex w-fit items-center gap-1 text-[11.5px] font-semibold leading-none text-ink-2 no-underline hover:text-scan">
          <LogoMark className="h-3.5 w-3.5" />
          on Artfinity
        </Link>
      </div>
    </div>
  );
}

/**
 * `brand`: show the artist's name instead of the wordmark. Pages that render their own header pass it
 * (or `inPage` for a plain one, e.g. not-found); the layout's header hides on storefront paths.
 */
export default function SiteHeader({ brand = null, inPage = false }: { brand?: HeaderBrand | null; inPage?: boolean }) {
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
  const hidden = !brand && !inPage && isStorefront(pathname);

  if (hidden) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1240px] items-center gap-6 px-4 py-3 sm:px-6">
        {brand ? <ArtistBrand brand={brand} /> : <Logo />}
        <nav className={cn("ml-auto hidden items-center gap-6 text-[15px] font-medium md:flex", brand && "shrink-0")} aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={cn("text-ink no-underline hover:text-scan", pathname === l.href && "text-scan")}>{l.label}</Link>
          ))}
          {currentUser ? null : <Link href="/login" className="text-ink no-underline hover:text-scan">Log in</Link>}
        </nav>
        <form onSubmit={search} role="search" className="hidden lg:block">
          <label className="flex h-10 w-44 items-center gap-2 rounded-full border-[1.5px] border-line bg-white pl-3 pr-1 transition-[width,border-color] focus-within:w-60 focus-within:border-ink">
            <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            <span className="sr-only">Search art, artists and neighborhoods</span>
            <input type="search" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" maxLength={80} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-2" />
          </label>
        </form>
        <div className={cn("ml-auto flex items-center gap-2 md:ml-0", brand && "shrink-0")}>
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
              <span className="sr-only">Search art, artists and neighborhoods</span>
              <input type="search" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search art, artists, neighborhoods" maxLength={80} enterKeyHint="search" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-2" />
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
