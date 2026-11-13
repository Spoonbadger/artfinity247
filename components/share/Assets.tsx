"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import { failed, problemFrom, saved } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import {
  CHANNELS, IMAGE_FORMATS, IMAGE_LAYOUTS, artLink, captions, dollars,
  type Channel, type ImageFormat, type ImageLayout, type ShareArt,
} from "./shareData";

// ---------------- small pieces ----------------
async function copyText(text: string, html?: string) {
  try {
    if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
    } else {
      await navigator.clipboard.writeText(text);
    }
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, html, label = "Copy", className, big }: { text: string; html?: string; label?: string; className?: string; big?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={cn("btn btn-ghost", big ? "" : "btn-sm", className)}
      onClick={async () => {
        if (await copyText(text, html)) { setDone(true); saved(label === "Copy" ? "Copied" : `${label.replace(/^Copy /, "")[0].toUpperCase()}${label.replace(/^Copy /, "").slice(1)} copied`, { description: "Paste it where you post." }); setTimeout(() => setDone(false), 1600); }
        else failed("Couldn't copy", { description: "Your browser blocked it. Select the text and copy it by hand." });
      }}
    >
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? "Copied" : label}
    </button>
  );
}

function useCanShare(probe?: () => boolean) {
  const [ok, setOk] = useState(false);
  useEffect(() => { try { setOk(probe ? probe() : typeof navigator.share === "function"); } catch { setOk(false); } }, [probe]);
  return ok;
}

const imgUrl = (slug: string, f: ImageFormat, l: ImageLayout, dl = false) =>
  `/api/share/image?art=${encodeURIComponent(slug)}&format=${f}&layout=${l}${dl ? "&dl=1" : ""}`;

// ---------------- images ----------------
const fileProbe = () => typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([new Uint8Array(1)], "x.png", { type: "image/png" })] });

