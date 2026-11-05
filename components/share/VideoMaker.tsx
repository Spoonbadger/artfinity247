"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Pause, Play, Share2, Square } from "lucide-react";
import { qrSVG } from "@/lib/qr/render";
import { loadFonts } from "@/components/qr/text";
import { cn } from "@/lib/utils";
import { SIZE_IN } from "@/components/art/pricing";
import { accentOf, artLink, dollars, editionLine, handleText, paletteFromPixels, priceLine, type ShareArt } from "./shareData";
import { failed as toastFailed, saved as toastSaved } from "@/lib/feedback";
import {
  TEMPLATES, VH, VW, drawFrame, findDetails, makeGrain, makeVideo, videoTypes,
  type TemplateId, type VideoAssets, type VideoInfo, type VideoType,
} from "./video/engine";

const PRINT: [number, number] = SIZE_IN.xl;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Image failed to load"));
    im.src = src;
  });
}

async function loadAssets(art: ShareArt, base: string): Promise<VideoAssets> {
  const [fonts, img] = await Promise.all([loadFonts(), loadImage(`/api/share/painting?art=${encodeURIComponent(art.slug)}`)]);
  const svg = qrSVG(artLink(base, art.handle, art.slug, "share-video"), { fg: "#15161b", dots: "rounded", eyes: "frame", eyeColor: "#2b37f0" })
    .replace("<svg ", `<svg width="672" height="672" `);
  const qr = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  const probe = document.createElement("canvas");
  probe.width = 50; probe.height = 60;
  const p = probe.getContext("2d", { willReadFrequently: true })!;
  p.drawImage(img, 0, 0, 50, 60);
  const details = findDetails(p.getImageData(0, 0, 50, 60).data, 50, 60);
  p.drawImage(img, 0, 0, 8, 8);
  const palette = paletteFromPixels(p.getImageData(0, 0, 8, 8).data, 5);
  return { img, iw: img.naturalWidth, ih: img.naturalHeight, qr, fonts, palette, accent: accentOf(palette), details, grain: makeGrain() };
}

const defaults = (id: TemplateId): string[] =>
  id === "wall" ? [TEMPLATES.wall.captions[0], `${PRINT[0]} × ${PRINT[1]} in print`, TEMPLATES.wall.captions[2]] : [...TEMPLATES[id].captions];

type Result = { url: string; blob: Blob; type: VideoType; id: TemplateId };

