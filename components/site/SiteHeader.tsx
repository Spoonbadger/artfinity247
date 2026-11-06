"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Logo from "@/components/af/Logo";
import FollowButton from "@/components/follow/FollowButton";
import { useCart, useUser } from "@/components/contexts";
import { cn } from "@/lib/utils";
import { artistPath } from "@/lib/urls";
import SearchTypeahead from "@/components/forms/SearchTypeahead";

const LINKS = [
  { href: "/art", label: "Browse art" },
  { href: "/artists", label: "Artists" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * On an artist's painting and collection pages the artist is the star: a slim Artfinity bar, then a band with the
 * artist's name and Follow, in their page accent (Artist.pageTheme).
 */
export type HeaderBrand = {
  handle: string;
  name: string;
  avatar: string | null;
  /** The artist's page accent; Scan Blue when they haven't picked one. */
  accent?: { color: string; ink: string; soft: string } | null;
  /** The artist (or an admin) looking at their own piece: a small "Your piece · QR code" chip instead of Follow. */
  owner?: { href: string; note?: string | null } | null;
};
// An artist's storefront pages (/@handle, /@handle/art/…, /@handle/collections…) render their own header,
// so the layout's copy steps aside there. (On the server the path may be the rewritten /artists/handle form.)
const STOREFRONT = /^\/(@|artists\/)[^/]+(\/(art|collections)(\/.*)?)?\/?$/;
function isStorefront(pathname: string | null) {
  let p = pathname || "";
  try { p = decodeURIComponent(p); } catch {}
  return STOREFRONT.test(p);
}

const DABS = ["#f7c8a8", "#b8c4ff", "#ffd43b", "#a8dcc4", "#f5b3c8"];

function ArtistBand({ brand }: { brand: HeaderBrand }) {
  const href = artistPath(brand.handle);
  const initials = brand.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const firstName = brand.name.split(" ")[0] || brand.name;
  // the artist's page accent; Ultramarine (Scan Blue) like the artist page's default theme
  const accent = brand.accent ?? { color: "#2b37f0", ink: "#ffffff", soft: "#e6e8ff" };
  return (
    <div
      className="z-30 border-b border-line md:sticky md:top-0"
      style={{ background: accent.soft, ["--accent" as string]: accent.color, ["--accent-ink" as string]: accent.ink }}
    >
      <div className="mx-auto flex h-12 max-w-[1240px] items-center gap-3 px-4 sm:px-6 md:h-14">
        <Link href={href} className="group flex min-w-0 items-center gap-2.5 text-ink no-underline">
          <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gallery shadow-[0_0_0_2px_#fff] md:h-9 md:w-9">
            {brand.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center font-display text-[13px] font-extrabold text-ink" style={{ background: DABS[(brand.name.charCodeAt(0) || 0) % DABS.length] }} aria-hidden>
                {initials}
              </span>
            )}
          </span>
          <span className="min-w-0 truncate leading-none">
            <b className="font-display text-[18px] font-extrabold tracking-[-0.01em] group-hover:underline md:text-[20px]">{brand.name}</b>
            <span className="text-[13px] font-medium text-ink-2"> on Artfinity</span>
          </span>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link href={href} className="hidden min-h-[36px] items-center rounded-full px-3 text-[14px] font-semibold text-ink no-underline hover:bg-white/70 sm:inline-flex">
            All work
          </Link>
          {brand.owner ? (
            <a href={brand.owner.href} target="_blank" rel="noopener" className="inline-flex min-h-[36px] items-center gap-1 rounded-full border-[1.5px] border-edge-strong bg-white px-3 text-[13px] font-semibold text-ink no-underline hover:border-ink">
              Your piece{brand.owner.note ? <span className="hidden font-normal text-ink-2 sm:inline"> · {brand.owner.note}</span> : null} · QR code
            </a>
          ) : (
            <FollowButton
              handle={brand.handle}
              firstName={firstName}
              className="btn btn-sm min-h-[36px] px-4"
              doneClassName="btn-ghost bg-white"
              idleStyle={{ background: "var(--accent)", borderColor: "var(--accent)", color: "var(--accent-ink)" }}
            />
          )}
        </div>
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

  const isActive = (href: string) => pathname === href;
  const menu = (
    <nav
      id="site-menu"
      className={cn(
        "grid gap-1 border-t border-line px-4 pb-4 pt-3",
        brand ? "md:absolute md:right-6 md:top-full md:z-50 md:w-[320px] md:rounded-2xl md:border md:bg-white md:shadow-[0_18px_40px_-12px_rgba(21,22,27,.35)]" : "md:hidden",
      )}
      aria-label="Menu"
    >
      <form onSubmit={search} role="search" aria-label="Search Artfinity" className="mb-1">
        <div className="relative flex h-12 items-center gap-2 rounded-full border-2 border-ink bg-white pl-4 pr-1.5 focus-within:border-scan">
          <Search className="h-5 w-5 shrink-0 text-ink-2" aria-hidden="true" />
          <SearchTypeahead value={q} onChange={setQ} onNavigate={() => { setOpen(false); setQ(""); }} placeholder="Search art, artists, neighborhoods" inputClassName="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-2" />
          <button type="submit" className="btn btn-sm min-h-[38px]">Go</button>
        </div>
      </form>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-lg font-semibold text-ink no-underline hover:bg-wall">
          {l.label}
        </Link>
      ))}
      <Link href="/collector" aria-current={isActive("/collector") ? "page" : undefined} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-lg font-semibold text-ink no-underline hover:bg-wall">Your orders</Link>
      {currentUser ? (
        brand && <Link href="/studio" onClick={() => setOpen(false)} className="btn btn-blue mt-2">My Studio</Link>
      ) : (
        <>
          <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-lg font-semibold text-ink no-underline hover:bg-wall">Log in</Link>
          <Link href="/register" onClick={() => setOpen(false)} className="btn btn-blue mt-2">Start selling free</Link>
        </>
      )}
    </nav>
  );
  const menuButton = (
    <button
      type="button"
      className={cn("-mr-1.5 grid h-11 w-11 place-items-center rounded-full hover:bg-wall", !brand && "md:hidden")}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls="site-menu"
      aria-label="Menu"
    >
      {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
  const cart = (
    <Link href="/cart" className="relative grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-wall" aria-label={`Cart, ${count} items`}>
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      {count > 0 && <span className="num absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-scan px-1 text-[11px] font-bold text-white">{count}</span>}
    </Link>
  );

  // An artist's painting or collection: Artfinity is the quiet host (slim bar), the artist gets the band below.
  if (brand)
    return (
      <>
        <header className="relative z-40 border-b border-line bg-white">
          <div className="mx-auto flex h-11 max-w-[1240px] items-center gap-1 px-4 sm:px-6">
            <Logo className="text-[17px]" />
            <div className="ml-auto flex items-center">
              <Link href="/search" className="grid h-11 w-11 place-items-center rounded-full text-ink hover:bg-wall" aria-label="Search">
                <Search className="h-5 w-5" aria-hidden="true" />
              </Link>
              {cart}
              {menuButton}
            </div>
          </div>
          {open && menu}
        </header>
        <ArtistBand brand={brand} />
      </>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1240px] items-center gap-6 px-4 py-3 sm:px-6">
        <Logo />
        <nav className="ml-auto hidden items-center gap-6 text-[15px] font-medium md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={cn("text-ink no-underline hover:text-scan", isActive(l.href) && "text-scan")}>{l.label}</Link>
          ))}
          {currentUser ? null : <Link href="/login" className="text-ink no-underline hover:text-scan">Log in</Link>}
        </nav>
        <form onSubmit={search} role="search" aria-label="Search Artfinity" className="hidden lg:block">
          <div className="relative flex h-10 w-44 items-center gap-2 rounded-full border-[1.5px] border-line bg-white pl-3 pr-1 transition-[width,border-color] focus-within:w-60 focus-within:border-ink">
            <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            <SearchTypeahead value={q} onChange={setQ} onNavigate={() => setQ("")} placeholder="Search" listClassName="left-auto w-[min(380px,calc(100vw-32px))]" inputClassName="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-2" />
          </div>
        </form>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/search" className="hidden h-11 w-11 place-items-center rounded-full text-ink hover:bg-wall md:grid lg:hidden" aria-label="Search">
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
          {cart}
          {currentUser ? (
            <Link href="/studio" className="btn btn-sm min-h-[44px] px-4 md:min-h-0">My Studio</Link>
          ) : (
            <Link href="/register" className="btn btn-sm hidden sm:inline-flex">Start selling free</Link>
          )}
          {menuButton}
        </div>
      </div>
      {open && menu}
    </header>
  );
}
