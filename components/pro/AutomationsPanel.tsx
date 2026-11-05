"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { failed, problemFrom, saved } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";
import { Problem } from "@/components/studio/Problem";

// No schema field yet: saved per browser in localStorage.
// Needed: Artist.automations Json? holding the AutomationPrefs shape below.
export type AutomationPrefs = {
  instagram: boolean;
  tiktok: boolean;
  facebook: boolean;
  pinterest: boolean;
  newsletter: boolean;
  video: boolean;
};

export const DEFAULT_PREFS: AutomationPrefs = { instagram: false, tiktok: false, facebook: false, pinterest: false, newsletter: false, video: false };

const SOCIAL: { key: keyof AutomationPrefs; name: string; dab: string }[] = [
  { key: "instagram", name: "Instagram", dab: "#e1306c" },
  { key: "tiktok", name: "TikTok", dab: "#15161b" },
  { key: "facebook", name: "Facebook", dab: "#1877f2" },
  { key: "pinterest", name: "Pinterest", dab: "#e60023" },
];

const OTHER: { key: keyof AutomationPrefs; name: string; note: string; dab: string }[] = [
  { key: "video", name: "Make a video for every new painting", note: "10-second vertical reel, saved to your Share kit.", dab: "#ff5a36" },
];

type Recent = { slug: string; title: string; imageUrl: string; createdAt: string };

function Switch({ on, disabled, label, onChange }: { on: boolean; disabled: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-11 w-[62px] shrink-0 items-center rounded-full p-1 transition disabled:cursor-not-allowed disabled:opacity-50",
        on ? "bg-scan" : "bg-line",
      )}
    >
      <span className={cn("block h-[30px] w-[30px] rounded-full bg-white shadow transition-transform", on ? "translate-x-[24px]" : "translate-x-0")} />
    </button>
  );
}

/** In place of a switch on Free: says why it's off and links to the plan, so it's never a dead button. */
function Unlock({ label }: { label: string }) {
  return (
    <Link href="/studio/infinity" aria-label={`${label}: unlock with Infinity`} className="btn btn-sm min-h-[44px] shrink-0 gap-1.5 md:min-h-0">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 9.6-2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" /></svg>
      Unlock
    </Link>
  );
}

/** Saved on the server (app/api/studio/automations), on every plan. */
export type ServerAutomations = { newsletter: boolean; digest: boolean };

