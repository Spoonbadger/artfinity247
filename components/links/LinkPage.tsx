"use client";

import { CSSProperties, MouseEvent, ReactNode, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, EyeOff, Mail, Share } from "lucide-react";
import { LogoMark } from "@/components/af/Logo";
import { BrushStroke } from "@/components/af/Brush";
import Medal from "@/components/af/Medal";
import VerifiedBadge from "@/components/af/VerifiedBadge";
import { useSensitivePref } from "@/components/site/useSensitivePref";
import { medalFor } from "@/lib/medals";
import { cn } from "@/lib/utils";
import { artistPath, artPath, linksUrl } from "@/lib/urls";
import { FollowSheet, followLabel, useFollowState } from "@/components/follow/FollowButton";
import SocialIcon from "./SocialIcon";
import { FONT_PAIRS, linkFontVars } from "./fonts";
import { KIND_LABEL, iconFor, isLight, isSocialKind, type LinksPageData, type LinksTheme } from "./model";

type Mode = "page" | "preview";

/* ---------------- Background ---------------- */

function Background({ data, theme, mode }: { data: LinksPageData; theme: LinksTheme; mode: Mode }) {
  const [pref] = useSensitivePref();
  const [revealed, setRevealed] = useState(false);
  const art = data.background;
  const hidden = !!art?.sensitive.length && !pref && !revealed;
  const pos = mode === "page" ? "fixed" : "absolute";
  const scrim = theme.scrim === "strong" ? 0.55 : theme.scrim === "soft" ? 0.3 : 0;

  if (!art) {
    // No safe artwork yet: a painted wash in the artist's color.
    return (
      <div className={cn(pos, "inset-0 -z-0 overflow-hidden")} style={{ background: theme.washColor }} aria-hidden="true">
        <BrushStroke className="absolute -left-[20%] top-[12%] h-[30%] w-[140%] -rotate-6 opacity-20" color="#fff" />
        <BrushStroke className="absolute -left-[10%] bottom-[8%] h-[24%] w-[130%] rotate-3 opacity-15" color="#000" />
      </div>
    );
  }

  const wash = theme.bg === "wash";
  const blur = hidden ? "blur(34px) saturate(.8)" : theme.bg === "blur" ? "blur(22px) saturate(1.1)" : wash ? "blur(3px) grayscale(1) contrast(1.15)" : "none";

  return (
    <>
      <div className={cn(pos, "inset-0 -z-0 overflow-hidden")} style={wash ? { background: theme.washColor } : { background: "#15161b" }} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={art.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            filter: blur,
            transform: blur !== "none" && !wash ? "scale(1.15)" : undefined,
            opacity: wash ? 0.38 : 1,
            mixBlendMode: wash ? (isLight(theme.washColor) ? "multiply" : "luminosity") : undefined,
          }}
        />
        {wash && (
          <>
            <BrushStroke className="absolute -left-[25%] top-[6%] h-[22%] w-[150%] -rotate-[8deg] opacity-25" color={theme.washColor} />
            <BrushStroke className="absolute -left-[15%] top-[48%] h-[26%] w-[140%] rotate-[5deg] opacity-30" color={theme.washColor} />
          </>
        )}
        {!wash && scrim > 0 && <div className="absolute inset-0" style={{ background: `rgba(10,10,14,${scrim})` }} />}
        {!wash && <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-black/35 to-transparent" />}
      </div>
      {hidden && (
        <div className={cn(pos, "left-4 top-4 z-20")}>
          <button
            type="button"
            onClick={() => setRevealed(true)}
            title={`Background marked: ${art.sensitive.join(", ")}`}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white/85 px-3.5 text-[12.5px] font-bold text-ink shadow-sm backdrop-blur"
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            Show background
            <span className="sr-only"> (marked {art.sensitive.join(", ")})</span>
          </button>
        </div>
      )}
    </>
  );
}

/* ---------------- Buttons ---------------- */

function buttonLook(theme: LinksTheme): { className: string; style: CSSProperties; brush: boolean } {
  const solid: CSSProperties = { background: theme.buttonColor, color: theme.textColor };
  switch (theme.button) {
    case "rounded":
      return { className: "rounded-[10px] border-2 border-[#15161b] shadow-[4px_4px_0_#15161b]", style: solid, brush: false };
    case "brush":
      return { className: "rounded-none", style: { color: theme.textColor }, brush: true };
    case "outline":
      return {
        className: "rounded-full border-2 backdrop-blur-[2px]",
        style: { borderColor: theme.buttonColor, color: theme.buttonColor, background: isLight(theme.buttonColor) ? "rgba(0,0,0,.18)" : "rgba(255,255,255,.22)" },
        brush: false,
      };
    default:
      return { className: "rounded-full shadow-[0_2px_10px_rgba(0,0,0,.18)]", style: solid, brush: false };
  }
}