export default function VideoMaker({ art, base }: { art: ShareArt; base: string }) {
  const [tpl, setTpl] = useState<TemplateId>("reveal");
  const [lines, setLines] = useState<Record<TemplateId, string[]>>({ reveal: defaults("reveal"), wall: defaults("wall"), detail: defaults("detail") });
  const [assets, setAssets] = useState<VideoAssets | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [types, setTypes] = useState<VideoType[] | null>(null);
  const [typeIdx, setTypeIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const barRef = useRef<HTMLSpanElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const visibleRef = useRef(true);
  const busyRef = useRef(false);

  const info: VideoInfo = useMemo(() => ({
    title: art.title,
    artist: art.artist,
    price: priceLine(art),
    priceShort: dollars(art.fromCents),
    edition: editionLine(art),
    handle: handleText(base, art.handle),
    printIn: PRINT,
    captions: lines[tpl],
  }), [art, base, lines, tpl]);

  useEffect(() => { videoTypes().then(setTypes).catch(() => setTypes([])); }, []);

  // Load the painting, fonts and code for this artwork.
  useEffect(() => {
    let live = true;
    setAssets(null); setFailed(false); timeRef.current = 0;
    loadAssets(art, base).then((a) => live && setAssets(a)).catch((e) => { console.error(e); if (live) setFailed(true); });
    return () => { live = false; };
  }, [art, base, attempt]);

  // A finished video belongs to one artwork + template + captions; changing any of them clears it.
  const clearResult = useCallback(() => setResult((r) => { if (r) URL.revokeObjectURL(r.url); return null; }), []);
  useEffect(() => { clearResult(); }, [art.slug, tpl, lines, clearResult]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Live preview loop (half resolution).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !assets || result) return;
    const ctx = c.getContext("2d", { alpha: false });
    if (!ctx) return;
    const dur = TEMPLATES[tpl].duration;
    let raf = 0, last = performance.now();
    const io = new IntersectionObserver(([e]) => { visibleRef.current = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(c);
    const draw = () => {
      ctx.setTransform(c.width / VW, 0, 0, c.height / VH, 0, 0);
      drawFrame(ctx, tpl, timeRef.current, assets, info);
      if (barRef.current) barRef.current.style.width = `${(timeRef.current / dur) * 100}%`;
    };
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing && visibleRef.current && !busyRef.current) { timeRef.current = (timeRef.current + dt) % dur; draw(); }
      raf = requestAnimationFrame(loop);
    };
    draw();
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [assets, tpl, info, playing, result]);

  useEffect(() => {
    if (!result) { setCanShareFiles(false); return; }
    const file = new File([result.blob], "video." + result.type.ext, { type: result.blob.type });
    setCanShareFiles(typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] }));
  }, [result]);

  const type = types?.[typeIdx] ?? types?.[0];
  const make = async () => {
    if (!assets || !type) return;
    clearResult();
    const ac = new AbortController();
    abortRef.current = ac;
    setProgress(0);
    busyRef.current = true;
    try {
      let shown = 0;
      const blob = await makeVideo(tpl, assets, info, type, (k) => { if (k - shown >= 0.01 || k === 1) { shown = k; setProgress(k); } }, ac.signal);
      setResult({ url: URL.createObjectURL(blob), blob, type, id: tpl });
      toastSaved("Your video is ready", { description: "Press Download, then post it with trending audio." });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error(e);
        toastFailed("The video didn't finish", { description: "Keep this tab open while it records. Closing or switching tabs can stop it.", retry: make });
      }
    } finally {
      setProgress(null);
      busyRef.current = false;
      abortRef.current = null;
    }
  };
  const fileName = result ? `${art.slug}-${result.id}.${result.type.ext}` : "";
  const share = async () => {
    if (!result) return;
    const file = new File([result.blob], fileName, { type: result.blob.type });
    try { await navigator.share({ files: [file], title: art.title, text: `${art.title}. ${priceLine(art)}.` }); } catch { /* cancelled */ }
  };

  const unsupported = types !== null && types.length === 0;
  const busy = progress !== null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-10">
      {/* stage */}
      <div className="mx-auto w-full max-w-[300px] lg:max-w-[340px]">
        <div className="relative overflow-hidden rounded-[22px] border-[1.5px] border-ink bg-wall shadow-[6px_6px_0_var(--af-ink)]" style={{ aspectRatio: "9 / 16" }}>
          {result ? (
            <video key={result.url} src={result.url} className="absolute inset-0 h-full w-full object-cover" controls autoPlay muted loop playsInline aria-label={`Your video: ${TEMPLATES[result.id].name}, ${art.title}`} />
          ) : (
            <>
              <canvas ref={canvasRef} width={540} height={960} className="absolute inset-0 h-full w-full" role="img" aria-label={`Preview: ${TEMPLATES[tpl].name} video of ${art.title}`} />
              {!assets && !failed && <span className="absolute inset-0 grid place-items-center text-[14px] text-ink-2">Mixing paint…</span>}
              {failed && !assets && (
                <span className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-6 text-center text-[14px] text-ink-2">
                  Couldn&apos;t load this painting.
                  <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn btn-sm">Try again</button>
                </span>
              )}
              {assets && !busy && (
                <button type="button" onClick={() => setPlaying((p) => !p)} className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-white/90 text-ink" aria-label={playing ? "Pause preview" : "Play preview"}>
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>
              )}
              <span className="absolute inset-x-0 bottom-0 h-1 bg-ink/10"><span ref={barRef} className="block h-full bg-scan" /></span>
            </>
          )}
        </div>
        <p className="mt-3 text-center text-[13px] text-ink-2">
          {result ? <>{result.type.label} · 1080 × 1920 · {TEMPLATES[result.id].duration} s</> : <>9:16 · {TEMPLATES[tpl].duration} s · {busy ? "recording" : "live preview"}</>}
        </p>
      </div>

      {/* controls */}
      <div className="grid content-start gap-6">
        <fieldset>
          <legend className="mb-2 text-[15px] font-bold">Look</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(TEMPLATES) as TemplateId[]).map((id, i) => (
              <button
                key={id}
                type="button"
                aria-pressed={tpl === id}
                disabled={busy}
                onClick={() => { setTpl(id); timeRef.current = 0; }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition sm:block",
                  tpl === id ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink",
                )}
              >
                <span className="paint-dab sm:mb-2" style={{ ["--dab" as string]: ["#ff5a36", "#ffd43b", "#2b37f0"][i] }} />
                <span className="grid">
                  <b className="text-[15px] leading-tight">{TEMPLATES[id].name}</b>
                  <span className={cn("text-[12.5px]", tpl === id ? "text-white/75" : "text-ink-2")}>{TEMPLATES[id].sub}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[15px] font-bold">On-screen words <span className="font-normal text-ink-2">(optional)</span></legend>
          {lines[tpl].map((v, i) => (
            <label key={i} className="af-field">
              <small>Line {i + 1}</small>
              <input
                value={v}
                maxLength={48}
                disabled={busy}
                placeholder="Leave empty to skip"
                onChange={(e) => setLines((L) => ({ ...L, [tpl]: L[tpl].map((x, j) => (j === i ? e.target.value : x)) }))}
              />
            </label>
          ))}
        </fieldset>

        {unsupported ? (
          <div className="rounded-2xl border border-line bg-wall p-4 text-[14px]">
            <b className="block text-[15px]">This browser can&apos;t record video.</b>
            Open this page in Chrome, Edge or Safari. The images below work everywhere.
          </div>
        ) : (
          <div className="grid gap-3">
            {types && types.length > 1 && !busy && (
              <div role="radiogroup" aria-label="File type" className="flex w-max gap-1 rounded-full border-2 border-ink p-1">
                {types.map((t, i) => (
                  <button key={t.ext} type="button" role="radio" aria-checked={typeIdx === i} onClick={() => setTypeIdx(i)}
                    className={cn("rounded-full px-4 py-1.5 text-[14px] font-bold", typeIdx === i ? "bg-ink text-white" : "text-ink")}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            {busy ? (
              <div className="grid gap-2" aria-live="polite">
                <div className="flex items-center justify-between text-[14px]">
                  <b>Painting your video…</b>
                  <span className="num text-ink-2">{Math.round((progress || 0) * 100)}%</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full border-2 border-ink bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress || 0) * 100)} aria-label="Rendering">
                  <div className="h-full bg-sticker transition-[width] duration-200" style={{ width: `${(progress || 0) * 100}%` }} />
                </div>
                <button type="button" onClick={() => abortRef.current?.abort()} className="btn btn-ghost btn-sm w-max"><Square size={14} /> Stop</button>
              </div>
            ) : result ? (
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <a href={result.url} download={fileName} onClick={() => toastSaved("Video downloaded", { description: "It's in your downloads, ready for Reels, TikTok or Shorts." })} className="btn btn-blue btn-lg"><Download size={18} /> Download {result.type.label}</a>
                {canShareFiles && <button type="button" onClick={share} className="btn btn-ghost btn-lg"><Share2 size={18} /> Share…</button>}
                <button type="button" onClick={clearResult} className="btn btn-ghost btn-lg">Back to preview</button>
              </div>
            ) : (
              <button type="button" onClick={make} disabled={!assets || !type} className="btn btn-blue btn-lg w-full sm:w-max">
                Make video
              </button>
            )}
            <p className="text-[13px] text-ink-2">
              No sound, on purpose: add trending audio in Instagram or TikTok.
              {type?.ext === "webm" && !busy && <> If your phone won&apos;t post WebM, make it in Chrome or Safari for MP4.</>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