export function ImageAssets({ art }: { art: ShareArt }) {
  const [format, setFormat] = useState<ImageFormat>("story");
  const canShareFiles = useCanShare(fileProbe);
  const F = IMAGE_FORMATS[format];

  const [busy, setBusy] = useState<string | null>(null);

  /** Fetch the image first so a failure says why instead of saving a broken file. */
  const getImage = async (l: ImageLayout): Promise<Blob | null> => {
    try {
      const res = await fetch(imgUrl(art.slug, format, l));
      if (!res.ok) {
        const p = await problemFrom(res, "Couldn't make that image.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => download(l) });
        return null;
      }
      return await res.blob();
    } catch {
      failed("You seem to be offline", { description: "Check your connection and try again.", retry: () => download(l) });
      return null;
    }
  };

  const download = async (l: ImageLayout) => {
    if (busy) return;
    setBusy(l);
    const blob = await getImage(l);
    setBusy(null);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${art.slug}-${format}-${l}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    saved("Image downloaded", { description: "It's in your downloads. Grab a caption from the Captions tab." });
  };

  const shareFile = async (l: ImageLayout) => {
    const blob = await getImage(l);
    if (!blob) return;
    try {
      const file = new File([blob], `${art.slug}-${format}-${l}.png`, { type: "image/png" });
      await navigator.share({ files: [file], title: art.title });
    } catch (e) {
      if ((e as Error).name !== "AbortError") failed("Couldn't open sharing", { description: "Download the image instead and post it from your photos." });
    }
  };

  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Size" className="flex max-w-full flex-wrap gap-1.5">
        {(Object.keys(IMAGE_FORMATS) as ImageFormat[]).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={format === f} onClick={() => setFormat(f)}
            className={cn("rounded-full border-2 px-4 py-2 text-[14px] font-bold leading-tight", format === f ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>
            {IMAGE_FORMATS[f].name} <span className={cn("ml-1 text-[13px] font-normal", format === f ? "text-white/70" : "text-ink-2")}>{IMAGE_FORMATS[f].sub}</span>
          </button>
        ))}
      </div>
      <div className={cn("grid gap-5", format === "landscape" ? "md:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3")} role="tabpanel">
        {(Object.keys(IMAGE_LAYOUTS) as ImageLayout[]).map((l) => (
          <figure key={`${art.slug}-${format}-${l}`} className="grid content-start gap-3">
            <a href={imgUrl(art.slug, format, l)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line bg-wall" style={{ aspectRatio: `${F.w} / ${F.h}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl(art.slug, format, l)} alt={`${F.name} image, ${IMAGE_LAYOUTS[l].name}: ${art.title}`} loading="lazy" width={F.w} height={F.h} className="h-full w-full object-cover" />
            </a>
            <figcaption className="flex items-baseline justify-between gap-2">
              <b className="text-[15px]">{IMAGE_LAYOUTS[l].name}</b>
              <span className="text-[13px] text-ink-2">{IMAGE_LAYOUTS[l].sub}</span>
            </figcaption>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button type="button" onClick={() => download(l)} disabled={busy === l} className="btn py-3 sm:py-2.5"><Download size={16} aria-hidden="true" /> {busy === l ? "Making it…" : "Download"}</button>
              {canShareFiles && <button type="button" onClick={() => shareFile(l)} className="btn btn-ghost" aria-label={`Share ${IMAGE_LAYOUTS[l].name} image`} title="Share"><Share2 size={16} aria-hidden="true" /></button>}
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}

// ---------------- captions ----------------
export function Captions({ art, base }: { art: ShareArt; base: string }) {
  const list = useMemo(() => captions(art, artLink(base, art.handle, art.slug, "share-post")), [art, base]);
  return (
    <ol className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-3">
      {list.map((c, i) => (
        <li key={i} className="grid min-w-0 content-between gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="whitespace-pre-wrap text-[14.5px] leading-snug [overflow-wrap:anywhere]">{c}</p>
          <CopyButton text={c} label="Copy caption" className="w-max" />
        </li>
      ))}
    </ol>
  );
}

// ---------------- links ----------------
function openUrl(ch: Channel, art: ShareArt, base: string, link: string) {
  const text = `${art.title} by ${art.artist}. Prints from ${dollars(art.fromCents)}.`;
  if (ch === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
  if (ch === "pinterest") {
    const media = new URL(imgUrl(art.slug, "story", "wall"), base).toString();
    return `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(link)}&media=${encodeURIComponent(media)}&description=${encodeURIComponent(text)}`;
  }
  if (ch === "email") return `mailto:?subject=${encodeURIComponent(art.title)}&body=${encodeURIComponent(`${text}\n\n${link}`)}`;
  return null;
}
const HINT: Record<Channel, string> = {
  instagram: "Bio or story link sticker",
  tiktok: "Bio link",
  facebook: "Post or page",
  pinterest: "Pin it",
  email: "Newsletter or email",
};

export function ShareLinks({ art, base }: { art: ShareArt; base: string }) {
  const canShare = useCanShare();
  const shareLink = artLink(base, art.handle, art.slug, "share-native");
  return (
    <div className="grid gap-3">
      {canShare && (
        <button
          type="button"
          className="btn btn-blue btn-lg w-full sm:w-max"
          onClick={() => navigator.share({ title: art.title, text: `${art.title} by ${art.artist}. Prints from ${dollars(art.fromCents)}.`, url: shareLink }).catch(() => {})}
        >
          <Share2 size={18} /> Share…
        </button>
      )}
      <ul className="grid gap-2">
        {CHANNELS.map((c) => {
          const link = artLink(base, art.handle, art.slug, `share-${c.key}`);
          const open = openUrl(c.key, art, base, link);
          return (
            <li key={c.key} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[auto_150px_minmax(0,1fr)_auto]">
              <span className="paint-dab" style={{ ["--dab" as string]: c.dab }} />
              <span className="grid leading-tight">
                <b className="text-[15px]">{c.name}</b>
                <span className="text-[13px] text-ink-2">{HINT[c.key]}</span>
              </span>
              <label className="col-span-2 min-w-0 sm:col-span-1">
                <span className="sr-only">{c.name} link</span>
                <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="w-full min-w-0 truncate rounded-lg border border-line bg-wall px-3 py-2 text-[13.5px] text-ink-2 outline-none focus:border-scan" />
              </label>
              <div className="col-span-2 flex gap-2 sm:col-span-1">
                <CopyButton text={link} className="flex-1 sm:flex-none" />
                {open && (
                  <a href={open} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm flex-1 sm:flex-none">
                    <ExternalLink size={15} /> {c.key === "email" ? "Write" : c.key === "pinterest" ? "Pin" : "Post"}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------- embed + email signature ----------------
const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function embedSnippet(art: ShareArt, base: string) {
  const src = new URL(`/embed/art/${encodeURIComponent(art.slug)}`, base).toString();
  return `<iframe src="${src}" width="320" height="460" style="border:0;max-width:100%" loading="lazy" title="${escAttr(`${art.title} by ${art.artist}`)}"></iframe>`;
}

export function signatureHtml(art: ShareArt, base: string) {
  const link = artLink(base, art.handle, art.slug, "share-email-signature");
  const img = new URL(`/api/share/painting?art=${encodeURIComponent(art.slug)}&w=160`, base).toString();
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;color:#15161b"><tr>` +
    `<td style="padding-right:12px;vertical-align:top"><a href="${link}"><img src="${img}" width="64" alt="${escAttr(art.title)}" style="display:block;border:0;border-radius:4px"></a></td>` +
    `<td style="vertical-align:top"><b>${escAttr(art.artist)}</b><br><a href="${link}" style="color:#15161b">${escAttr(art.title)}</a><br>` +
    `<a href="${link}" style="display:inline-block;margin-top:6px;padding:5px 12px;background:#8b2a4b;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:bold">Buy a print</a></td>` +
    `</tr></table>`;
}

export function EmbedKit({ art, base }: { art: ShareArt; base: string }) {
  const snippet = embedSnippet(art, base);
  const sig = signatureHtml(art, base);
  const sigText = `${art.artist}\n${art.title}: buy a print\n${artLink(base, art.handle, art.slug, "share-email-signature")}`;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-3">
        <h3 className="t-card">Website widget</h3>
        <div className="flex justify-center rounded-2xl border border-line bg-wall p-4">
          <iframe key={art.slug} src={`/embed/art/${encodeURIComponent(art.slug)}`} width={320} height={460} className="max-w-full border-0" loading="lazy" title={`Widget preview: ${art.title}`} />
        </div>
        <label className="grid gap-1">
          <span className="text-[13px] text-ink-2">Paste into your site</span>
          <textarea readOnly value={snippet} rows={3} onFocus={(e) => e.currentTarget.select()} className="w-full resize-none rounded-xl border border-line bg-wall p-3 text-[13px] text-ink-2 outline-none focus:border-scan" />
        </label>
        <CopyButton text={snippet} label="Copy code" big className="w-full sm:w-max" />
      </div>
      <div className="grid content-start gap-3">
        <h3 className="t-card">Email signature</h3>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="mb-3 text-[13px] text-ink-2">Thanks,</p>
          <div dangerouslySetInnerHTML={{ __html: sig }} />
        </div>
        <p className="text-[13px] text-ink-2">Gmail: Settings, Signature, paste.</p>
        <div className="grid gap-2 sm:flex">
          <CopyButton text={sigText} html={sig} label="Copy signature" big />
          <CopyButton text={sig} label="Copy HTML" big />
        </div>
      </div>
    </div>
  );
}
