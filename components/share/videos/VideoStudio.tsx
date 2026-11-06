"use client";
// Share kit → Videos: pick a piece and a preset, watch the live preview, make a 6–15 s video (vertical 1080 × 1920 or
// square 1080 × 1080) in the browser, then download it, share it (phones) and copy a caption.
// Three presets are free; six more, brand colors, a logo outro and music are Infinity (shown locked, never dead).
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Copy, Download, Lock, Share2, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { failed, problemFrom, saved } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";
import StartInfinityButton from "@/components/pro/StartInfinityButton";
import { Problem } from "@/components/studio/Problem";
import { artLink, captions, handleText, type ShareArt } from "@/components/share/shareData";
import {
  DEFAULT_BRAND, FORMATS, MUSIC, PRESETS, SEASONS, presetOf, seasonFor,
  type BrandColors, type MusicId, type PresetId, type Season, type VideoFormat,
} from "@/lib/social/presets";
import { daysUntil, type VideoSpec } from "./engine";
import { previewTrack } from "./music";
import { useVideo } from "./useVideo";
import VideoStage from "./VideoStage";
import type { AssetRequest, PieceRef } from "./assets";

type Extras = {
  socialFeature: boolean;
  profileImage: string | null;
  roomScenes: Record<string, number[]>;
  collections: { id: string; title: string; slugs: string[] }[];
  events: { id: string; name: string; start: string }[];
  scale: { n: number; note: string } | null;
};

const inDays = (n: number) => { const d = new Date(Date.now() + n * 86_400_000); return d.toISOString().slice(0, 10); };

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function Unlock({ className, primary }: { className?: string; primary?: boolean }) {
  return <StartInfinityButton label="Unlock with Infinity" icon={<Lock size={14} aria-hidden="true" />} className={cn("btn btn-sm", primary && "btn-blue", className)} />;
}

function Fold({ title, sub, open, children }: { title: string; sub: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-2xl border border-line">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="grid leading-tight">
          <b className="text-[15px]">{title}</b>
          <span className="text-[13px] text-ink-2">{sub}</span>
        </span>
        <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-3 px-4 pb-4">{children}</div>
    </details>
  );
}

