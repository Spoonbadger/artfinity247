"use client";
// Shared by the Share kit (artists) and /admin/social (Artfinity's own posts): loads a preset's assets, finds the
// best file type, renders the file and keeps the result. The canvas preview lives in VideoStage.
import { useCallback, useEffect, useRef, useState } from "react";
import { durationFor, sizeOf, drawFrame, type VideoAssets, type VideoSpec } from "./engine";
import { loadAssets, AssetError, type AssetRequest } from "./assets";
import { bestType, renderVideo, type OutType } from "./record";
import type { MusicId } from "@/lib/social/presets";

export type VideoResult = { url: string; blob: Blob; type: OutType; seconds: number; key: string };
export type VideoProblem = { message: string; fix?: { label: string; href: string } };

export function useVideo(req: AssetRequest | null, spec: VideoSpec, music: MusicId = "none") {
  const [assets, setAssets] = useState<VideoAssets | null>(null);
  const [problem, setProblem] = useState<VideoProblem | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [type, setType] = useState<OutType | null | undefined>(undefined); // undefined = still checking
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<VideoResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqKey = req ? JSON.stringify(req) : "";
  const { w, h } = sizeOf(spec.format);

  useEffect(() => {
    if (!reqKey) { setAssets(null); return; }
    let live = true;
    setAssets(null); setProblem(null);
    loadAssets(JSON.parse(reqKey) as AssetRequest)
      .then((a) => live && setAssets(a))
      .catch((e) => {
        console.error(e);
        if (!live) return;
        setProblem(e instanceof AssetError ? { message: e.message, fix: e.fix } : { message: "Couldn't load this piece. Check your connection and try again." });
      });
    return () => { live = false; };
  }, [reqKey, attempt]);

  useEffect(() => {
    let live = true;
    setType(undefined);
    bestType({ w, h, audio: music !== "none" }).then((t) => live && setType(t)).catch(() => live && setType(null));
    return () => { live = false; };
  }, [w, h, music]);

  // A finished file belongs to one piece + preset + words; changing any of them clears it.
  const specKey = JSON.stringify([reqKey, spec, music]);
  const clear = useCallback(() => setResult((r) => { if (r) URL.revokeObjectURL(r.url); return null; }), []);
  useEffect(() => { setResult((r) => (r && r.key !== specKey ? (URL.revokeObjectURL(r.url), null) : r)); }, [specKey]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const make = useCallback(async (): Promise<VideoResult | null> => {
    if (!assets || !type) return null;
    clear();
    const ac = new AbortController();
    abortRef.current = ac;
    setProgress(0);
    const seconds = durationFor(spec, assets);
    try {
      let shown = 0;
      const blob = await renderVideo({
        w, h, duration: seconds, type, music,
        draw: (ctx, t) => drawFrame(ctx, spec, assets, t),
        onProgress: (k) => { if (k - shown >= 0.01 || k === 1) { shown = k; setProgress(k); } },
        signal: ac.signal,
      });
      const r: VideoResult = { url: URL.createObjectURL(blob), blob, type, seconds, key: specKey };
      setResult(r);
      return r;
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }, [assets, type, spec, music, w, h, specKey, clear]);

  return {
    assets, problem, retry: () => setAttempt((n) => n + 1),
    type, progress, busy: progress !== null, result, make, clear,
    stop: () => abortRef.current?.abort(),
    seconds: durationFor(spec, assets),
  };
}
