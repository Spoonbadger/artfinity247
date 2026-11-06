"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { failed, problemFrom, saved } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";
import StartInfinityButton from "@/components/pro/StartInfinityButton";

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

/** In place of a switch on Free: a quiet label. The section's one "Get Infinity" button is the way in. */
function Locked() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-wall px-3 py-1.5 text-[13px] font-semibold text-ink-2">
      <Lock className="h-3.5 w-3.5" aria-hidden="true" />Infinity
    </span>
  );
}

/** Saved on the server (app/api/studio/automations), on every plan. */
export type ServerAutomations = { newsletter: boolean; digest: boolean };

export default function AutomationsPanel({ pro, storageKey, recent, server: initialServer = { newsletter: false, digest: true } }: { pro: boolean; storageKey: string; recent: Recent[]; server?: ServerAutomations }) {
  const [prefs, setPrefs] = useState<AutomationPrefs>(DEFAULT_PREFS);
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

  const row = (dab: string, name: string, note: string | null, control: React.ReactNode, extra?: React.ReactNode) => (
    <li className="flex items-center gap-3 py-3">
      <i className="paint-dab" style={{ ["--dab" as string]: dab }} aria-hidden="true" />
      <span className="grid min-w-0 flex-1">
        <span className="text-[15.5px] font-semibold">{name}</span>
        {note && <span className="text-[13px] text-ink-2">{note}</span>}
        {extra}
      </span>
      {control}
    </li>
  );

  return (
    <div className="grid gap-6">
      {/* Real on every plan: these come first. */}
      <section aria-labelledby="every-h" className="af-panel grid p-4 sm:p-5">
        <h2 id="every-h" className="t-card">On every plan</h2>
        <ul className="grid divide-y divide-line">
          {/* After an upload, a draft with the new pieces (lib/newsletterAuto.ts). */}
          {row("#ffd43b", "Draft a newsletter when I upload", "We email you a draft. Nothing goes out until you press Send.",
            <Switch on={server.newsletter} disabled={saving === "newsletter"} label="Draft a newsletter when I upload new work" onChange={(v) => saveServer("newsletter", v)} />,
            <Link href="/studio/newsletter?from=new" className="mt-1 inline-flex min-h-[40px] w-fit items-center text-[13.5px] font-semibold text-scan md:min-h-0">Draft one now →</Link>)}
          {row("#5bc0be", "Weekly digest", "Monday morning: scans, views, sales and one tip.",
            <Switch on={server.digest} disabled={saving === "digest"} label="Weekly digest email" onChange={(v) => saveServer("digest", v)} />)}
        </ul>
      </section>

      <section aria-labelledby="social-h" className="af-panel grid gap-1 p-4 sm:p-5">
        <h2 id="social-h" className="t-card">With Infinity</h2>
        <p className="text-[13.5px] text-ink-2">
          Auto-posting goes live soon. Until then, the <Link href="/studio/share" className="font-semibold text-ink underline underline-offset-2">Share kit</Link> has every post ready.
        </p>
        <ul className="grid divide-y divide-line">
          {SOCIAL.map((s) => row(s.dab, `Post new paintings to ${s.name}`, null,
            pro ? <Switch on={prefs[s.key]} disabled={false} label={`Post new paintings to ${s.name}`} onChange={(v) => set(s.key, v)} /> : <Locked />))}
          {OTHER.map((o) => row(o.dab, o.name, o.note,
            pro ? <Switch on={prefs[o.key]} disabled={false} label={o.name} onChange={(v) => set(o.key, v)} /> : <Locked />))}
        </ul>
        {!pro && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <StartInfinityButton className="btn btn-blue btn-sm min-h-[44px] md:min-h-0" included />
            <Link href="/studio/infinity#referrals" className="inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-ink-2 underline underline-offset-2 hover:text-ink md:min-h-0">Get 2 months free</Link>
          </div>
        )}
      </section>

      <details className="group grid gap-3">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <span className="grid">
            <b className="text-[17px]">What would run for your latest uploads</b>
            <span className="text-[13px] text-ink-2">A preview. Nothing is posted yet.</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-3">
        {recent.length === 0 ? (
          <EmptyState
            compact
            title="Nothing has run yet"
            body="Each piece you add shows up here with what would run for it."
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
        </div>
      </details>
    </div>
  );
}