export default function VideoStudio({ art, arts, base, pro }: { art: ShareArt; arts: ShareArt[]; base: string; pro: boolean }) {
  const [preset, setPreset] = useState<PresetId>("room-tour");
  const [format, setFormat] = useState<VideoFormat>("vertical");
  const [extras, setExtras] = useState<Extras | null>(null);
  const [walk, setWalk] = useState<string[]>([]);
  const [collection, setCollection] = useState<string>("all");
  const [dropDate, setDropDate] = useState(inDays(3));
  const [dropLabel, setDropLabel] = useState("New drop");
  const [season, setSeason] = useState<Season>(seasonFor());
  const [brand, setBrand] = useState<BrandColors>(DEFAULT_BRAND);
  const [logo, setLogo] = useState<"none" | "profile" | "file">("none");
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [music, setMusic] = useState<MusicId>("none");
  const [canShare, setCanShare] = useState(false);
  const stopListen = useRef<() => void>(() => {});
  const def = presetOf(preset);
  const locked = def.tier === "infinity" && !pro;

  useEffect(() => {
    let live = true;
    fetch("/api/studio/videos").then(async (r) => {
      if (!r.ok) throw Object.assign(new Error("extras"), { res: r });
      const j = (await r.json()) as Extras;
      if (live) setExtras(j);
    }).catch(() => live && setExtras({ socialFeature: true, profileImage: null, roomScenes: {}, collections: [], events: [], scale: null }));
    return () => { live = false; };
  }, []);
  useEffect(() => () => stopListen.current(), []);
  useEffect(() => { if (extras?.events[0]) { setDropDate(extras.events[0].start); setDropLabel(extras.events[0].name.slice(0, 40)); } }, [extras]);
  // the gallery walk starts with the chosen piece plus the next few
  useEffect(() => { setWalk([art.slug, ...arts.filter((a) => a.slug !== art.slug).map((a) => a.slug)].slice(0, 5)); }, [art.slug, arts]);

  const ref = (a: ShareArt): PieceRef => ({ slug: a.slug, title: a.title, fromCents: a.fromCents, roomScenes: extras?.roomScenes[a.slug] ?? null });
  const bySlug = useMemo(() => new Map(arts.map((a) => [a.slug, a])), [arts]);
  const col = extras?.collections.find((c) => c.id === collection) ?? null;
  const pieceList: ShareArt[] = useMemo(() => {
    if (preset === "gallery-walk") return walk.map((s) => bySlug.get(s)).filter(Boolean) as ShareArt[];
    if (preset === "carousel") return ((col ? col.slugs : arts.map((a) => a.slug)).map((s) => bySlug.get(s)).filter(Boolean) as ShareArt[]).slice(0, 8);
    return [art];
  }, [preset, walk, col, arts, art, bySlug]);
  const needsMore = def.pieces === "many" && pieceList.length < 2;

  const req: AssetRequest | null = !extras || needsMore ? null : {
    preset,
    pieces: pieceList.map(ref),
    qrUrl: artLink(base, art.handle, pieceList[0]?.slug ?? art.slug, "share-video"),
    scale: extras.scale,
    logoUrl: pro ? (logo === "profile" ? extras.profileImage : logo === "file" ? logoFile : null) : null,
  };
  const spec: VideoSpec = {
    preset,
    format,
    brand: pro ? brand : DEFAULT_BRAND,
    text: {
      artist: art.artist,
      handle: handleText(base, art.handle),
      cta: "Scan or tap to buy",
      headline: preset === "carousel" ? col?.title : preset === "countdown" ? dropLabel : preset === "gallery-walk" ? `Works by ${art.artist}` : undefined,
      dropDate: preset === "countdown" ? dropDate : undefined,
      season: preset === "seasonal" ? season : undefined,
    },
  };
  const v = useVideo(locked ? null : req, spec, pro ? music : "none");
  const link = artLink(base, art.handle, art.slug, "instagram");
  const [caption, setCaption] = useState("");
  useEffect(() => { setCaption(captions(art, link)[1]); }, [art, link]);

  useEffect(() => {
    if (!v.result) { setCanShare(false); return; }
    const f = new File([v.result.blob], "video." + v.result.type.ext, { type: v.result.blob.type });
    setCanShare(typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [f] }));
  }, [v.result]);

  const fileName = v.result ? `${art.slug}-${preset}-${format}.${v.result.type.ext}` : "";
  const make = async () => {
    try {
      const r = await v.make();
      if (r) saved("Your video is ready", { description: r.type.ext === "webm" ? "This browser made a WebM. Instagram and TikTok take MP4 best: make it in Chrome or Safari for MP4." : "Press Download, then post it." });
    } catch (e) {
      if ((e as Error).name === "AbortError") return saved("Stopped", { description: "Nothing was saved. Press Make video to start again." });
      console.error(e);
      failed("The video didn't finish", { description: "Keep this tab open while it records. Closing or switching tabs can stop it.", retry: make });
    }
  };
  const share = async () => {
    if (!v.result) return;
    try {
      await navigator.share({ files: [new File([v.result.blob], fileName, { type: v.result.blob.type })], title: art.title, text: caption });
      saved("Shared");
    } catch (e) {
      if ((e as Error).name !== "AbortError") failed("Couldn't open sharing", { description: "Download the video instead, then post it from your gallery." });
    }
  };
  const setConsent = async (on: boolean) => {
    const before = extras?.socialFeature ?? true;
    setExtras((x) => (x ? { ...x, socialFeature: on } : x));
    try {
      const res = await fetch("/api/studio/videos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ socialFeature: on }) });
      if (!res.ok) {
        const p = await problemFrom(res, "Couldn't save that setting");
        setExtras((x) => (x ? { ...x, socialFeature: before } : x));
        return failed(p.message, { fix: p.fix, retry: () => setConsent(on) });
      }
      saved(on ? "Artfinity may feature your work" : "Artfinity won't feature your work", { description: on ? "We credit your @handle in every post." : "Anything waiting in our queue was removed." });
    } catch {
      setExtras((x) => (x ? { ...x, socialFeature: before } : x));
      failed("You seem to be offline", { description: "Check your connection and try again.", retry: () => setConsent(on) });
    }
  };
  const listen = () => {
    stopListen.current();
    stopListen.current = previewTrack(music, 5);
  };

  if (!arts.length) {
    return <EmptyState title="Videos need a piece first" body="Once a painting is approved, you can make videos of it here." action={{ label: "Upload art", href: "/studio/art/new" }} help={{ label: "What's in the Share kit", href: "/help/growing/share-kit" }} />;
  }

  const busy = v.busy;
  const pct = Math.round((v.progress || 0) * 100);
  const free = PRESETS.filter((p) => p.tier === "free");
  const extra = PRESETS.filter((p) => p.tier === "infinity");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-10">
      {/* stage */}
      <div className="mx-auto grid w-full max-w-[300px] content-start gap-3 lg:max-w-[340px]">
        {locked ? (
          <div className="relative overflow-hidden rounded-[22px] border-[1.5px] border-ink bg-ink" style={{ aspectRatio: FORMATS[format].ratio }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.imageUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-[2px]" />
            <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-6 text-center text-white">
              <Lock size={28} aria-hidden="true" />
              <p className="text-[15px] font-bold">{def.name} is an Infinity preset</p>
              <Unlock primary />
            </div>
          </div>
        ) : needsMore ? (
          <EmptyState compact title={preset === "carousel" ? "A carousel needs 2 or more pieces" : "A gallery walk needs 2 or more pieces"} body="Pick more pieces, or add another painting." action={{ label: "Upload art", href: "/studio/art/new" }} secondary={preset === "carousel" ? { label: "Make a collection", href: "/studio/collections" } : undefined} />
        ) : (
          <VideoStage spec={spec} assets={v.assets} problem={v.problem} retry={v.retry} result={v.result} busy={busy} title={pieceList.map((p) => p.title).join(", ")} />
        )}
        <p className="text-center text-[13px] text-ink-2">
          {FORMATS[format].w} × {FORMATS[format].h} · {Math.round(v.seconds * 10) / 10} s · {v.result ? v.result.type.label : busy ? "recording" : "live preview"}
        </p>
      </div>

      {/* controls */}
      <div className="grid min-w-0 content-start gap-6">
        <fieldset>
          <legend className="mb-2 text-[15px] font-bold">Preset</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {free.map((p) => (
              <button key={p.id} type="button" aria-pressed={preset === p.id} disabled={busy} onClick={() => setPreset(p.id)}
                className={cn("flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition sm:block", preset === p.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>
                <span className="paint-dab sm:mb-2" style={{ ["--dab" as string]: p.dab }} aria-hidden="true" />
                <span className="grid">
                  <b className="text-[15px] leading-tight">{p.name}</b>
                  <span className={cn("text-[12.5px]", preset === p.id ? "text-white/75" : "text-ink-2")}>{p.sub}</span>
                </span>
              </button>
            ))}
            {pro && extra.map((p) => (
              <button key={p.id} type="button" aria-pressed={preset === p.id} disabled={busy} onClick={() => setPreset(p.id)}
                className={cn("flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition sm:block", preset === p.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>
                <span className="paint-dab sm:mb-2" style={{ ["--dab" as string]: p.dab }} aria-hidden="true" />
                <span className="grid">
                  <b className="text-[15px] leading-tight">{p.name}</b>
                  <span className={cn("text-[12.5px]", preset === p.id ? "text-white/75" : "text-ink-2")}>{p.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div role="radiogroup" aria-label="Format" className="flex w-max gap-1 rounded-full border-2 border-ink p-1">
          {(Object.keys(FORMATS) as VideoFormat[]).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={format === f} disabled={busy} onClick={() => setFormat(f)}
              className={cn("rounded-full px-4 py-1.5 text-[14px] font-bold", format === f ? "bg-ink text-white" : "text-ink")}>
              {FORMATS[f].label}
            </button>
          ))}
        </div>

        {/* preset options */}
        {!locked && preset === "gallery-walk" && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[15px] font-bold">Pieces on the wall <span className="font-normal text-ink-2">(2 to 6)</span></legend>
            <div className="flex flex-wrap gap-2">
              {arts.map((a) => {
                const on = walk.includes(a.slug);
                return (
                  <label key={a.slug} className={cn("flex cursor-pointer items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[13.5px] font-semibold", on ? "border-ink bg-ink/5" : "border-line")}>
                    <input type="checkbox" checked={on} disabled={busy || (!on && walk.length >= 6)} onChange={() => setWalk((w) => (on ? w.filter((s) => s !== a.slug) : [...w, a.slug]))} />
                    {a.title}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {!locked && preset === "carousel" && (
          <label className="af-field max-w-[420px]">
            <small>Collection</small>
            <select value={collection} onChange={(e) => setCollection(e.target.value)} disabled={busy}>
              <option value="all">All my pieces</option>
              {extras?.collections.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.slugs.length})</option>)}
            </select>
          </label>
        )}
        {!locked && preset === "countdown" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="af-field"><small>Drop date</small><input type="date" value={dropDate} min={inDays(0)} onChange={(e) => setDropDate(e.target.value)} disabled={busy} /></label>
            <label className="af-field"><small>Label</small><input value={dropLabel} maxLength={40} onChange={(e) => setDropLabel(e.target.value)} disabled={busy} /></label>
            <p className="text-[13px] text-ink-2 sm:col-span-2">Counts down to {daysUntil(dropDate)} {daysUntil(dropDate) === 1 ? "day" : "days"}. {extras?.events.length ? "Filled in from your next event." : ""}</p>
          </div>
        )}
        {!locked && preset === "seasonal" && (
          <label className="af-field max-w-[320px]">
            <small>Season</small>
            <select value={season} onChange={(e) => setSeason(e.target.value as Season)} disabled={busy}>
              {(Object.keys(SEASONS) as Season[]).map((s) => <option key={s} value={s}>{SEASONS[s].label}: {SEASONS[s].line}</option>)}
            </select>
          </label>
        )}

        {/* make / progress / result */}
        {v.type === null ? (
          <Problem tone="warning" title="This browser can't record video" fix={{ label: "Use the images instead", href: "#images" }}>
            Open this page in Chrome, Edge or Safari to make videos. Images work everywhere.
          </Problem>
        ) : locked ? null : (
          <div className="grid gap-3">
            {busy ? (
              <div className="grid gap-2" aria-live="polite">
                <div className="flex items-center justify-between text-[14px]">
                  <b>Painting your video…</b>
                  <span className="num text-ink-2">{pct}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full border-2 border-ink bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Rendering">
                  <div className="h-full bg-sticker transition-[width] duration-200" style={{ width: `${pct}%` }} />
                </div>
                <button type="button" onClick={v.stop} className="btn btn-ghost btn-sm w-max"><Square size={14} aria-hidden="true" /> Stop</button>
              </div>
            ) : v.result ? (
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <a href={v.result.url} download={fileName} onClick={() => saved("Video downloaded", { description: "It's in your downloads, ready for Reels, TikTok or Shorts." })} className="btn btn-blue btn-lg"><Download size={18} aria-hidden="true" /> Download {v.result.type.label}</a>
                {canShare && <button type="button" onClick={share} className="btn btn-ghost btn-lg"><Share2 size={18} aria-hidden="true" /> Share…</button>}
                <button type="button" onClick={v.clear} className="btn btn-ghost btn-lg">Back to preview</button>
              </div>
            ) : (
              <button type="button" onClick={make} disabled={!v.assets || !v.type || needsMore} className="btn btn-blue btn-lg w-full sm:w-max">Make video</button>
            )}
            {v.type?.ext === "webm" && !busy && (
              <Problem tone="info" title="This browser only makes WebM videos">
                Instagram and TikTok take MP4 best. For MP4, open this page in Chrome or Safari, or convert the file before posting.
              </Problem>
            )}
          </div>
        )}

        <div className="grid gap-2">
          <label className="af-field">
            <small>Caption</small>
            <textarea rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </label>
          <button type="button" className="btn btn-ghost btn-sm w-max" onClick={async () => {
            if (await copy(caption)) saved("Caption copied", { description: "Paste it when you post the video." });
            else failed("Couldn't copy", { description: "Your browser blocked it. Select the text and copy it by hand." });
          }}><Copy size={14} aria-hidden="true" /> Copy caption</button>
        </div>

        {/* Extras: Infinity presets and your look, folded so the main path stays short */}
        {pro ? (
          <Fold title="Your look" sub="Brand colors, a logo at the end, music">

              <div className="flex flex-wrap gap-3">
                {([["bg", "Background"], ["accent", "Accent"], ["ink", "Text"]] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-[13.5px] font-semibold">
                    <input type="color" value={brand[k]} disabled={busy} onChange={(e) => setBrand((b) => ({ ...b, [k]: e.target.value }))} className="h-9 w-12 cursor-pointer rounded border border-line" />
                    {l}
                  </label>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setBrand(DEFAULT_BRAND)}>Reset colors</button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="af-field min-w-[220px]">
                  <small>Logo at the end</small>
                  <select value={logo} disabled={busy} onChange={(e) => setLogo(e.target.value as typeof logo)}>
                    <option value="none">No logo outro</option>
                    {extras?.profileImage && <option value="profile">My profile photo</option>}
                    <option value="file">Upload a logo…</option>
                  </select>
                </label>
                {logo === "file" && (
                  <label className="btn btn-ghost btn-sm cursor-pointer">
                    {logoFile ? "Change logo" : "Choose image"}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 5 * 1024 * 1024) return failed("That logo is over 5 MB", { description: "Use a smaller PNG or JPG." });
                      setLogoFile(URL.createObjectURL(f));
                      saved("Logo added", { description: "It shows for the last 1.5 seconds." });
                    }} />
                  </label>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="af-field min-w-[220px]">
                  <small>Music</small>
                  <select value={music} disabled={busy} onChange={(e) => setMusic(e.target.value as MusicId)}>
                    {(Object.keys(MUSIC) as MusicId[]).map((m) => <option key={m} value={m}>{MUSIC[m].label}</option>)}
                  </select>
                </label>
                {music !== "none" && <button type="button" className="btn btn-ghost btn-sm" onClick={listen}><Volume2 size={14} aria-hidden="true" /> Listen</button>}
              </div>
              <p className="text-[12.5px] text-ink-2">{music === "none" ? "No sound, on purpose: add licensed trending audio in Instagram or TikTok when you post." : "Made right here in your browser, so it's royalty-free with no copyright claims. With music, recording takes the video's full length."}</p>
          </Fold>
        ) : (
          <Fold title="More with Infinity" sub="6 more presets, brand colors, logo and music" open={locked}>
            <div className="grid gap-2 sm:grid-cols-3">
              {extra.map((p) => (
              <button key={p.id} type="button" aria-pressed={preset === p.id} disabled={busy} onClick={() => setPreset(p.id)}
                className={cn("flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition sm:block", preset === p.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink", !pro && preset !== p.id && "bg-wall")}>
                <span className="flex items-center gap-2 sm:mb-2">
                  <span className="paint-dab" style={{ ["--dab" as string]: p.dab }} aria-hidden="true" />
                  {!pro && <Lock size={13} aria-hidden="true" />}
                </span>
                <span className="grid">
                  <b className="text-[15px] leading-tight">{p.name}{!pro && <span className="sr-only"> (Infinity)</span>}</b>
                  <span className={cn("text-[12.5px]", preset === p.id ? "text-white/75" : "text-ink-2")}>{p.sub}</span>
                </span>
              </button>
            ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-[13.5px] text-ink-2">Free presets stay free. Videos are silent: add trending audio when you post.</p>
              <Unlock />
            </div>
          </Fold>
        )}

        {/* consent for Artfinity's own accounts */}
        <div className="flex flex-wrap items-start gap-3 px-1" id="feature-my-work">
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={extras?.socialFeature ?? true} disabled={!extras} onChange={(e) => setConsent(e.target.checked)} />
            <span className="grid gap-0.5">
              <b className="text-[15px]">Artfinity can feature my work on its Instagram</b>
              <span className="text-[13.5px] text-ink-2">Always with your @handle and a link to your print. Turning it off drops anything queued.</span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
