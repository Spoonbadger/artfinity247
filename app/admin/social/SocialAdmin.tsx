"use client";
// /admin/social: settings, Promote, the queue (draft → approved → posted/failed) and history for Artfinity's own
// Instagram. Works fully without Instagram keys ("manual mode": download, copy caption, mark as posted).
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { act, failed, problemFrom, saved } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";
import { Problem } from "@/components/studio/Problem";
import { FORMATS, PRESETS, type Season, type VideoFormat } from "@/lib/social/presets";
import type { SocialSettings } from "@/lib/social/settings";
import type { AdminPost, PromoteOptions } from "@/lib/social/admin";
import PostCard from "./PostCard";

type Ig = {
  connected: boolean;
  username: string | null;
  setup: { accountId: boolean; token: boolean; appCreds: boolean; version: string };
  health: { status: string; expiresAt: string | null; message: string } | null;
  quota: { used: number; limit: number } | null;
};

function Section({ id, title, sub, children, action }: { id: string; title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid scroll-mt-24 gap-4 rounded-2xl border border-line bg-white p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${id}-h`} className="display text-[30px]">{title}</h2>
          {sub && <p className="text-[14px] text-ink-2">{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Toggle({ label, sub, checked, onChange, disabled }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="grid"><b className="text-[15px]">{label}</b><span className="text-[13.5px] text-ink-2">{sub}</span></span>
    </label>
  );
}

function SettingsForm({ initial, connected, canEdit }: { initial: SocialSettings; connected: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SocialSettings>(k: K, v: SocialSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const save = async () => {
    setBusy(true);
    const res = await act("/api/admin/social/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) }, { success: "Settings saved", errorFallback: "Couldn't save the settings", retry: save });
    setBusy(false);
    if (res) router.refresh();
  };
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Toggle label="Post to Instagram automatically" sub={connected ? "Approved posts go out at the times below." : "Needs the Instagram keys. Until then, approved posts wait for you to post by hand."} checked={s.enabled} disabled={!canEdit} onChange={(v) => set("enabled", v)} />
        <Toggle label="Auto-queue new art" sub="When a piece is approved, add a draft for it (only artists who allow features)." checked={s.autoQueue} disabled={!canEdit} onChange={(v) => set("autoQueue", v)} />
      </div>
      <fieldset>
        <legend className="mb-2 text-[15px] font-bold">Presets for new drafts <span className="font-normal text-ink-2">(used in turn)</span></legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const on = s.presets.includes(p.id);
            return (
              <label key={p.id} className={cn("flex cursor-pointer items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[13.5px] font-semibold", on ? "border-ink bg-ink/5" : "border-line")}>
                <input type="checkbox" checked={on} disabled={!canEdit} onChange={() => set("presets", on ? s.presets.filter((x) => x !== p.id) : [...s.presets, p.id])} />
                {p.name}{p.pieces === "many" ? " (several pieces)" : ""}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="af-field">
          <small>Caption template · {"{title} {artist} {handle} {price} {link}"}</small>
          <textarea rows={4} value={s.captionTemplate} disabled={!canEdit} onChange={(e) => set("captionTemplate", e.target.value)} />
        </label>
        <div className="grid content-start gap-3">
          <label className="af-field"><small>Format</small>
            <select value={s.format} disabled={!canEdit} onChange={(e) => set("format", e.target.value as VideoFormat)}>
              {(Object.keys(FORMATS) as VideoFormat[]).map((f) => <option key={f} value={f}>{FORMATS[f].label}</option>)}
            </select>
          </label>
          <label className="af-field"><small>Posts a day, at most</small>
            <select value={s.maxPerDay} disabled={!canEdit} onChange={(e) => set("maxPerDay", Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>
      <label className="af-field"><small>Hashtags</small><input value={s.hashtags} disabled={!canEdit} onChange={(e) => set("hashtags", e.target.value)} /></label>
      <fieldset>
        <legend className="mb-2 text-[15px] font-bold">Posting times <span className="font-normal text-ink-2">(New York; the job runs at :05 past each hour)</span></legend>
        <div className="flex flex-wrap items-end gap-2">
          {s.times.map((t, i) => (
            <span key={i} className="flex items-end gap-1">
              <label className="af-field w-[130px]"><small>Time {i + 1}</small><input type="time" value={t} disabled={!canEdit} onChange={(e) => set("times", s.times.map((x, j) => (j === i ? e.target.value : x)))} /></label>
              {s.times.length > 1 && <button type="button" className="btn btn-ghost btn-sm mb-1" disabled={!canEdit} onClick={() => set("times", s.times.filter((_, j) => j !== i))} aria-label={`Remove time ${i + 1}`}><Trash2 size={14} aria-hidden="true" /></button>}
            </span>
          ))}
          {s.times.length < 5 && <button type="button" className="btn btn-ghost btn-sm mb-1" disabled={!canEdit} onClick={() => set("times", [...s.times, "18:00"])}><Plus size={14} aria-hidden="true" /> Add a time</button>}
        </div>
      </fieldset>
      {canEdit ? (
        <button type="button" className="btn btn-blue w-max" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</button>
      ) : <p className="text-[13.5px] text-ink-2">Only admins and owners can change these.</p>}
    </div>
  );
}

function Promote({ options, canEdit }: { options: PromoteOptions; canEdit: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<"artwork" | "collection" | "event" | "artist">("artist");
  const [artistId, setArtistId] = useState(options[0]?.id ?? "");
  const [item, setItem] = useState("");
  const [headline, setHeadline] = useState("Artist of the week");
  const [preset, setPreset] = useState("");
  const [busy, setBusy] = useState(false);
  const a = options.find((o) => o.id === artistId);
  if (!options.length) return <EmptyState compact title="No art to promote yet" body="Promote needs an approved piece from an artist who allows features." action={{ label: "Review new art", href: "/admin/moderation" }} />;
  const items = kind === "artwork" ? a?.artworks.map((x) => ({ id: x.id, label: x.title })) : kind === "collection" ? a?.collections.map((x) => ({ id: x.id, label: `${x.title} (${x.count})` })) : kind === "event" ? a?.events.map((x) => ({ id: x.id, label: `${x.name} · ${x.start}` })) : [];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { kind, artistId, headline: kind === "artist" ? headline : undefined, preset: preset || undefined, artworkId: kind === "artwork" ? item : undefined, collectionId: kind === "collection" ? item : undefined, eventId: kind === "event" ? item : undefined };
      const res = await fetch("/api/admin/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const p = await problemFrom(res, "Couldn't add it"); failed(p.message, { fix: p.fix ?? { label: "See artists", href: "/admin/artists" } }); return; }
      const j = await res.json();
      saved(j.message || "Added to the queue", { description: "Open it in the queue to preview and approve." });
      router.refresh();
    } catch {
      failed("You seem to be offline", { description: "Check your connection and try again.", fix: { label: "Reload", href: "/admin/social" } });
    } finally {
      setBusy(false);
    }
  };
  const needsItem = kind !== "artist";
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="af-field"><small>Promote</small>
        <select value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setItem(""); }} disabled={!canEdit}>
          <option value="artist">An artist (e.g. artist of the week)</option>
          <option value="artwork">An artwork</option>
          <option value="collection">A collection</option>
          <option value="event">An event</option>
        </select>
      </label>
      <label className="af-field"><small>Artist</small>
        <select value={artistId} onChange={(e) => { setArtistId(e.target.value); setItem(""); }} disabled={!canEdit}>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name} (@{o.slug})</option>)}
        </select>
      </label>
      {needsItem ? (
        <label className="af-field"><small>{kind === "artwork" ? "Artwork" : kind === "collection" ? "Collection" : "Event"}</small>
          <select value={item} onChange={(e) => setItem(e.target.value)} disabled={!canEdit || !items?.length}>
            <option value="">{items?.length ? "Pick one" : `No ${kind}s`}</option>
            {items?.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
      ) : (
        <label className="af-field"><small>Headline</small><input value={headline} maxLength={80} onChange={(e) => setHeadline(e.target.value)} disabled={!canEdit} /></label>
      )}
      <label className="af-field"><small>Preset</small>
        <select value={preset} onChange={(e) => setPreset(e.target.value)} disabled={!canEdit}>
          <option value="">Pick for me</option>
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <button type="submit" className="btn btn-blue" disabled={!canEdit || busy || (needsItem && !item)}>{busy ? "Adding…" : "Add to queue"}</button>
        {needsItem && !items?.length && <span className="text-[13.5px] text-ink-2">This artist has no {kind}s. Pick another artist or promote the artist instead.</span>}
      </div>
    </form>
  );
}

export default function SocialAdmin({
  settings, queue, history, promote, scale, season, ig, canEdit, base, focus,
}: {
  settings: SocialSettings; queue: AdminPost[]; history: AdminPost[]; promote: PromoteOptions; scale: { n: number; note: string } | null; season: Season;
  ig: Ig; canEdit: boolean; cloud: boolean; base: string; focus: string | null;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const drafts = queue.filter((p) => p.status === "draft");
  const approved = queue.filter((p) => p.status !== "draft");
  const due = approved.filter((p) => p.status === "approved" && p.scheduledFor && new Date(p.scheduledFor) <= new Date());
  const checkToken = async () => {
    setChecking(true);
    const res = await act("/api/admin/social/token", { method: "POST" }, { success: "Token checked", errorFallback: "Couldn't check the token", next: undefined });
    setChecking(false);
    if (res) router.refresh();
  };
  const card = (p: AdminPost, i: number, list: AdminPost[]) => (
    <PostCard key={p.id} post={p} base={base} connected={ig.connected} canEdit={canEdit} scale={scale} season={season} first={i === 0} last={i === list.length - 1} focus={focus === p.id} />
  );

  return (
    <div className="grid gap-5">
      <div>
        <p className="eyebrow">Marketing</p>
        <h1 className="display text-[44px] sm:text-[56px]">Social</h1>
        <p className="max-w-[680px] text-[14px] text-ink-2">
          Videos of artists&apos; work for Artfinity&apos;s Instagram, made from our room scenes. Approving a post renders its video in your browser and schedules it.
          Artists who turned off &quot;feature my work&quot; are never queued. <Link href="/admin/social/setup" className="font-semibold text-scan">Setup guide →</Link>
        </p>
      </div>

      {!ig.connected ? (
        <Problem tone="info" title="Manual mode: Instagram isn't connected" fix={{ label: "How to connect", href: "/admin/social/setup" }}>
          Everything works: approve a post, then download the video, copy the caption, post it on Instagram and mark it as posted.
          To post automatically, add {[!ig.setup.accountId && "INSTAGRAM_BUSINESS_ACCOUNT_ID", !ig.setup.token && "INSTAGRAM_ACCESS_TOKEN"].filter(Boolean).join(" and ")}.
        </Problem>
      ) : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-earned/40 bg-earned-soft px-4 py-3 text-[14px]">
          <b>Connected{ig.username ? ` to ${ig.username}` : ""}</b>
          {ig.health && <span>Token: {ig.health.status}{ig.health.expiresAt ? `, expires ${new Date(ig.health.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</span>}
          {ig.quota && <span>Posts in the last 24 h: {ig.quota.used} of {ig.quota.limit}</span>}
          {!settings.enabled && <span className="font-semibold text-coral">Auto-posting is off</span>}
          {canEdit && <button type="button" className="btn btn-ghost btn-sm ml-auto" disabled={checking} onClick={checkToken}>{checking ? "Checking…" : "Check token"}</button>}
        </div>
      )}
      {ig.connected && ig.health && ig.health.status !== "ok" && ig.health.status !== "unknown" && (
        <Problem tone={ig.health.status === "expired" ? "error" : "warning"} title={ig.health.status === "expired" ? "The Instagram token has expired" : "The Instagram token expires soon"} fix={{ label: "Make a new token", href: "/admin/social/setup#token" }}>{ig.health.message}</Problem>
      )}
      {!ig.connected && due.length > 0 && (
        <Problem tone="warning" title={`${due.length} approved ${due.length === 1 ? "post is" : "posts are"} due`} fix={{ label: "Post them", href: "#queue" }}>Download each video, post it with its caption, then mark it as posted.</Problem>
      )}

      <nav aria-label="Social sections" className="flex flex-wrap gap-1.5">
        {[["queue", `Queue (${queue.length})`], ["promote", "Promote"], ["settings", "Settings"], ["history", `History (${history.length})`]].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border-[1.5px] border-line bg-white px-3.5 py-1.5 text-[14px] font-semibold no-underline hover:border-ink">{label}</a>
        ))}
      </nav>

      <Section id="queue" title="Queue" sub={`Approved posts go out ${settings.maxPerDay === 1 ? "once a day" : `up to ${settings.maxPerDay} a day`} at ${settings.times.join(", ")} New York.`}>
        {queue.length === 0 ? (
          <EmptyState
            title="Nothing in the queue"
            body={settings.autoQueue ? "New art shows up here as drafts once it's approved. Or promote a piece, a collection, an event or an artist now." : "Auto-queue is off. Promote something, or turn auto-queue on in Settings."}
            action={{ label: "Promote something", href: "#promote" }}
            secondary={settings.autoQueue ? { label: "Review new art", href: "/admin/moderation" } : { label: "Settings", href: "#settings" }}
          />
        ) : (
          <div className="grid gap-5">
            {approved.length > 0 && (
              <div className="grid gap-3">
                <h3 className="text-[16px] font-extrabold">Approved · scheduled</h3>
                <ol className="grid gap-3">{approved.map((p, i, l) => card(p, i, l))}</ol>
              </div>
            )}
            {drafts.length > 0 && (
              <div className="grid gap-3">
                <h3 className="text-[16px] font-extrabold">Drafts · waiting for approval</h3>
                <ol className="grid gap-3">{drafts.map((p, i, l) => card(p, i, l))}</ol>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section id="promote" title="Promote" sub="Feature any artwork, collection, event or artist. It goes to the queue as a draft.">
        <Promote options={promote} canEdit={canEdit} />
      </Section>

      <Section id="settings" title="Settings">
        <SettingsForm initial={settings} connected={ig.connected} canEdit={canEdit} />
      </Section>

      <Section id="history" title="History" sub="Posted, failed and skipped posts. Failed ones say why and how to fix it.">
        {history.length === 0 ? (
          <EmptyState compact title="No posts yet" body="Posted, failed and skipped posts show up here." action={{ label: "Go to the queue", href: "#queue" }} />
        ) : (
          <ol className="grid gap-3">{history.map((p) => <PostCard key={p.id} post={p} base={base} connected={ig.connected} canEdit={canEdit} scale={scale} season={season} focus={focus === p.id} />)}</ol>
        )}
      </Section>
    </div>
  );
}
