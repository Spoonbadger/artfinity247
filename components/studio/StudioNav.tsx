"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { ChevronDown, Coins, LayoutTemplate, Palette, QrCode, UserRound, Users, type LucideIcon } from "lucide-react";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";
import { PAINTING_SCANS } from "@/lib/features";

export type StudioNavItem = { href: string; label: string; dab: string };
export type StudioSection = { id: string; label: string; dab: string; icon: LucideIcon; items: StudioNavItem[] };

/** Always on top, outside the folders. */
export const STUDIO_HOME: StudioNavItem = { href: "/studio", label: "Studio", dab: "#2b37f0" };

export const STUDIO_SECTIONS: StudioSection[] = [
  {
    id: "art", label: "Art", dab: "#e8743b", icon: Palette,
    items: [
      { href: "/studio/art", label: "My art", dab: "#e8743b" },
      { href: "/studio/collections", label: "Collections", dab: "#c98a5a" },
      { href: "/studio/rooms", label: "Rooms", dab: "#5bc0be" },
      { href: "/studio/bulk", label: "Bulk prints", dab: "#ff5a36" },
      ...(PAINTING_SCANS ? [{ href: "/studio/scanning", label: "Painting scans", dab: "#2b37f0" }] : []),
    ],
  },
  {
    id: "selling", label: "QR & selling", dab: "#ffd43b", icon: QrCode,
    items: [
      { href: "/studio/qr", label: "QR codes", dab: "#ffd43b" },
      { href: "/studio/qr/queue", label: "Print queue", dab: "#ff5a36" },
      { href: "/studio/codes", label: "My codes", dab: "#2b37f0" },
      { href: "/studio/places", label: "Places", dab: "#0f7a55" },
      { href: "/studio/events", label: "Events", dab: "#7b2d8e" },
    ],
  },
  {
    id: "page", label: "Page", dab: "#9aa0ff", icon: LayoutTemplate,
    items: [
      { href: "/studio/page", label: "My page", dab: "#15161b" },
      { href: "/studio/design", label: "Design", dab: "#f5b3c8" },
      { href: "/studio/links", label: "Links", dab: "#5bc0be" },
      { href: "/studio/developers", label: "Embed", dab: "#9aa0ff" },
    ],
  },
  {
    id: "audience", label: "Audience", dab: "#f5b3c8", icon: Users,
    items: [
      { href: "/studio/customers", label: "Customers", dab: "#c98a5a" },
      { href: "/studio/followers", label: "Followers", dab: "#f5b3c8" }, // tabs: Followers | Newsletter
      { href: "/studio/reviews", label: "Reviews", dab: "#ffd43b" },
      { href: "/studio/share", label: "Share kit", dab: "#ff5a36" },
      { href: "/studio/automations", label: "Automations", dab: "#7b2d8e" },
      { href: "/studio/emails", label: "Buyer emails", dab: "#9aa0ff" },
    ],
  },
  {
    id: "money", label: "Money", dab: "#0f7a55", icon: Coins,
    items: [
      { href: "/studio/sales", label: "Sales", dab: "#0f7a55" },
      { href: "/studio/money", label: "Money", dab: "#0f7a55" },
      { href: "/studio/analytics", label: "Analytics", dab: "#2b37f0" },
    ],
  },
  {
    id: "account", label: "Account", dab: "#e3b23c", icon: UserRound,
    items: [
      { href: "/studio/infinity", label: "Infinity plan", dab: "#e3b23c" },
      { href: "/studio/verify", label: "Verify", dab: "#2b37f0" },
      { href: "/studio/purchases", label: "My purchases", dab: "#c98a5a" },
      { href: "/help", label: "Help center", dab: "#9aa0ff" },
    ],
  },
];

/** Flat list for anything that wants every Studio link (search, palettes, tests). */
export const STUDIO_NAV: StudioNavItem[] = [STUDIO_HOME, ...STUDIO_SECTIONS.flatMap((s) => s.items)];

export function isActive(path: string, href: string) {
  // The print queue lives under /studio/qr but has its own nav item.
  if (href === "/studio/qr" && path.startsWith("/studio/qr/queue")) return false;
  if (href === "/studio/followers" && path.startsWith("/studio/newsletter")) return true;
  if (href === "/studio/infinity" && path.startsWith("/studio/pro")) return true;
  return href === "/studio" ? path === "/studio" : path === href || path.startsWith(href + "/");
}

export function activeItem(path: string) {
  return STUDIO_NAV.find((n) => isActive(path, n.href));
}

function sectionFor(path: string) {
  return STUDIO_SECTIONS.find((s) => s.items.some((n) => isActive(path, n.href)))?.id;
}

const STORE_KEY = "af.studio.folder";

function readStore(): string | null {
  try {
    const v = window.localStorage.getItem(STORE_KEY);
    return v || null;
  } catch {
    return null;
  }
}

function writeStore(v: string | null) {
  try {
    if (v) window.localStorage.setItem(STORE_KEY, v);
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode etc. */
  }
}

