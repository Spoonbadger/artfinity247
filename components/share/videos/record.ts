// Turns a drawFrame function into a video file, in the browser. No server, no ffmpeg.
//
// Silent videos: WebCodecs where the browser has it (frame by frame at exactly 30 fps, faster than real time, no
// dropped frames, keeps going in a background tab), muxed by components/share/video/mux.ts. Otherwise canvas +
// MediaRecorder in real time. With music: always MediaRecorder, with the generated track mixed in (music.ts).
// MP4 (H.264) first wherever the browser can make it; WebM otherwise (the UI says so).
import { muxMP4, muxWebM } from "@/components/share/video/mux";
import { FPS } from "./engine";
import { playTrack } from "./music";
import type { MusicId } from "@/lib/social/presets";

export type OutType = { ext: "mp4" | "webm"; label: "MP4" | "WebM"; how: "codecs" | "recorder"; codec: string };

const CODECS: OutType[] = [
  { ext: "mp4", label: "MP4", how: "codecs", codec: "avc1.640028" },
  { ext: "mp4", label: "MP4", how: "codecs", codec: "avc1.4d0028" },
  { ext: "mp4", label: "MP4", how: "codecs", codec: "avc1.42e028" },
  { ext: "webm", label: "WebM", how: "codecs", codec: "vp09.00.40.08" },
  { ext: "webm", label: "WebM", how: "codecs", codec: "vp8" },
];
const RECORDER: OutType[] = [
  { ext: "mp4", label: "MP4", how: "recorder", codec: "video/mp4;codecs=avc1" },
  { ext: "mp4", label: "MP4", how: "recorder", codec: "video/mp4;codecs=avc1.640028" },
  { ext: "mp4", label: "MP4", how: "recorder", codec: "video/mp4" },
  { ext: "webm", label: "WebM", how: "recorder", codec: "video/webm;codecs=vp9" },
  { ext: "webm", label: "WebM", how: "recorder", codec: "video/webm;codecs=vp8" },
  { ext: "webm", label: "WebM", how: "recorder", codec: "video/webm" },
];
const RECORDER_AUDIO: OutType[] = [
  { ext: "mp4", label: "MP4", how: "recorder", codec: "video/mp4;codecs=avc1,mp4a.40.2" },
  { ext: "mp4", label: "MP4", how: "recorder", codec: "video/mp4;codecs=avc1,opus" },
  { ext: "webm", label: "WebM", how: "recorder", codec: "video/webm;codecs=vp9,opus" },
  { ext: "webm", label: "WebM", how: "recorder", codec: "video/webm;codecs=vp8,opus" },
];

const config = (t: OutType, w: number, h: number, bitrate: number): VideoEncoderConfig => ({
  codec: t.codec, width: w, height: h, bitrate, framerate: FPS,
  ...(t.ext === "mp4" ? { avc: { format: "avc" as const } } : {}),
});

