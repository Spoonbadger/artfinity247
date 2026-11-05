"use client";
// One post in the /admin/social queue or history. Approving renders the video in this browser (the same engine as
// the Share kit), uploads it (Cloudinary, or local in dev) and schedules it.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { failed, problemFrom, saved } from "@/lib/feedback";
import { Problem } from "@/components/studio/Problem";
import { handleText } from "@/components/share/shareData";
import { DEFAULT_BRAND, FORMATS, PRESETS, presetOf, type PresetId, type Season, type VideoFormat } from "@/lib/social/presets";
import type { AdminPost } from "@/lib/social/admin";
import type { VideoSpec } from "@/components/share/videos/engine";
import type { AssetRequest } from "@/components/share/videos/assets";
import { useVideo } from "@/components/share/videos/useVideo";
import VideoStage from "@/components/share/videos/VideoStage";

const TZ = "America/New_York";
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });

export const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-wall text-ink ring-1 ring-line" },
  approved: { label: "Approved", cls: "bg-scan/15 text-scan" },
  posting: { label: "Posting", cls: "bg-sticker text-ink" },
  posted: { label: "Posted", cls: "bg-earned text-white" },
  failed: { label: "Failed", cls: "bg-coral/15 text-coral" },
  skipped: { label: "Skipped", cls: "bg-line text-ink-2" },
};
const KIND: Record<string, string> = { artwork: "Artwork", collection: "Collection", event: "Event", artist: "Artist feature" };
const FIX: Record<string, { label: string; href: string }> = {
  token: { label: "Make a new token", href: "/admin/social/setup#token" },
  rate_limit: { label: "Post fewer a day", href: "/admin/social#settings" },
  media: { label: "Render it again", href: "#queue" },
  config: { label: "Check the setup", href: "/admin/social/setup" },
  consent: { label: "Why skipped", href: "/admin/social/setup#consent" },
  unknown: { label: "Setup guide", href: "/admin/social/setup" },
};

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