/**
 * One folder open at a time, so the menu stays short: opening one closes the others. The current page's folder opens
 * on each page; elsewhere (Studio home) the last folder you opened comes back from localStorage.
 */
function useFolders(path: string) {
  const current = sectionFor(path);
  const [openId, setOpenId] = useState<string | null>(current ?? null);

  // Animate only after the saved state has been applied, so a fresh load doesn't slide open.
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (!current) setOpenId((o) => o ?? readStore());
    const t = window.setTimeout(() => setAnimate(true), 50);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on first load
  }, []);

  useEffect(() => {
    if (current) setOpenId(current);
  }, [current]);

  const toggle = useCallback((id: string) => {
    setOpenId((o) => {
      const next = o === id ? null : id;
      writeStore(next);
      return next;
    });
  }, []);

  const open: Record<string, boolean> = openId ? { [openId]: true } : {};
  return { open, toggle, animate };
}

export function NavItem({ href, label, dab, active, size = "md", onNavigate, badge }: StudioNavItem & { active: boolean; size?: "md" | "lg"; onNavigate?: () => void; badge?: number }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative z-0 flex items-center gap-2.5 rounded-md px-3 font-semibold text-ink no-underline",
        size === "lg" ? "min-h-[48px] text-[16px]" : "min-h-[40px] py-2 text-[15px]",
        !active && "hover:bg-white/70"
      )}
    >
      <i className="paint-dab" style={{ ["--dab" as string]: active ? dab : "var(--af-edge)" }} />
      <span className="truncate">{label}</span>
      {!!badge && <span className="num ml-auto rounded-full bg-coral px-1.5 text-[12px] font-bold leading-[18px] text-white" aria-label={`${badge} waiting`}>{badge > 99 ? "99+" : badge}</span>}
      {active && <BrushStroke className="absolute -left-1 top-[3px] -z-10 h-[calc(100%-6px)] w-[calc(100%+8px)]" />}
    </Link>
  );
}

function Folder({ section, path, open, onToggle, size, animate, onNavigate, badges }: { section: StudioSection; path: string; open: boolean; onToggle: () => void; size: "md" | "lg"; animate: boolean; onNavigate?: () => void; badges?: Record<string, number> }) {
  const panelId = useId();
  const Icon = section.icon;
  const hasActive = section.items.some((n) => isActive(path, n.href));
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-md px-2 text-left font-display font-extrabold tracking-[-0.01em] text-ink hover:bg-white/70",
          size === "lg" ? "min-h-[52px] text-[17px]" : "min-h-[40px] text-[15px]"
        )}
      >
        {/* a soft blob behind the icon: muted, in the folder's colour only when you're in it */}
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center"
          style={{ borderRadius: "52% 44% 58% 40%", background: hasActive ? `color-mix(in srgb, ${section.dab} 30%, transparent)` : "rgb(var(--af-ink-rgb) / 0.06)" }}
        >
          <Icon className="h-[15px] w-[15px]" strokeWidth={2.25} />
        </span>
        <span className="flex-1">{section.label}</span>
        {hasActive && !open && <i aria-hidden="true" className="paint-dab !h-2 !w-2" style={{ ["--dab" as string]: "var(--af-scan)" }} />}
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 text-ink-2 transition-transform duration-200 motion-reduce:transition-none group-hover:text-ink", open && "rotate-180")}
        />
      </button>
      {/* grid-rows 0fr → 1fr animates height; visibility keeps closed links out of the tab order */}
      <div
        id={panelId}
        className={cn(
          "grid duration-200 ease-out motion-reduce:transition-none",
          animate && "transition-[grid-template-rows,visibility]",
          open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={cn("grid gap-0.5 pb-2 pt-0.5", size === "lg" ? "pl-4" : "pl-3")}>
            {section.items.map((n) => (
              <NavItem key={n.href} {...n} size={size} active={isActive(path, n.href)} onNavigate={onNavigate} badge={badges?.[n.href]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Home on top, then the folders. Shared by the desktop sidebar and the phone menu. */
/** `badges`: a count beside a link, by href (e.g. cards waiting in the print queue). */
export default function StudioNav({ path, size = "md", onNavigate, className, badges }: { path: string; size?: "md" | "lg"; onNavigate?: () => void; className?: string; badges?: Record<string, number> }) {
  const { open, toggle, animate } = useFolders(path);
  return (
    <nav aria-label="Studio" className={cn("grid content-start gap-1", className)}>
      <NavItem {...STUDIO_HOME} size={size} active={isActive(path, STUDIO_HOME.href)} onNavigate={onNavigate} />
      <span aria-hidden="true" className="mx-3 my-1.5 border-t border-dashed border-line" />
      {STUDIO_SECTIONS.map((s) => (
        <Folder key={s.id} section={s} path={path} open={!!open[s.id]} onToggle={() => toggle(s.id)} size={size} animate={animate} onNavigate={onNavigate} badges={badges} />
      ))}
    </nav>
  );
}
