"use client";
// The live preview (half-size canvas, the same drawFrame as the file) or, once made, the finished video.
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORMATS, presetOf } from "@/lib/social/presets";
import { drawFrame, durationFor, sizeOf, type VideoAssets, type VideoSpec } from "./engine";
import type { VideoProblem, VideoResult } from "./useVideo";

export default function VideoStage({
  spec, assets, problem, retry, result, busy, title, className,
}: {
  spec: VideoSpec;
  assets: VideoAssets | null;
  problem: VideoProblem | null;
  retry: () => void;
  result: VideoResult | null;
  busy: boolean;
  /** For screen readers: what's in the video. */
  title: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef(0);
  const visibleRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const { w, h } = sizeOf(spec.format);
  const specKey = JSON.stringify(spec);

  useEffect(() => { timeRef.current = 0; }, [specKey, assets]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !assets || result) return;
    const ctx = c.getContext("2d", { alpha: false });
    if (!ctx) return;
    const dur = durationFor(spec, assets);
    let raf = 0, last = performance.now();
    const io = new IntersectionObserver(([e]) => { visibleRef.current = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(c);
    const draw = () => {
      ctx.setTransform(c.width / w, 0, 0, c.height / h, 0, 0);
      drawFrame(ctx, spec, assets, timeRef.current);
      if (barRef.current) barRef.current.style.width = `${(timeRef.current / dur) * 100}%`;
    };
    const loop = (now: number) => {
      // a rAF timestamp can be a hair before the performance.now() taken when the loop started: never go backwards
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      if (playing && visibleRef.current && !busy) { timeRef.current = (timeRef.current + dt) % dur; draw(); }
      raf = requestAnimationFrame(loop);
    };
    draw();
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
    // spec is compared by value through specKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, specKey, playing, result, busy, w, h]);

  return (
    <div
      className={cn("relative mx-auto w-full overflow-hidden rounded-[22px] border-[1.5px] border-ink bg-wall shadow-[6px_6px_0_var(--af-ink)]", className)}
      style={{ aspectRatio: FORMATS[spec.format].ratio }}
    >
      {result ? (
        <video key={result.url} src={result.url} className="absolute inset-0 h-full w-full object-cover" controls autoPlay muted loop playsInline aria-label={`Your video: ${title}`} />
      ) : (
        <>
          <canvas ref={canvasRef} width={w / 2} height={h / 2} className="absolute inset-0 h-full w-full" role="img" aria-label={`Preview: ${presetOf(spec.preset).name} video of ${title}`} />
          {!assets && !problem && <span className="absolute inset-0 grid place-items-center text-[14px] text-ink-2">Hanging the rooms…</span>}
          {problem && !assets && (
            <div role="alert" className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-6 text-center text-[14px] text-ink-2">
              <span>{problem.message}</span>
              <span className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={retry} className="btn btn-sm">Try again</button>
                {problem.fix && <a href={problem.fix.href} className="btn btn-ghost btn-sm">{problem.fix.label}</a>}
              </span>
            </div>
          )}
          {assets && !busy && (
            <button type="button" onClick={() => setPlaying((p) => !p)} className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-white/90 text-ink" aria-label={playing ? "Pause preview" : "Play preview"}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
          )}
          <span className="absolute inset-x-0 bottom-0 h-1 bg-ink/10" aria-hidden="true"><span ref={barRef} className="block h-full bg-scan" /></span>
        </>
      )}
    </div>
  );
}