export default function AutomationsPanel({ pro, storageKey, recent, server: initialServer = { newsletter: false, digest: true } }: { pro: boolean; storageKey: string; recent: Recent[]; server?: ServerAutomations }) {
  const [prefs, setPrefs] = useState<AutomationPrefs>(DEFAULT_PREFS);
  // Which network's "Connect" was tapped: auto-posting isn't live yet, so we offer the Share kit instead.
  const [note, setNote] = useState<string | null>(null);
  const [server, setServer] = useState<ServerAutomations>(initialServer);
  const [saving, setSaving] = useState<keyof ServerAutomations | null>(null);

  async function saveServer(key: keyof ServerAutomations, v: boolean) {
    const prev = server;
    setServer({ ...server, [key]: v });
    setSaving(key);
    const retry = () => saveServer(key, v);
    try {
      const res = await fetch("/api/studio/automations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: v }) });
      if (!res.ok) {
        setServer(prev);
        const p = await problemFrom(res, "Couldn't save that switch.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : retry });
        return;
      }
      setServer(await res.json());
      if (key === "newsletter") saved(v ? "Newsletter drafts on" : "Newsletter drafts off", { description: v ? "Your next upload starts a draft. Nothing goes out until you press Send." : "Uploads won't start a draft." });
      else saved(v ? "Weekly digest on" : "Weekly digest off", { description: v ? "See you Monday morning." : "No more Monday email." });
    } catch {
      setServer(prev);
      failed("You seem to be offline", { description: "That switch didn't save. Check your connection and try again.", retry });
    } finally {
      setSaving(null);
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch { /* storage blocked: defaults */ }
  }, [storageKey]);

  function set(key: keyof AutomationPrefs, v: boolean) {
    const next = { ...prefs, [key]: v };
    setPrefs(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      saved(v ? "Switched on" : "Switched off", { description: "Saved on this device. It runs once auto-posting goes live." });
    } catch {
      failed("Couldn't save that here", { description: "This browser blocks saving settings. Try another browser." });
    }
  }

  const socialOn = SOCIAL.filter((s) => prefs[s.key]).map((s) => s.name);
  const actions = [
    socialOn.length ? `Post to ${socialOn.join(", ")}` : null,
    prefs.video ? "Make a video" : null,
  ].filter(Boolean) as string[];
  const serverActions = server.newsletter ? ["Draft a newsletter"] : [];

  return (
    <div className="grid gap-6">
      {!pro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[1.5px] border-ink bg-sticker/40 p-4">
          <span className="grid gap-0.5">
            <b className="text-[16px]">Automations are an Infinity tool</b>
            <span className="text-[14px] text-ink-2">Turn on Infinity to switch these on.</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <Link href="/studio/infinity" className="btn btn-blue btn-sm min-h-[44px] md:min-h-0">See Infinity</Link>
            <Link href="/studio/infinity#referrals" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">Get 2 months free</Link>
          </div>
        </div>
      )}

      <section aria-labelledby="social-h" className="af-panel grid gap-1 p-4 sm:p-5">
        <h2 id="social-h" className="text-[20px] font-bold">Post new paintings automatically</h2>
        <p className="mb-2 text-[13.5px] text-ink-2">Each new piece, with its QR link, the moment it’s live.</p>
        <ul className="grid divide-y divide-line">
          {SOCIAL.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center gap-3 py-3">
              <i className="paint-dab" style={{ ["--dab" as string]: s.dab }} aria-hidden="true" />
              <span className="min-w-0 flex-1 text-[15.5px] font-semibold">{s.name}</span>
              <button type="button" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0" aria-expanded={note === s.name} onClick={() => setNote(note === s.name ? null : s.name)}>
                Connect
              </button>
              {pro ? (
                <Switch on={prefs[s.key]} disabled={false} label={`Post new paintings to ${s.name}`} onChange={(v) => set(s.key, v)} />
              ) : (
                <Unlock label={`Post new paintings to ${s.name}`} />
              )}
            </li>
          ))}
        </ul>
        {note && (
          <Problem tone="info" title={`Posting straight to ${note} isn't ready yet`} fix={{ label: "Open Share kit", href: "/studio/share" }} className="mt-1">
            For now, the Share kit has a ready-made post, caption and link for every piece. Download it and post it to {note} in a minute.
          </Problem>
        )}
      </section>

      <section aria-label="More automations" className="af-panel grid p-4 sm:p-5">
        <ul className="grid divide-y divide-line">
          {/* Newsletter: real, on every plan. After an upload, a draft with the new pieces (lib/newsletterAuto.ts). */}
          <li className="flex items-center gap-3 py-3">
            <i className="paint-dab" style={{ ["--dab" as string]: "#ffd43b" }} aria-hidden="true" />
            <span className="grid min-w-0 flex-1">
              <span className="text-[15.5px] font-semibold">Draft a newsletter when I upload new work</span>
              <span className="text-[13px] text-ink-2">We start a draft with your new pieces and email you. Nothing goes to followers until you press Send.</span>
              <Link href="/studio/newsletter?from=new" className="mt-1 inline-flex min-h-[44px] w-fit items-center text-[13.5px] font-semibold text-scan md:min-h-0">Draft one now →</Link>
            </span>
            <Switch on={server.newsletter} disabled={saving === "newsletter"} label="Draft a newsletter when I upload new work" onChange={(v) => saveServer("newsletter", v)} />
          </li>
          <li className="flex items-center gap-3 py-3">
            <i className="paint-dab" style={{ ["--dab" as string]: "#5bc0be" }} aria-hidden="true" />
            <span className="grid min-w-0 flex-1">
              <span className="text-[15.5px] font-semibold">Weekly digest</span>
              <span className="text-[13px] text-ink-2">Monday morning: your scans, views, sales and one tip.</span>
            </span>
            <Switch on={server.digest} disabled={saving === "digest"} label="Weekly digest email" onChange={(v) => saveServer("digest", v)} />
          </li>
          {OTHER.map((o) => (
            <li key={o.key} className="flex items-center gap-3 py-3">
              <i className="paint-dab" style={{ ["--dab" as string]: o.dab }} aria-hidden="true" />
              <span className="grid min-w-0 flex-1">
                <span className="text-[15.5px] font-semibold">{o.name}</span>
                <span className="text-[13px] text-ink-2">{o.note}</span>
              </span>
              {pro ? <Switch on={prefs[o.key]} disabled={false} label={o.name} onChange={(v) => set(o.key, v)} /> : <Unlock label={o.name} />}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="activity-h" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="activity-h" className="text-[20px] font-bold">Activity</h2>
          <span className="sticker-badge text-[11.5px]">Preview</span>
        </div>
        <p className="text-[13.5px] text-ink-2">What would have run for your latest uploads. Nothing is posted yet.</p>
        {recent.length === 0 ? (
          <EmptyState
            compact
            title="Nothing has run yet"
            body="Each piece you add shows up here with what your automations would do for it: a newsletter draft, posts and a video."
            action={{ label: "Add your first piece", href: "/studio/art/new" }}
          />
        ) : (
          <ul className="af-panel grid divide-y divide-line">
            {recent.map((r) => (
              <li key={r.slug} className="flex items-center gap-3 p-3 sm:px-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.imageUrl} alt={r.title} className="h-12 w-12 shrink-0 rounded-[3px] object-cover" />
                <span className="grid min-w-0 flex-1">
                  <b className="truncate text-[14.5px]">{r.title}</b>
                  <span className="text-[13px] text-ink-2">
                    {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                    {[...(pro ? actions : []), ...serverActions].length ? `Would: ${[...(pro ? actions : []), ...serverActions].join(" · ")}` : pro ? "Nothing switched on" : "Infinity only"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