async function send(id: string, body: Record<string, unknown>, success?: string) {
  try {
    const res = await fetch(`/api/admin/social/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const p = await problemFrom(res, "Couldn't save that");
      failed(p.message, { fix: p.code?.startsWith("ig_") ? FIX[p.code.slice(3)] ?? FIX.unknown : p.fix ?? { label: "Setup guide", href: "/admin/social/setup" } });
      return null;
    }
    const j = await res.json().catch(() => ({}));
    saved(j.message || success || "Saved");
    return j as Record<string, unknown>;
  } catch {
    failed("You seem to be offline", { description: "Check your connection and try again.", fix: { label: "Reload", href: "/admin/social" } });
    return null;
  }
}

/** Upload a rendered video: straight to Cloudinary when it's set up, else to our dev upload route. */
async function upload(postId: string, blob: Blob, ext: string): Promise<{ url: string; mediaType: string }> {
  const mediaType = blob.type.split(";")[0] || (ext === "mp4" ? "video/mp4" : "video/webm");
  const sig = await fetch("/api/admin/social/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId }) });
  if (!sig.ok) throw new Error((await problemFrom(sig, "Couldn't start the upload")).message);
  const s = (await sig.json()) as { local?: boolean; url?: string; fields?: Record<string, string> };
  const file = new File([blob], `post-${postId}.${ext}`, { type: mediaType });
  if (s.local || !s.url || !s.fields) {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("postId", postId);
    const res = await fetch("/api/admin/social/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error((await problemFrom(res, "The upload failed")).message);
    return res.json();
  }
  const fd = new FormData();
  Object.entries(s.fields).forEach(([k, v]) => fd.set(k, v));
  fd.set("file", file);
  const res = await fetch(s.url, { method: "POST", body: fd });
  const j = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !j.secure_url) throw new Error(j.error?.message || "Cloudinary didn't take the video");
  return { url: j.secure_url, mediaType };
}

function RenderPanel({ post, base, scale, season, onDone }: { post: AdminPost; base: string; scale: { n: number; note: string } | null; season: Season; onDone: () => void }) {
  const m = post.material;
  const [step, setStep] = useState<"idle" | "upload" | "approve">("idle");
  const req: AssetRequest | null = m.pieces.length ? {
    preset: post.preset,
    pieces: m.pieces.map((p) => ({ slug: p.slug, title: p.title, fromCents: p.fromCents, roomScenes: p.roomScenes })),
    qrUrl: m.link.includes("?") ? m.link : `${m.link}?src=instagram`,
    scale,
  } : null;
  const spec: VideoSpec = useMemo(() => ({
    preset: post.preset,
    format: post.format,
    brand: DEFAULT_BRAND,
    text: {
      artist: m.artist?.name ?? "",
      handle: m.artist ? handleText(base, m.artist.slug) : "theartfinity.com",
      cta: "Scan or tap to buy",
      headline: post.headline ?? (post.kind === "collection" ? m.title : undefined),
      dropDate: post.dropDate ?? undefined,
      season,
    },
  }), [post, m, base, season]);
  const v = useVideo(req, spec);
  const pct = Math.round((v.progress || 0) * 100);

  const approve = async () => {
    try {
      const r = v.result ?? (await v.make());
      if (!r) return;
      setStep("upload");
      const up = await upload(post.id, r.blob, r.type.ext);
      setStep("approve");
      const ok = await send(post.id, { action: "approve", mediaUrl: up.url, mediaType: up.mediaType });
      if (ok) onDone();
    } catch (e) {
      if ((e as Error).name === "AbortError") return saved("Stopped", { description: "Nothing was uploaded." });
      console.error(e);
      failed("The video didn't render or upload", { description: (e as Error).message, fix: { label: "Storage setup", href: "/admin/social/setup#storage" } });
    } finally {
      setStep("idle");
    }
  };

  if (!req) return <Problem tone="error" title="The pieces in this post were removed or unpublished" fix={{ label: "Skip it", onClick: () => send(post.id, { action: "skip" }).then((j) => j && onDone()) }} />;
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
      <VideoStage spec={spec} assets={v.assets} problem={v.problem} retry={v.retry} result={v.result} busy={v.busy} title={m.title} className="max-w-[220px]" />
      <div className="grid content-start gap-3">
        <p className="text-[13.5px] text-ink-2">
          {presetOf(post.preset).name} · {FORMATS[post.format].w} × {FORMATS[post.format].h} · {Math.round(v.seconds)} s. Approving makes the video here, uploads it and schedules it. Keep this tab open until it says approved.
        </p>
        {v.type === null && <Problem tone="error" title="This browser can't record video" fix={{ label: "Setup guide", href: "/admin/social/setup#browser" }}>Approve from Chrome, Edge or Safari.</Problem>}
        {v.type?.ext === "webm" && <Problem tone="info" title="This browser makes WebM">{"Fine with Cloudinary (it delivers an MP4 to Instagram). Without it, approve from Chrome or Safari for MP4."}</Problem>}
        {v.busy ? (
          <div className="grid gap-2" aria-live="polite">
            <div className="flex justify-between text-[14px]"><b>Rendering…</b><span className="num text-ink-2">{pct}%</span></div>
            <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Rendering"><div className="h-full bg-sticker" style={{ width: `${pct}%` }} /></div>
            <button type="button" className="btn btn-ghost btn-sm w-max" onClick={v.stop}>Stop</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-blue" disabled={!v.assets || !v.type || step !== "idle"} onClick={approve}>
              {step === "upload" ? "Uploading…" : step === "approve" ? "Scheduling…" : "Render and approve"}
            </button>
            {v.result && <a className="btn btn-ghost" href={v.result.url} download={`artfinity-${post.id}.${v.result.type.ext}`}><Download size={16} aria-hidden="true" /> Download</a>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PostCard({
  post, base, connected, canEdit, scale, season, first, last, focus,
}: {
  post: AdminPost; base: string; connected: boolean; canEdit: boolean; scale: { n: number; note: string } | null; season: Season; first?: boolean; last?: boolean; focus?: boolean;
}) {
  const router = useRouter();
  const m = post.material;
  const [caption, setCaption] = useState(post.caption);
  const [preset, setPreset] = useState<PresetId>(post.preset);
  const [format, setFormat] = useState<VideoFormat>(post.format);
  const [open, setOpen] = useState(focus && post.status === "draft");
  const [permalink, setPermalink] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => router.refresh();
  const act = async (body: Record<string, unknown>, success?: string) => {
    setBusy(true);
    const j = await send(post.id, body, success);
    setBusy(false);
    if (j) refresh();
    return j;
  };
  const editable = canEdit && ["draft", "approved", "failed"].includes(post.status);
  const dirty = caption !== post.caption || preset !== post.preset || format !== post.format;
  const thumb = m.pieces[0] ? `/api/share/painting?art=${encodeURIComponent(m.pieces[0].slug)}&w=320` : null;
  const st = STATUS[post.status] ?? STATUS.draft;
  const fileExt = post.mediaType === "video/webm" ? "webm" : "mp4";
  const fits = PRESETS.filter((p) => p.pieces === "one" || m.pieces.length > 1);

  return (
    <li id={`post-${post.id}`} className={cn("grid gap-4 rounded-2xl border bg-white p-4", focus ? "border-ink ring-2 ring-scan" : "border-line")}>
      <div className="flex flex-wrap items-start gap-4">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-20 w-20 shrink-0 rounded-md border-[3px] border-white object-cover shadow-[0_1px_4px_rgba(21,22,27,.25)]" />
        ) : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-md bg-wall text-[12px] text-ink-2">No art</span>}
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", st.cls)}>{st.label}</span>
            <span className="text-[12.5px] font-semibold text-ink-2">{KIND[post.kind] ?? post.kind}{post.source === "auto" ? " · auto-queued" : ""}</span>
            {post.scheduledFor && post.status === "approved" && <span className="text-[12.5px] font-semibold text-scan">{connected ? "Posts" : "Due"} {when(post.scheduledFor)}</span>}
            {post.postedAt && <span className="text-[12.5px] text-ink-2">Posted {when(post.postedAt)}{post.postedBy === "manual" ? " by hand" : ""}</span>}
          </div>
          <p className="truncate text-[16px] font-bold">{m.title || "Untitled"}</p>
          <p className="text-[13.5px] text-ink-2">
            {m.artist ? <>{m.artist.name}{m.artist.handle ? ` · ${m.artist.handle}` : " · no Instagram handle on file"}</> : "No artist"} · {m.pieces.length} {m.pieces.length === 1 ? "piece" : "pieces"}
          </p>
        </div>
        {canEdit && ["draft", "approved"].includes(post.status) && (
          <div className="flex gap-1">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy || first} onClick={() => act({ action: "move", direction: "up" })} aria-label={`Move “${m.title}” up`}><ArrowUp size={14} aria-hidden="true" /></button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy || last} onClick={() => act({ action: "move", direction: "down" })} aria-label={`Move “${m.title}” down`}><ArrowDown size={14} aria-hidden="true" /></button>
          </div>
        )}
      </div>

      {m.artist && !m.artist.consent && ["draft", "approved"].includes(post.status) && (
        <Problem tone="warning" title={`${m.artist.name} turned off "feature my work"`} fix={canEdit ? { label: "Skip it", onClick: () => act({ action: "skip" }) } : undefined}>It won&apos;t be posted.</Problem>
      )}
      {post.status === "failed" && post.error && (
        <Problem tone="error" title="This post failed" fix={FIX[post.errorCode || "unknown"] ?? FIX.unknown}>{post.error}</Problem>
      )}
      {post.status === "skipped" && post.errorCode === "consent" && <p className="text-[13px] text-ink-2">{post.error}</p>}

      {editable ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <label className="af-field">
            <small>Caption <span className="num">{caption.length}/2200</span></small>
            <textarea rows={4} value={caption} maxLength={2200} onChange={(e) => setCaption(e.target.value)} />
          </label>
          <div className="grid content-start gap-2">
            <label className="af-field"><small>Preset</small>
              <select value={preset} onChange={(e) => setPreset(e.target.value as PresetId)}>{fits.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <label className="af-field"><small>Format</small>
              <select value={format} onChange={(e) => setFormat(e.target.value as VideoFormat)}>{(Object.keys(FORMATS) as VideoFormat[]).map((f) => <option key={f} value={f}>{FORMATS[f].label}</option>)}</select>
            </label>
            {dirty && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => act({ action: "edit", caption, preset, format })}>Save changes</button>}
          </div>
        </div>
      ) : post.caption ? <p className="whitespace-pre-line rounded-xl bg-wall p-3 text-[13.5px]">{post.caption}</p> : null}

      {/* actions */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {post.status === "draft" && !dirty && <button type="button" className="btn btn-blue btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Hide preview" : "Preview and approve"}</button>}
          {post.status === "approved" && post.mediaUrl && (
            <>
              {!connected && <a href={post.mediaUrl} download={`artfinity-${post.id}.${fileExt}`} className="btn btn-blue btn-sm" onClick={() => saved("Video downloading", { description: "Post it on Instagram, then press Mark as posted." })}><Download size={14} aria-hidden="true" /> Download video</a>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={async () => (await copy(post.caption)) ? saved("Caption copied", { description: "Paste it in Instagram." }) : failed("Couldn't copy", { description: "Select the caption and copy it by hand.", fix: { label: "Show caption", href: `#post-${post.id}` } })}><Copy size={14} aria-hidden="true" /> Copy caption</button>
              {connected && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: "publish_now" })}>Publish now</button>}
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: "unschedule" })}>Back to draft</button>
            </>
          )}
          {["draft", "approved", "failed"].includes(post.status) && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: "skip" })}>Skip</button>}
          {post.status === "failed" && post.mediaUrl && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: "retry" })}>Retry</button>}
          {["failed", "skipped"].includes(post.status) && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: "restore" })}>Back to queue</button>}
          {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={14} aria-hidden="true" /> View on Instagram</a>}
        </div>
      )}
      {canEdit && post.status === "approved" && !connected && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); act({ action: "mark_posted", permalink }); }}>
          <label className="af-field min-w-[240px] flex-1"><small>Instagram link (optional)</small><input value={permalink} onChange={(e) => setPermalink(e.target.value)} placeholder="https://www.instagram.com/reel/…" /></label>
          <button type="submit" className="btn btn-sm" disabled={busy}>Mark as posted</button>
        </form>
      )}
      {post.status === "approved" && post.mediaUrl && (
        <video src={post.mediaUrl} controls muted playsInline className="max-h-[320px] w-auto max-w-full justify-self-start rounded-xl border border-line" aria-label={`Rendered video for ${m.title}`} />
      )}
      {open && post.status === "draft" && canEdit && <RenderPanel post={post} base={base} scale={scale} season={season} onDone={() => { setOpen(false); refresh(); }} />}
    </li>
  );
}
