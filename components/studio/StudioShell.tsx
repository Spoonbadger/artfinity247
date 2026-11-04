"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { ArrowUpRight, LogOut } from "lucide-react";
import Logo from "@/components/af/Logo";
import { BrushStroke } from "@/components/af/Brush";
import { useUser } from "@/components/contexts";
import { cn } from "@/lib/utils";

export const STUDIO_NAV = [
  { href: "/studio", label: "Studio", dab: "#2b37f0" },
  { href: "/studio/art", label: "My art", dab: "#e8743b" },
  { href: "/studio/qr", label: "QR codes", dab: "#ffd43b" },
  { href: "/studio/events", label: "Events", dab: "#7b2d8e" },
  { href: "/studio/sales", label: "Sales", dab: "#0f7a55" },
  { href: "/studio/page", label: "My page", dab: "#15161b" },
];

/** A faint canvas weave for the Studio walls. */
export const canvasTexture = {
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(21,22,27,.025) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(21,22,27,.02) 0 1px, transparent 1px 4px)",
};

type ShellArtist = { name: string; slug: string; profileImage: string | null };

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

function isActive(path: string, href: string) {
  return href === "/studio" ? path === "/studio" : path === href || path.startsWith(href + "/");
}

function NavItem({ href, label, dab, active, compact = false }: { href: string; label: string; dab: string; active: boolean; compact?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative z-0 flex shrink-0 items-center gap-2.5 rounded-md font-semibold text-ink no-underline",
        compact ? "px-3 py-2 text-[14px]" : "px-3 py-2.5 text-[15.5px] hover:bg-white/70"
      )}
    >
      <i className="paint-dab" style={{ ["--dab" as string]: dab }} />
      {label}
      {active && <BrushStroke className="absolute -left-1 top-[3px] -z-10 h-[calc(100%-6px)] w-[calc(100%+8px)]" />}
    </Link>
  );
}

export default function StudioShell({ artist, children }: { artist: ShellArtist; children: ReactNode }) {
  const path = usePathname() || "/studio";
  const router = useRouter();
  const { refreshUser } = useUser();
  const [leaving, setLeaving] = useState(false);

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

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[244px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-7 border-r border-line bg-wall px-4 py-6 lg:flex" style={canvasTexture}>
        <Logo href="/studio" className="pl-2 text-[22px]" />
        <nav aria-label="Studio" className="grid gap-1">
          {STUDIO_NAV.map((n) => (
            <NavItem key={n.href} {...n} active={isActive(path, n.href)} />
          ))}
        </nav>
        <div className="mt-auto grid gap-3">
          <Link href={`/@${artist.slug}`} className="btn btn-ghost btn-sm justify-between">
            View my page <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-2.5 border-t border-line pt-4 text-[13px]">
            <Avatar src={artist.profileImage} name={artist.name} />
            <div className="min-w-0 flex-1 leading-tight">
              <b className="block truncate">{artist.name}</b>
              <span className="block truncate text-ink-2">@{artist.slug}</span>
            </div>
            <button type="button" onClick={logout} disabled={leaving} className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-white hover:text-ink" aria-label="Log out" title="Log out">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-wall lg:hidden" style={canvasTexture}>
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <Logo href="/studio" className="text-[20px]" />
          <div className="flex items-center gap-1.5">
            <Link href={`/@${artist.slug}`} className="btn btn-ghost btn-sm" aria-label="View my page">
              My page <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button type="button" onClick={logout} disabled={leaving} className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-white" aria-label="Log out">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav aria-label="Studio" className="flex gap-1 overflow-x-auto px-2 pb-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STUDIO_NAV.map((n) => (
            <NavItem key={n.href} {...n} compact active={isActive(path, n.href)} />
          ))}
        </nav>
      </header>

      <main id="studio-main" className="min-w-0">{children}</main>
    </div>
  );
}