/** The best file type this browser can make: MP4 if it can, else WebM. null = it can't record video at all. */
export async function bestType(o: { w: number; h: number; audio?: boolean }): Promise<OutType | null> {
  if (typeof window === "undefined") return null;
  const found: OutType[] = [];
  if (!o.audio && typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {
    for (const t of CODECS) {
      try { if ((await VideoEncoder.isConfigSupported(config(t, o.w, o.h, 8_000_000))).supported) { found.push(t); break; } } catch { /* next */ }
    }
  }
  if (typeof MediaRecorder !== "undefined" && "captureStream" in HTMLCanvasElement.prototype) {
    for (const t of o.audio ? RECORDER_AUDIO : RECORDER) {
      try { if (MediaRecorder.isTypeSupported(t.codec)) { found.push(t); break; } } catch { /* next */ }
    }
  }
  return found.find((t) => t.ext === "mp4") ?? found[0] ?? null;
}

export type RenderJob = {
  w: number;
  h: number;
  duration: number;
  draw: (ctx: CanvasRenderingContext2D, t: number) => void;
  type: OutType;
  music?: MusicId;
  /** Bits per second. 8 Mbps keeps a 15 s vertical video around 15 MB. */
  bitrate?: number;
  onProgress?: (k: number) => void;
  signal?: AbortSignal;
};

const abortError = () => new DOMException("Stopped", "AbortError");
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function renderVideo(job: RenderJob): Promise<Blob> {
  return job.type.how === "codecs" ? encode(job) : record(job);
}

async function encode(job: RenderJob): Promise<Blob> {
  const { w, h, type } = job;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("No canvas");
  const chunks: { data: Uint8Array; key: boolean }[] = [];
  let avcC: Uint8Array | null = null;
  let failure: Error | null = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({ data, key: chunk.type === "key" });
      const d = meta?.decoderConfig?.description;
      if (d && !avcC) avcC = d instanceof ArrayBuffer ? new Uint8Array(d.slice(0)) : new Uint8Array((d as ArrayBufferView).buffer.slice(0));
    },
    error: (e) => { failure = e instanceof Error ? e : new Error(String(e)); },
  });
  enc.configure(config(type, w, h, job.bitrate ?? 8_000_000));
  const frames = Math.round(job.duration * FPS);
  try {
    for (let i = 0; i < frames; i++) {
      if (job.signal?.aborted) throw abortError();
      if (failure) throw failure;
      job.draw(ctx, i / FPS);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      job.onProgress?.((i + 1) / frames);
      while (enc.encodeQueueSize > 3) await pause(4);
      if (i % 3 === 0) await pause(0);
    }
    await enc.flush();
  } finally {
    if (enc.state !== "closed") enc.close();
  }
  if (failure) throw failure;
  if (type.ext === "mp4") {
    if (!avcC) throw new Error("The encoder gave no H.264 settings");
    return muxMP4(chunks, avcC, w, h, FPS);
  }
  return muxWebM(chunks, type.codec.startsWith("vp09") ? "V_VP9" : "V_VP8", w, h, FPS);
}

/** Real time: plays the video into a MediaRecorder (with the music track, if any). */
function record(job: RenderJob): Promise<Blob> {
  const { w, h, type, duration } = job;
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return reject(new Error("No canvas"));
    job.draw(ctx, 0);
    const stream = canvas.captureStream(FPS);
    let audio: { stop: () => void } | null = null;
    if (job.music && job.music !== "none") {
      try {
        const ac = new AudioContext();
        const dest = ac.createMediaStreamDestination();
        const track = playTrack(ac, dest, job.music, duration);
        dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
        audio = { stop: () => { track.stop(); ac.close().catch(() => {}); } };
      } catch { /* no audio: still make the video */ }
    }
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(stream, { mimeType: type.codec, videoBitsPerSecond: job.bitrate ?? 8_000_000 }); }
    catch (e) { audio?.stop(); return reject(e); }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onerror = (e) => reject((e as unknown as { error?: Error }).error || new Error("Recording failed"));
    rec.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop());
      audio?.stop();
      if (job.signal?.aborted) return reject(abortError());
      resolve(new Blob(chunks, { type: type.codec.split(";")[0] }));
    };
    let start = 0, raf = 0, done = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      if (timer) clearInterval(timer);
      if (rec.state !== "inactive") rec.stop();
    };
    const tick = () => {
      if (done) return;
      if (job.signal?.aborted) return finish();
      const t = (performance.now() - start) / 1000;
      job.draw(ctx, Math.min(t, duration));
      job.onProgress?.(Math.min(1, t / duration));
      if (t >= duration + 0.15) finish();
    };
    const loop = () => { tick(); if (!done) raf = requestAnimationFrame(loop); };
    rec.start(500);
    start = performance.now();
    // rAF for smooth frames; the interval keeps time moving if the tab goes to the background.
    timer = setInterval(() => { if (document.hidden) tick(); }, 1000 / FPS);
    raf = requestAnimationFrame(loop);
  });
}
