"use client";
// /pricing: what Infinity adds, shown rather than listed. A live auto video (the Share kit's own engine, drawn on a
// canvas from a real piece on Artfinity) and what the automations would do with a new upload. Auto-posting isn't
// live yet (components/pro/AutomationsPanel.tsx), so that part says so.
import { useMemo, useState } from "react";
import { useVideo } from "@/components/share/videos/useVideo";
import VideoStage from "@/components/share/videos/VideoStage";
import type { VideoSpec } from "@/components/share/videos/engine";
import type { AssetRequest } from "@/components/share/videos/assets";
import { DEFAULT_BRAND, PRESETS, presetOf, type PresetId, type Season } from "@/lib/social/presets";
import { cn } from "@/lib/utils";

export type PreviewPiece = { slug: string; title: string; fromCents: number; artist: string; handle: string };

// Infinity-only styles that need just one piece, so the artist named in the video is the one who made it.
const SHOWN: PresetId[] = ["before-after", "seasonal", "countdown"];

function seasonNow(d = new Date()): Season {
  const m = d.getMonth();
  if (m === 11) return "holiday";
  if (m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}

function VideoPreview({ piece, host }: { piece: PreviewPiece; host: string }) {
  const [preset, setPreset] = useState<PresetId>(SHOWN[0]);
  const req: AssetRequest = useMemo(() => ({
    preset,
    pieces: [{ slug: piece.slug, title: piece.title, fromCents: piece.fromCents }],
    qrUrl: `https://${host}/@${piece.handle}?src=preview`,
  }), [preset, piece, host]);
  const spec: VideoSpec = useMemo(() => {
    const drop = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    return {
      preset,
      format: "vertical",
      brand: DEFAULT_BRAND,
      text: { artist: piece.artist, handle: `${host}/@${piece.handle}`, cta: "Scan or tap to buy", season: seasonNow(), dropDate: drop, headline: preset === "countdown" ? "New work" : undefined },
    };
  }, [preset, piece, host]);
  const v = useVideo(req, spec);
  const more = PRESETS.filter((p) => p.tier === "infinity").length;

  return (
    <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center">
      <VideoStage spec={spec} assets={v.assets} problem={v.problem} retry={v.retry} result={null} busy={false} title={`${piece.title} by ${piece.artist}`} className="max-w-[200px] sm:mx-0" />
      <div className="grid content-start gap-3">
        <h3 className="t-card">Auto videos</h3>
        <p className="t-muted">Reels made from your painting, ready for Instagram and TikTok. This one is live, made from <b className="text-ink">{piece.title}</b> by {piece.artist}.</p>
        <div role="radiogroup" aria-label="Video style" className="flex flex-wrap gap-2">
          {SHOWN.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={preset === id}
              onClick={() => setPreset(id)}
              className={cn("min-h-[40px] rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold transition", preset === id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}
            >
              {presetOf(id).name}
            </button>
          ))}
        </div>
        <p className="t-small">{more} styles with Infinity, on top of the {PRESETS.length - more} every artist gets.</p>
      </div>
    </div>
  );
}

const STEPS: { what: string; note: string; dab: string; soon?: boolean }[] = [
  { what: "You upload a painting", note: "That's the only step that's yours.", dab: "#8b2a4b" },
  { what: "A video is made for it", note: "Saved to your Share kit, ready to post.", dab: "#ff5a36", soon: true },
  { what: "Posted to Instagram, TikTok, Facebook and Pinterest", note: "With the title, price and your link.", dab: "#e1306c", soon: true },
];

function AutomationsPreview() {
  return (
    <div className="grid content-start gap-3">
      <h3 className="t-card">Automations</h3>
      <p className="t-muted">Upload once. Infinity does the posting.</p>
      <ol className="grid gap-0">
        {STEPS.map((s, i) => (
          <li key={s.what} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
            {i < STEPS.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-24px)] w-[2px] bg-line" aria-hidden="true" />}
            <span className="num grid h-7 w-7 place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ background: s.dab }} aria-hidden="true">{i + 1}</span>
            <span className="grid">
              <span className="text-[15.5px] font-semibold">
                {s.what}
                {s.soon && <span className="ml-2 inline-block rounded-full bg-wall px-2 py-0.5 align-middle text-[12px] font-bold text-ink-2">Coming soon</span>}
              </span>
              <span className="t-small">{s.note}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="t-small">Until auto-posting goes live, every post is ready to share by hand in your Share kit.</p>
    </div>
  );
}

export default function InfinityPreview({ piece, host }: { piece: PreviewPiece | null; host: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-6">
      <div className="box p-4 sm:p-6">
        {piece ? <VideoPreview piece={piece} host={host} /> : (
          <div className="grid gap-2">
            <h3 className="t-card">Auto videos</h3>
            <p className="t-muted">Reels made from your painting, ready for Instagram and TikTok.</p>
          </div>
        )}
      </div>
      <div className="box p-4 sm:p-6"><AutomationsPreview /></div>
    </div>
  );
}
