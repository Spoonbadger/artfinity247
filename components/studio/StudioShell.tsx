"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { ArrowUpRight, LogOut, Menu, X } from "lucide-react";
import Logo from "@/components/af/Logo";
import { useUser } from "@/components/contexts";
import { cn } from "@/lib/utils";
import ProChip from "@/components/pro/ProChip";

import StudioNav, { STUDIO_SECTIONS, activeItem } from "./StudioNav";

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

export default function StudioShell({ artist, children }: { artist: ShellArtist; children: ReactNode }) {
  const path = usePathname() || "/studio";
  const router = useRouter();
  const { refreshUser } = useUser();
  const [leaving, setLeaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
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
    <div className="flex items-center gap-2.5 border-t border-line pt-4 text-[13px]">
      <Avatar src={artist.profileImage} name={artist.name} />
      <div className="min-w-0 flex-1 leading-tight">
        <b className="flex min-w-0 items-center gap-1.5"><span className="truncate">{artist.name}</span>{artist.pro && <ProChip />}</b>
        <span className="block truncate text-ink-2">@{artist.slug}</span>
      </div>
      <button type="button" onClick={logout} disabled={leaving} className="grid h-11 w-11 place-items-center rounded-full text-ink-2 hover:bg-white hover:text-ink" aria-label="Log out" title="Log out">
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );

  // Logo goes to the main site; the "Studio" tag next to it goes to the Studio dashboard.
  const brand = (size: string) => (
    <span className="flex items-center gap-2">
      <Logo href="/" className={cn("py-2.5", size)} />
      <Link href="/studio" className="group flex min-h-[44px] items-center no-underline">
        <span className="rounded-full border border-line bg-white/70 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-2 group-hover:text-ink">Studio</span>
      </Link>
    </span>
  );

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[244px_minmax(0,1fr)] lg:bg-[linear-gradient(to_right,var(--af-wall)_244px,#fff_244px)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-5 border-r border-line bg-wall py-6 lg:flex" style={canvasTexture}>
        <div className="-my-2.5 px-6">{brand("text-[22px]")}</div>
        <StudioNav path={path} className="min-h-0 flex-1 overflow-y-auto px-4 [scrollbar-width:thin]" />
        <div className="grid gap-3 px-4">
          <Link href={`/@${artist.slug}`} className="btn btn-ghost btn-sm justify-between">
            View my page <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {userRow}
        </div>
      </aside>

      {/* Phones: the logo row scrolls away; only the menu bar stays pinned. */}
      <div className="border-b border-line bg-wall lg:hidden" style={canvasTexture}>
        <div className="flex items-center justify-between gap-3 px-4 py-0.5">
          <span className="flex min-w-0 items-center gap-2">
            {brand("text-[20px]")}
            {artist.pro && <Link href="/studio/infinity" aria-label="the Infinity plan" className="hidden min-[380px]:inline-flex"><ProChip /></Link>}
          </span>
          <Link href={`/@${artist.slug}`} className="btn btn-ghost btn-sm min-h-[44px] shrink-0 px-4" aria-label="View my page">
            My page <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
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
            {hereSection && <span className="text-ink-2">{hereSection.label} / </span>}
            {here?.label ?? "Menu"}
          </span>
          <span className="text-[13px] font-bold text-ink-2">Menu</span>
        </button>
      </div>

      {menuOpen && (
        <div id="studio-menu" role="dialog" aria-modal="true" aria-label="Studio menu" className="fixed inset-0 z-50 flex flex-col bg-wall lg:hidden" style={canvasTexture}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-0.5">
            {brand("text-[20px]")}
            <button ref={closeButton} type="button" onClick={() => setMenuOpen(false)} className="-mr-1.5 grid h-11 w-11 place-items-center rounded-full text-ink-2 hover:bg-white hover:text-ink" aria-label="Close menu">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-3">
            <StudioNav path={path} size="lg" onNavigate={() => setMenuOpen(false)} />
            <div className="mt-4 grid gap-3 px-1">
              <Link href={`/@${artist.slug}`} className="btn btn-ghost min-h-[44px] justify-between">
                View my page <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              {userRow}
            </div>
          </div>
        </div>
      )}

      <main id="studio-main" className="min-w-0">{children}</main>
    </div>
  );
}
