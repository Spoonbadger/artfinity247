"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, LogOut, Menu, X } from "lucide-react";
import Logo from "@/components/af/Logo";
import { Swatch } from "@/components/af/Brush";
import { useUser } from "@/components/contexts";
import { cn } from "@/lib/utils";
import ProChip from "@/components/pro/ProChip";
import ProMark from "@/components/pro/ProMark";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

import StudioNav, { STUDIO_SECTIONS, activeItem } from "./StudioNav";
import StudioSearch from "./StudioSearch";

export { STUDIO_NAV, STUDIO_SECTIONS, STUDIO_HOME } from "./StudioNav";

/** A faint canvas weave for the Studio walls. */
export const canvasTexture = {
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(21,22,27,.025) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(21,22,27,.02) 0 1px, transparent 1px 4px)",
};

type ShellArtist = { name: string; slug: string; profileImage: string | null; pro?: boolean };

export function Avatar({ src, name, className }: { src: string | null; name: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)} />
  ) : (
    <span aria-hidden="true" className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sticker font-display text-sm font-extrabold text-ink", className)}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function StudioShell({ artist, children, badges }: { artist: ShellArtist; children: ReactNode; badges?: Record<string, number> }) {
  const path = usePathname() || "/studio";
  const router = useRouter();
  const { refreshUser } = useUser();
  const [leaving, setLeaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useFocusTrap(menu, menuOpen, { restoreFocus: false }); // the effect below hands focus back to the Menu button
  const here = activeItem(path);
  const hereSection = STUDIO_SECTIONS.find((s) => here && s.items.includes(here));

  // Close the phone menu on navigation.
  useEffect(() => setMenuOpen(false), [path]);

  // Phone menu: lock page scroll, focus the close button, Escape closes.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    const btn = menuButton.current;
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      btn?.focus();
    };
  }, [menuOpen]);

  async function logout() {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      await refreshUser();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  const userRow = (
    <div className="flex min-w-0 items-center gap-2.5 border-t border-line pt-4 text-[13px]">
      <Avatar src={artist.profileImage} name={artist.name} />
      <div className="min-w-0 flex-1 leading-tight">
        <b className="flex min-w-0 items-center gap-1"><span className="truncate">{artist.name}</span>{artist.pro && <ProMark />}</b>
        <span className="block truncate text-ink-2">@{artist.slug}</span>
      </div>
      <button type="button" onClick={logout} disabled={leaving} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white hover:text-ink" aria-label="Log out" title="Log out">
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );

  // Logo goes to the main site; the "Studio" tag next to it goes to the Studio dashboard.
  const brand = (size: string) => (
    <span className="flex items-center gap-2">
      <Logo href="/" className={cn("py-2.5", size)} />
      <Link href="/studio" className="group flex min-h-[44px] items-center no-underline">
        <span className="rounded-full border border-line bg-white/70 px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-2 group-hover:text-ink">Studio</span>
      </Link>
    </span>
  );

  // Header like the admin's: back to the site, the Studio swatch, search, then room on the right for more.
  // 69px tall (44px swatch + 24px padding + border); pinned on desktop, where the sidebar sits under it.
  const header = (
    <header className="z-40 border-b border-line bg-white/95 backdrop-blur lg:sticky lg:top-0">
      <div className="flex items-center gap-2.5 px-4 py-3 sm:gap-4 sm:px-6">
        <nav aria-label="Studio shortcuts" className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            aria-label="Back to site"
            title="Back to site"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-edge-strong bg-white text-ink no-underline transition hover:border-ink"
          >
            <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
          </Link>
          <Link href="/studio" aria-label="Studio home" title="Studio home" className="group relative inline-grid h-11 shrink-0 place-items-center px-5 no-underline">
            <Swatch color="var(--af-scan)" className="absolute inset-0 h-full w-full transition group-hover:scale-[1.04]" />
            <span className="display relative text-[24px] leading-none text-white">Studio</span>
          </Link>
          {artist.pro && <Link href="/studio/infinity" aria-label="the Infinity plan" className="hidden min-[440px]:inline-flex"><ProChip /></Link>}
        </nav>
        <StudioSearch className="shrink-0 sm:ml-2" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link href={`/@${artist.slug}`} className="btn btn-ghost btn-sm h-10 min-h-[40px] px-4">
            My page <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-white">
      {header}
      <div className="lg:grid lg:grid-cols-[244px_minmax(0,1fr)] lg:bg-[linear-gradient(to_right,var(--af-wall)_244px,#fff_244px)]">
      {/* Desktop sidebar, under the pinned header */}
      <aside className="sticky top-[69px] hidden h-[calc(100svh-69px)] flex-col gap-5 border-r border-line bg-wall py-6 lg:flex" style={canvasTexture}>
        <StudioNav path={path} badges={badges} className="min-h-0 flex-1 overflow-y-auto px-4 [scrollbar-width:thin]" />
        <div className="grid gap-3 px-4">{userRow}</div>
      </aside>

      {/* Phones: the header scrolls away; only the menu bar stays pinned. */}
      <div className="sticky top-0 z-30 border-b border-line bg-wall px-2 py-1.5 lg:hidden" style={canvasTexture}>
        <button
          ref={menuButton}
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="studio-menu"
          className="flex min-h-[44px] w-full items-center gap-2.5 rounded-md px-3 text-left font-semibold text-ink hover:bg-white/70"
        >
          <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            {hereSection && hereSection.label !== here?.label && <span className="text-ink-2">{hereSection.label} / </span>}
            {here?.label ?? "Menu"}
          </span>
          <span className="text-[13px] font-bold text-ink-2">Menu</span>
        </button>
      </div>

      {menuOpen && (
        <div ref={menu} id="studio-menu" role="dialog" aria-modal="true" aria-label="Studio menu" className="fixed inset-0 z-50 flex flex-col bg-wall lg:hidden" style={canvasTexture}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-0.5">
            {brand("text-[20px]")}
            <button ref={closeButton} type="button" onClick={() => setMenuOpen(false)} className="-mr-1.5 grid h-11 w-11 place-items-center rounded-full text-ink-2 hover:bg-white hover:text-ink" aria-label="Close menu">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-3">
            <StudioNav path={path} badges={badges} size="lg" onNavigate={() => setMenuOpen(false)} />
            <div className="mt-4 grid gap-3 px-1">{userRow}</div>
          </div>
        </div>
      )}

      <main id="studio-main" className="af-app min-w-0">
        <InstallPrompt />
        {children}
      </main>
      </div>
    </div>
  );
}
