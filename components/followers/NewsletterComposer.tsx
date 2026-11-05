"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { failed, problemFrom, saved } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";
import { Problem } from "@/components/studio/Problem";
import { ConfirmEmailProblem } from "@/components/studio/ResendConfirmButton";
import { artUrl, artistUrl } from "@/lib/urls";
import { MAX_ARTWORKS, MAX_BODY, MAX_SUBJECT, renderNewsletter } from "@/lib/newsletter";

export type ComposerDraft = { id: string | null; subject: string; body: string; artworkIds: string[] };
type Art = { id: string; slug: string; title: string; imageUrl: string };
type Sent = { id: string; subject: string; sentAt: string; recipients: number; pieces: number };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
const tracked = (url: string) => `${url}?utm_source=newsletter&utm_medium=email`;

export default function NewsletterComposer({
  initial,
  artist,
  artworks,
  recipients,
  nextSendAt,
  base,
  drafts,
  sent,
  verified = true,
}: {
  /** The account email is confirmed. Sends and tests wait for it; drafts don't. */
  verified?: boolean;
  initial: ComposerDraft | null;
  artist: { name: string; firstName: string; handle: string; avatar: string | null; email: string };
  artworks: Art[];
  recipients: number;
  nextSendAt: string | null;
  base: string;
  drafts: { id: string; subject: string; createdAt: string }[];
  sent: Sent[];
}) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [picked, setPicked] = useState<string[]>(initial?.artworkIds ?? []);
  const [busy, setBusy] = useState<null | "save" | "test" | "send">(null);
  const [confirming, setConfirming] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Why the last send or test couldn't go, shown above the buttons with its fix.
  const [blocker, setBlocker] = useState<null | "followers" | "content">(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const toggle = (artId: string) =>
    setPicked((p) => (p.includes(artId) ? p.filter((x) => x !== artId) : p.length >= MAX_ARTWORKS ? (toast(`Up to ${MAX_ARTWORKS} pieces. Tap one to take it out first.`), p) : [...p, artId]));

  // Live preview: the same renderer the send uses.
  const preview = useDeferredValue({ subject, body, picked });
  const html = useMemo(() => {
    const cards = preview.picked
      .map((pid) => artworks.find((a) => a.id === pid))
      .filter(Boolean)
      .map((a) => ({ title: a!.title, imageUrl: a!.imageUrl, url: tracked(artUrl(artist.handle, a!.slug, base)) }));
    const { html } = renderNewsletter({
      artistName: artist.name,
      avatar: artist.avatar,
      artistUrl: tracked(artistUrl(artist.handle, base)),
      subject: preview.subject || "Your subject",
      body: preview.body || "Write a few words about what you've been painting.",
      artworks: cards,
      unsubscribe: "#",
      base,
    });
    return html.replace("<head>", '<head><base target="_blank">');
  }, [preview, artworks, artist, base]);

  /** Checks that would stop a test or send, before asking the server. Returns false and shows the fix. */
  function ready(action: "test" | "send") {
    if (!verified) {
      failed("Confirm your email first", { description: "Newsletters and tests go out from confirmed accounts only.", fix: { label: "Resend confirmation", href: "/studio#confirm-email" } });
      actionsRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return false;
    }
    if (!subject.trim() || !body.trim()) {
      setBlocker("content");
      failed(subject.trim() ? "Write a few words first" : "Add a subject first", { description: "Followers see the subject in their inbox, then your note.", fix: { label: "How newsletters work", href: "/help/growing/followers-newsletter" } });
      (subject.trim() ? bodyRef : subjectRef).current?.focus();
      return false;
    }
    if (action === "send" && recipients === 0) {
      setBlocker("followers");
      failed("No followers yet", { description: "Share your follow link or add people who signed up with you. Then send.", fix: { label: "Add followers", href: "/studio/followers#add-followers" } });
      actionsRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return false;
    }
    if (action === "send" && nextSendAt) {
      failed(`One newsletter a day. Next send opens ${when(nextSendAt)}.`, { description: "Press Save as draft below and send it then.", fix: { label: "See past sends", href: "/studio/newsletter#past-h" } });
      actionsRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return false;
    }
    setBlocker(null);
    return true;
  }

  async function call(action: "save" | "test" | "send") {
    if (busy) return;
    if (action !== "save" && !ready(action)) return;
    setBusy(action);
    try {
      const res = await fetch("/api/studio/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, subject, body, artworkIds: picked }),
      });
      if (!res.ok) {
        const p = await problemFrom(res, action === "save" ? "Couldn't save the draft." : "Couldn't send.");
        if (p.code === "no_followers") setBlocker("followers");
        if (p.code === "missing_content") setBlocker("content");
        if (p.code === "daily_limit") router.refresh();
        failed(p.message, { description: res.status < 500 && res.status !== 429 ? "" : undefined, fix: p.code === "email_unverified" ? { label: "Resend confirmation", href: "/studio#confirm-email" } : p.fix, retry: p.fix ? undefined : () => call(action) });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (action === "test") saved(`Test sent to ${data.to}`, { description: "Check your inbox (and spam) to see it the way followers will." });
      if (action === "save") {
        setId(data.id);
        saved("Draft saved", { description: "It's under Drafts below. Open it any time." });
        router.replace(`/studio/newsletter?id=${data.id}`, { scroll: false });
        router.refresh();
      }
      if (action === "send") {
        saved(`Sent to ${data.sent} ${data.sent === 1 ? "follower" : "followers"}`, { description: "It's under Sent below.", next: { label: "See followers", href: "/studio/followers" } });
        router.replace("/studio/newsletter", { scroll: false });
        router.refresh();
      }
    } catch {
      failed("You seem to be offline", { description: "Your words are still here. Check your connection and try again.", retry: () => call(action) });
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  const nextLabel = nextSendAt ? when(nextSendAt) : null;
  const list = showAll ? artworks : artworks.slice(0, 10);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
      <div className="grid gap-5">
        <label className="af-field">
          <span className="label">Subject</span>
          <input ref={subjectRef} value={subject} maxLength={MAX_SUBJECT} onChange={(e) => { setSubject(e.target.value); if (blocker === "content") setBlocker(null); }} placeholder="New work: Second Frost" />
        </label>
        <label className="af-field">
          <span className="label">What you&apos;ve been painting</span>
          <textarea ref={bodyRef} rows={9} value={body} maxLength={MAX_BODY} onChange={(e) => { setBody(e.target.value); if (blocker === "content") setBlocker(null); }} placeholder={"Hi,\n\nThis one started on a cold morning by the river…"} className="resize-y leading-relaxed" />
        </label>
        <p className="-mt-3 px-1 text-[12.5px] text-ink-2">Blank line for a new paragraph. **bold**, - lists and links work.</p>

        <section aria-labelledby="pick-h" className="grid gap-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="pick-h" className="text-[17px] font-bold">Add up to {MAX_ARTWORKS} of your artworks</h2>
            <span className="num text-[13px] text-ink-2">{picked.length}/{MAX_ARTWORKS}</span>
          </div>
          {artworks.length === 0 ? (
            <EmptyState
              compact
              title="No approved art yet"
              body="Once a piece is approved it shows up here, so you can put it in the email with a link to buy the print."
              action={{ label: "Add your first piece", href: "/studio/art/new" }}
              secondary={{ label: "See my art", href: "/studio/art" }}
            />
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {list.map((a) => {
                const n = picked.indexOf(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => toggle(a.id)}
                      aria-pressed={n >= 0}
                      title={a.title}
                      className={cn("relative block aspect-square w-full overflow-hidden rounded-[4px] border-2 bg-gallery transition", n >= 0 ? "border-scan shadow-[3px_3px_0_#15161b]" : "border-transparent hover:border-line")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.imageUrl} alt={a.title} loading="lazy" className={cn("h-full w-full object-cover", n < 0 && picked.length >= MAX_ARTWORKS && "opacity-50")} />
                      {n >= 0 && <span className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full border-[1.5px] border-ink bg-sticker text-[12px] font-extrabold text-ink">{n + 1}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {artworks.length > 10 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="justify-self-start text-[13.5px] font-semibold text-ink-2 underline hover:text-ink">
              {showAll ? "Show fewer" : `Show all ${artworks.length}`}
            </button>
          )}
        </section>

        {!verified && (
          <ConfirmEmailProblem email={artist.email} title="Confirm your email to send newsletters">
            Drafts save fine. Tests and sends go out once you click the link we sent to <b>{artist.email}</b>.
          </ConfirmEmailProblem>
        )}
        {verified && recipients === 0 && (
          <Problem
            tone={blocker === "followers" ? "warning" : "info"}
            title="No followers yet"
            fix={{ label: "Add followers", href: "/studio/followers#add-followers" }}
          >
            Newsletters go to people who follow you. Send yourself a test now, then{" "}
            <Link href="/studio/links" className="font-semibold text-ink underline underline-offset-2">share your follow link</Link> or add the people who signed up at a market.
          </Problem>
        )}
        {verified && nextLabel && (
          <Problem tone="info" title={`You sent one recently. Next send opens ${nextLabel}.`} fix={{ label: busy === "save" ? "Saving…" : id ? "Save draft" : "Save as draft", onClick: () => call("save") }}>
            One newsletter a day keeps followers happy. Save this as a draft and send it then.
          </Problem>
        )}
        {blocker === "content" && (
          <Problem tone="warning" title="Add a subject and a few words first" fix={{ label: subject.trim() ? "Write the message" : "Add a subject", onClick: () => (subject.trim() ? bodyRef : subjectRef).current?.focus() }}>
            Followers see the subject in their inbox, then your note and the pieces you picked.
          </Problem>
        )}

        <div ref={actionsRef} className="af-card grid scroll-mt-24 gap-3 p-4">
          {confirming ? (
            <div className="grid gap-3">
              <p className="text-[15px]"><b>Send to {recipients} {recipients === 1 ? "follower" : "followers"} now?</b> <span className="text-ink-2">You can send one newsletter a day.</span></p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => call("send")} disabled={!!busy} className="btn btn-blue min-h-[44px]">
                  <Send className="h-4 w-4" aria-hidden="true" />{busy === "send" ? "Sending…" : "Yes, send it"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={!!busy} className="btn btn-ghost min-h-[44px]">Not yet</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => ready("send") && setConfirming(true)} disabled={!!busy} className="btn btn-blue min-h-[44px]">
                <Send className="h-4 w-4" aria-hidden="true" />{recipients ? `Send to ${recipients} ${recipients === 1 ? "follower" : "followers"}` : "Send to followers"}
              </button>
              <button type="button" onClick={() => call("test")} disabled={!!busy} className="btn btn-ghost min-h-[44px]">
                {busy === "test" ? "Sending…" : "Send test to me"}
              </button>
              <button type="button" onClick={() => call("save")} disabled={!!busy} className="btn btn-ghost min-h-[44px]">
                {busy === "save" ? "Saving…" : id ? "Save draft" : "Save as draft"}
              </button>
            </div>
          )}
          <p className="text-[12.5px] text-ink-2">
            {recipients === 0
              ? `No confirmed followers yet. Tests go to ${artist.email}.`
              : `Goes to confirmed followers only. Tests go to ${artist.email}.`}
          </p>
        </div>

        {drafts.length > 0 && (
          <section aria-labelledby="drafts-h" className="grid gap-2">
            <h2 id="drafts-h" className="text-[17px] font-bold">Drafts</h2>
            <ul className="af-panel grid divide-y divide-line">
              {drafts.map((d) => (
                <li key={d.id}>
                  <Link href={`/studio/newsletter?id=${d.id}`} className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2.5 text-ink no-underline hover:bg-wall/60">
                    <span className="min-w-0 truncate text-[15px] font-semibold">{d.subject}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-2">{d.id === id && <Check className="h-4 w-4" aria-label="Open" />}{day(d.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="past-h" className="grid gap-2">
          <h2 id="past-h" className="text-[17px] font-bold">Sent</h2>
          {sent.length === 0 ? (
            <p className="af-panel p-4 text-[14px] text-ink-2">Your first newsletter will show up here.</p>
          ) : (
            <ul className="af-panel grid divide-y divide-line">
              {sent.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="grid min-w-0">
                    <b className="truncate text-[15px]">{n.subject}</b>
                    <span className="text-[13px] text-ink-2">{day(n.sentAt)}{n.pieces ? ` · ${n.pieces} ${n.pieces === 1 ? "piece" : "pieces"}` : ""}</span>
                  </span>
                  <span className="num shrink-0 text-[13px] font-semibold text-ink">{n.recipients} sent</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside aria-label="Email preview" className="grid gap-2 lg:sticky lg:top-6">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="eyebrow">Preview</h2>
          <span className="truncate text-[12.5px] text-ink-2">From {artist.name} via Artfinity</span>
        </div>
        <div className="overflow-hidden rounded-2xl border-[1.5px] border-ink bg-wall shadow-[6px_6px_0_#15161b]">
          <iframe title="Newsletter preview" srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="block h-[520px] w-full bg-white lg:h-[calc(100vh-120px)]" />
        </div>
      </aside>
    </div>
  );
}