function LinkButton({ href, children, icon, theme }: { href: string; children: ReactNode; icon?: ReactNode; theme: LinksTheme }) {
  const look = buttonLook(theme);
  return (
    <a
      href={href}
      className={cn(
        "group relative z-0 flex min-h-[58px] w-full items-center justify-center px-14 py-3 text-center text-[16px] font-semibold leading-snug no-underline transition",
        "hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-white",
        look.className
      )}
      style={look.style}
    >
      {look.brush && <BrushStroke className="absolute inset-x-[-10px] inset-y-[-4px] -z-10 h-[calc(100%+8px)] w-[calc(100%+20px)]" color={theme.buttonColor} />}
      {icon && <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-90">{icon}</span>}
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </a>
  );
}

/* ---------------- Follow by email ---------------- */

function FollowLink({ data, theme, mode }: { data: LinksPageData; theme: LinksTheme; mode: Mode }) {
  const [open, setOpen] = useState(false);
  const state = useFollowState(data.slug);
  const look = buttonLook(theme);
  const first = data.name.split(" ")[0] || data.name;
  return (
    <>
      <button
        type="button"
        onClick={() => mode === "page" && setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "group relative z-0 flex min-h-[58px] w-full items-center justify-center px-14 py-3 text-center text-[16px] font-semibold leading-snug transition",
          "hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-white",
          look.className
        )}
        style={look.style}
      >
        {look.brush && <BrushStroke className="absolute inset-x-[-10px] inset-y-[-4px] -z-10 h-[calc(100%+8px)] w-[calc(100%+20px)]" color={theme.buttonColor} />}
        <Mail className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 opacity-90" aria-hidden="true" />
        <span>{followLabel(state, `Get new work from ${first}`)}</span>
      </button>
      <FollowSheet handle={data.slug} firstName={first} source="links" open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ---------------- Shop card ---------------- */

function ShopCard({ data, theme }: { data: LinksPageData; theme: LinksTheme }) {
  const [pref] = useSensitivePref();
  const look = buttonLook(theme);
  const outline = theme.button === "outline";
  const brush = theme.button === "brush";
  const radius = theme.button === "pill" ? "rounded-[26px]" : theme.button === "rounded" ? "rounded-[12px]" : outline ? "rounded-[26px]" : "rounded-[16px]";
  const cardStyle: CSSProperties = brush ? { background: theme.buttonColor, color: theme.textColor } : look.style;
  const tiles = theme.showShop ? data.tiles : [];

  return (
    <section aria-label="Shop my prints" className={cn("relative w-full overflow-hidden p-2", radius, look.className.replace(/rounded-\S+/g, ""))} style={cardStyle}>
      <a href={artistPath(data.slug)} className="flex min-h-[50px] items-center justify-between gap-3 rounded-[inherit] px-3 py-2 no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-current">
        <span className="grid text-left leading-tight">
          <b className="text-[16px]">Shop my prints</b>
          <span className="text-[12.5px] opacity-75">Printed and shipped by Artfinity</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
      </a>
      {tiles.length > 0 && (
        <ul className="mt-1 grid grid-cols-3 gap-1.5">
          {tiles.map((t) => {
            const blur = t.sensitive.length > 0 && !pref;
            return (
              <li key={t.id}>
                <a href={t.slug ? artPath(data.slug, t.slug) : artistPath(data.slug)} className="relative block aspect-square overflow-hidden rounded-[10px] bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.imageUrl} alt={t.title} loading="lazy" className={cn("h-full w-full object-cover transition group-hover:scale-105", blur && "sensitive-blur")} />
                  {blur && <span className="absolute inset-0 grid place-items-center bg-black/25 p-1 text-center text-[11px] font-bold text-white">{t.sensitive[0]}</span>}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Page ---------------- */

export default function LinkPage({ data, theme: themeOverride, mode = "page" }: { data: LinksPageData; theme?: LinksTheme; mode?: Mode }) {
  const theme = themeOverride ?? data.theme;
  const font = FONT_PAIRS[theme.font];
  const medal = medalFor(data.printsSold);
  const darkText = theme.bg === "wash" ? isLight(theme.washColor) : !data.background && isLight(theme.washColor);
  const ink = darkText ? "#15161b" : "#ffffff";
  const socials = data.links.filter((l) => isSocialKind(l.kind));
  const buttons = data.links.filter((l) => !isSocialKind(l.kind));
  const shareUrl = linksUrl(data.slug);

  // In the Studio preview, nothing navigates (and nothing is counted).
  const stopInPreview = (e: MouseEvent) => {
    if (mode !== "preview") return;
    const a = (e.target as HTMLElement).closest("a");
    if (a) e.preventDefault();
  };

  async function share() {
    const url = typeof window !== "undefined" && mode === "page" ? window.location.href.split("?")[0] : shareUrl;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${data.name} on Artfinity`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      /* cancelled */
    }
  }

  const Inner = mode === "page" ? "main" : "div";
  return (
    <div
      className={cn(linkFontVars, "relative isolate w-full", mode === "page" ? "min-h-[100svh]" : "min-h-full")}
      style={{ fontFamily: font.body, color: ink }}
      onClickCapture={stopInPreview}
    >
      <Background data={data} theme={theme} mode={mode} />

      {/* The live page is the whole document, so its content is the main landmark; the Studio preview isn't. */}
      <Inner className={cn("relative z-10 mx-auto flex w-full max-w-[480px] flex-col items-center px-5 pb-6 pt-10", mode === "page" ? "min-h-[100svh]" : "min-h-full")}>
        <button
          type="button"
          onClick={share}
          aria-label="Share this page"
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/85 text-ink shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Share className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        {/* Who */}
        {data.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatar} alt="" className="h-24 w-24 rounded-full border-[3px] object-cover shadow-lg" style={{ borderColor: ink }} />
        ) : (
          <span aria-hidden="true" className="grid h-24 w-24 place-items-center rounded-full bg-sticker text-[40px] font-extrabold text-ink shadow-lg" style={{ fontFamily: font.display }}>
            {data.name.slice(0, 1).toUpperCase()}
          </span>
        )}

        <h1
          className={cn("mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center leading-[0.95]", !darkText && "[text-shadow:0_2px_14px_rgba(0,0,0,.45)]")}
          style={{
            color: ink,
            fontFamily: font.display,
            fontWeight: font.displayWeight,
            fontVariationSettings: font.displaySettings ?? "normal",
            letterSpacing: font.tracking,
            fontSize: theme.font === "painted" ? 44 : 38,
          }}
        >
          <span className="[overflow-wrap:anywhere]">{data.name}</span>
          {(data.verified || medal) && (
            <span className="inline-flex items-center gap-1 [text-shadow:none]">
              {data.verified && <VerifiedBadge size={22} />}
              {medal && <Medal tier={medal.tier} size={24} />}
            </span>
          )}
        </h1>

        {data.bio && (
          <p className={cn("mt-2.5 line-clamp-3 max-w-[34ch] text-center text-[15px] leading-snug opacity-95", !darkText && "[text-shadow:0_1px_8px_rgba(0,0,0,.5)]")}>{data.bio}</p>
        )}

        {socials.length > 0 && (
          <ul className="mt-4 flex flex-wrap justify-center gap-1" aria-label="Socials">
            {socials.map((l) => {
              const kind = iconFor(l);
              const name = l.label || KIND_LABEL[kind];
              return (
                <li key={l.id}>
                  <a
                    href={`/api/links/${l.id}/click`}
                    aria-label={name}
                    title={name}
                    className={cn("grid h-11 w-11 place-items-center rounded-full transition hover:scale-110 focus-visible:outline focus-visible:outline-2", !darkText && "drop-shadow-[0_1px_6px_rgba(0,0,0,.45)]")}
                    style={{ outlineColor: ink }}
                  >
                    <SocialIcon kind={kind} className="h-[26px] w-[26px]" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        {/* Links */}
        <ul className={cn("mt-6 grid w-full", theme.button === "brush" ? "gap-4" : "gap-3")} aria-label="Links">
          {buttons.map((l) => {
            const kind = iconFor(l);
            return (
              <li key={l.id}>
                <LinkButton href={`/api/links/${l.id}/click`} theme={theme} icon={kind !== "custom" ? <SocialIcon kind={kind} /> : undefined}>
                  {l.label || KIND_LABEL[kind]}
                </LinkButton>
              </li>
            );
          })}
          <li className={cn(buttons.length > 0 && "mt-2")}>
            <ShopCard data={data} theme={theme} />
          </li>
          <li>
            <FollowLink data={data} theme={theme} mode={mode} />
          </li>
        </ul>

        <a
          href="/register?ref=links"
          className={cn(
            "mt-auto inline-flex items-center gap-1.5 rounded-full px-3 pb-1 pt-8 text-[12.5px] font-semibold no-underline opacity-90 hover:opacity-100",
            !darkText && "[text-shadow:0_1px_6px_rgba(0,0,0,.5)]"
          )}
        >
          <LogoMark className="h-4 w-4" inner={darkText ? "var(--af-scan)" : "#ffd43b"} />
          Made with Artfinity
        </a>
      </Inner>
    </div>
  );
}
