"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { failed, problemFrom, saved, undoable } from "@/lib/feedback";
import HandleInput, { resolveHandle, type HandlePlatform } from "@/components/forms/HandleInput";
import { EmptyState } from "@/components/studio/EmptyState";
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, Download, Eye, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import QRCode from "@/components/af/QRCode";
import { qrSVG } from "@/lib/qr/render";
import { cn } from "@/lib/utils";
import LinkPage from "./LinkPage";
import SocialIcon from "./SocialIcon";
import ThemeControls, { Switch } from "./ThemeControls";
import { linkFontVars } from "./fonts";
import {
  KIND_LABEL,
  SOCIAL_KINDS,
  SOCIAL_PREFIX,
  detectKind,
  iconFor,
  isSocialKind,
  normalizeUrl,
  prettyUrl,
  type LinkRow,
  type LinksArt,
  type LinksPageData,
  type LinksTheme,
  type SocialKind,
} from "./model";

/* ---------------- API ---------------- */

class ApiError extends Error {
  constructor(message: string, public fix?: { label: string; href: string }, public status = 0) { super(message); }
}

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });
  } catch {
    throw new ApiError("You seem to be offline. Check your connection and try again.");
  }
  if (!res.ok) {
    const p = await problemFrom(res, "That didn't save. Something went wrong on our side.");
    throw new ApiError(p.message, p.fix, res.status);
  }
  return (await res.json().catch(() => ({}))) as T;
}

/** Error toast with the server's fix, or Try again when there's nothing to fix but the connection. */
function oops(e: unknown, retry?: () => void) {
  const err = e instanceof ApiError ? e : new ApiError("Something went wrong. Try again.");
  failed(err.message, { description: err.status >= 400 && err.status < 500 ? "" : undefined, fix: err.fix, retry: err.fix || (err.status >= 400 && err.status < 500) ? undefined : retry });
}

const num = (n: number) => n.toLocaleString("en-US");

/* ---------------- Sortable list (pointer drag + buttons) ---------------- */

function SortableList<T extends { id: string }>({
  items,
  label,
  onReorder,
  renderRow,
}: {
  items: T[];
  label: string;
  onReorder: (next: T[], commit: boolean) => void;
  renderRow: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const drag = useRef<{ id: string; startY: number; moved: boolean; pending: boolean } | null>(null);
  const live = useRef(items);
  if (!drag.current) live.current = items;
  // After a swap, wait for the DOM to show the new order before measuring again.
  useLayoutEffect(() => {
    if (drag.current) drag.current.pending = false;
  }, [items]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dy, setDy] = useState(0);

  function down(e: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = items;
    drag.current = { id, startY: e.clientY, moved: false, pending: false };
    setDragId(id);
    setDy(0);
  }

  function move(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    const list = listRef.current;
    if (!d || !list) return;
    let offset = e.clientY - d.startY;
    if (d.pending) {
      setDy(offset);
      return;
    }
    const arr = live.current;
    const idx = arr.findIndex((x) => x.id === d.id);
    const els = Array.from(list.children) as HTMLElement[];
    const el = els[idx];
    if (!el) return;
    const center = el.offsetTop + el.offsetHeight / 2 + offset;
    const next = els[idx + 1];
    const prev = els[idx - 1];
    let swapTo = -1;
    let shift = 0;
    if (next && center > next.offsetTop + next.offsetHeight / 2) {
      swapTo = idx + 1;
      shift = next.offsetTop + next.offsetHeight - (el.offsetTop + el.offsetHeight);
    } else if (prev && center < prev.offsetTop + prev.offsetHeight / 2) {
      swapTo = idx - 1;
      shift = prev.offsetTop - el.offsetTop;
    }
    if (swapTo >= 0) {
      const copy = [...arr];
      [copy[idx], copy[swapTo]] = [copy[swapTo], copy[idx]];
      d.startY += shift;
      d.moved = true;
      d.pending = true;
      offset = e.clientY - d.startY;
      live.current = copy;
      onReorder(copy, false);
    }
    setDy(offset);
  }

  function up() {
    const d = drag.current;
    drag.current = null;
    setDragId(null);
    setDy(0);
    if (d?.moved) onReorder(live.current, true);
  }

  return (
    <ul ref={listRef} className="grid gap-2" aria-label={label}>
      {items.map((item, i) => {
        const dragging = dragId === item.id;
        const handle = (
          <button
            type="button"
            aria-label="Drag to reorder"
            title="Drag to reorder"
            tabIndex={-1}
            onPointerDown={(e) => down(e, item.id)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-ink-2 hover:bg-wall active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" aria-hidden="true" />
          </button>
        );
        return (
          <li
            key={item.id}
            className={cn("relative", dragging ? "z-10" : "transition-transform")}
            style={dragging ? { transform: `translateY(${dy}px)` } : undefined}
          >
            {renderRow(item, i, handle)}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- One link row ---------------- */

function Row({
  link,
  index,
  count,
  handle,
  onMove,
  onToggle,
  onSave,
  onDelete,
}: {
  link: LinkRow;
  index: number;
  count: number;
  handle: ReactNode;
  onMove: (dir: -1 | 1) => void;
  onToggle: (active: boolean) => void;
  onSave: (patch: { url: string; label: string | null; display: "icon" | "button" }) => Promise<boolean>;
  onDelete: () => Promise<void>;
}) {
  const social = isSocialKind(link.kind);
  const kind = iconFor(link);
  const title = link.label || KIND_LABEL[kind];
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(link.url.startsWith("mailto:") ? link.url.slice(7) : link.url);
  const [label, setLabel] = useState(link.label ?? "");
  const [display, setDisplay] = useState<"icon" | "button">(social ? "icon" : "button");
  const [busy, setBusy] = useState(false);
  const urlErr = url.trim() ? ("error" in normalizeUrl(url) ? (normalizeUrl(url) as { error: string }).error : null) : null;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (urlErr) return;
    setBusy(true);
    const ok = await onSave({ url, label: label.trim() || null, display });
    setBusy(false);
    if (ok) setEditing(false);
  }

  return (
    <div className={cn("rounded-xl border-[1.5px] bg-white", link.active ? "border-line" : "border-dashed border-line bg-[#f2f3ec80]")}>
      <div className="flex items-center gap-1.5 py-1.5 pl-1 pr-2 sm:gap-2">
        {handle}
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", link.active ? "bg-wall text-ink" : "bg-white text-ink-2")}>
          <SocialIcon kind={kind} />
        </span>
        {/* The row itself opens the editor; moving and deleting live in there. */}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          title={`Edit ${title}`}
          className="grid min-h-[44px] min-w-0 flex-1 rounded-lg px-1 text-left leading-tight hover:bg-wall/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-scan"
        >
          <b className={cn("flex items-center gap-1.5 truncate text-[15px]", !link.active && "text-ink-2")}>
            <span className="truncate"><span className="sr-only">Edit </span>{title}</span>
            <Pencil className="h-3.5 w-3.5 shrink-0 text-ink-2" aria-hidden="true" />
          </b>
          <span className="truncate text-[13px] text-ink-2">
            {link.active ? prettyUrl(link.url) : `Hidden · ${prettyUrl(link.url)}`}
          </span>
        </button>
        <span className="grid shrink-0 text-right text-[12px] leading-tight text-ink-2">
          <b className="num text-[15px] text-ink">{num(link.clicks)}</b>
          {link.clicks === 1 ? "click" : "clicks"}
        </span>
        <Switch checked={link.active} onChange={onToggle} label={`Show ${title}`} />
      </div>
      {editing && (
        <form onSubmit={save} className="grid gap-3 border-t border-line p-3">
          <label className="af-field">
            <span className="text-[13px] font-semibold text-ink-2">Link</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="off" className="bg-transparent text-[15px] outline-none" aria-invalid={!!urlErr} />
          </label>
          {urlErr && <p className="-mt-1.5 text-[13px] font-semibold text-coral">{urlErr}</p>}
          <label className="af-field">
            <span className="text-[13px] font-semibold text-ink-2">Label {display === "icon" && "(optional)"}</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className="bg-transparent text-[15px] outline-none" />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
            <span className="font-semibold text-ink-2">Show as</span>
            {(["icon", "button"] as const).map((d) => (
              <label key={d} className="cursor-pointer">
                <input type="radio" name={`disp-${link.id}`} checked={display === d} onChange={() => setDisplay(d)} className="peer sr-only" />
                <span className="inline-flex min-h-[36px] items-center rounded-full border-[1.5px] border-line px-3 font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-scan">
                  {d === "icon" ? "Icon up top" : "Button"}
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy} className="btn btn-sm">
              {busy ? "Saving" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <span className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${title} up`} title="Move up" className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-wall disabled:opacity-30">
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${title} down`} title="Move down" className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-wall disabled:opacity-30">
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </button>
              {/* No "are you sure": it goes right away with an Undo toast (lib/feedback undoable). */}
              <button type="button" onClick={() => void onDelete()} aria-label={`Delete ${title}`} title="Delete" className="grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-coral">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------------- Add forms ---------------- */

function AddSocial({ onAdd, have }: { onAdd: (p: { url: string; display: "icon"; kind: SocialKind }) => Promise<boolean>; have: Set<string> }) {
  const [kind, setKind] = useState<SocialKind | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prefix = kind ? SOCIAL_PREFIX[kind] : undefined;

  function toUrl(v: string) {
    const s = v.trim();
    if (!kind) return s;
    if (kind === "email" || kind === "website") return s;
    // A full URL or something with a dot: use as typed. Otherwise it's a handle.
    if (/[./:]/.test(s) && !/^@?[\w.]+$/.test(s.replace(/\.$/, ""))) return s;
    if (/^https?:\/\//i.test(s) || s.includes("/")) return s;
    return (prefix || "") + s.replace(/^@/, "");
  }

  // Social handles and websites: paste a profile link or @name and it becomes the handle (HandleInput).
  const handleKind: HandlePlatform | null = kind && kind !== "email" ? (kind as HandlePlatform) : null;
  const resolved = handleKind && value.trim() ? resolveHandle(handleKind, value) : null;
  const [handleErr, setHandleErr] = useState<string | null>(null);
  const url = resolved && "url" in resolved ? resolved.url : toUrl(value);
  const norm = value.trim() ? normalizeUrl(url) : null;
  const err = resolved && "error" in resolved ? null : norm && "error" in norm ? norm.error : null;
  const detected = norm && "url" in norm ? detectKind(norm.url) : null;
  const mismatch = kind && detected && detected !== kind && kind !== "website";

  const [empty, setEmpty] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (kind && !value.trim()) return setEmpty(true);
    if (resolved && "error" in resolved) return setHandleErr(resolved.error);
    if (!kind || !norm || "error" in norm) return;
    setBusy(true);
    const ok = await onAdd({ url: norm.url, display: "icon", kind: detected && kind !== "email" ? detected : kind });
    setBusy(false);
    if (ok) {
      setValue("");
      setKind(null);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Add a social">
        {SOCIAL_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k === kind ? null : k);
              setValue("");
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            aria-pressed={kind === k}
            className={cn(
              "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[13.5px] font-semibold transition",
              kind === k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink",
              have.has(k) && kind !== k && "opacity-60"
            )}
          >
            <SocialIcon kind={k} className="h-[18px] w-[18px]" />
            {KIND_LABEL[k]}
            {have.has(k) && <Check className="h-3.5 w-3.5" aria-label="(added)" />}
          </button>
        ))}
      </div>
      {kind && (
        <form onSubmit={submit} className="box-inset grid gap-2 p-3">
          {handleKind ? (
            <HandleInput
              ref={inputRef}
              platform={handleKind}
              value={value}
              onChange={(v) => { setValue(v); setEmpty(false); setHandleErr(null); }}
              label={kind === "website" ? "Website" : `${KIND_LABEL[kind]} handle or link`}
              error={handleErr}
              inputClassName="text-[15px]"
            />
          ) : (
          <label className="af-field">
            <span className="text-[13px] font-semibold text-ink-2">Email address</span>
            <span className="flex min-w-0 items-center text-[15px]">
              <input
                ref={inputRef}
                type="email"
                name="email"
                value={value}
                onChange={(e) => { setValue(e.target.value); setEmpty(false); }}
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@studio.com"
                className="min-w-0 flex-1 bg-transparent outline-none"
                aria-invalid={!!err}
              />
            </span>
          </label>
          )}
          {err && <p className="text-[13px] font-semibold text-coral">{err}</p>}
          {empty && <p className="text-[13px] font-semibold text-coral">{kind === "email" ? "Type your email address first." : `Type your ${KIND_LABEL[kind]} ${kind === "website" ? "address" : "handle"} first.`}</p>}
          {mismatch && <p className="text-[13px] text-ink-2">That looks like {KIND_LABEL[detected!]}. It will show that icon.</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-sm gap-1.5">
              <Plus className="h-4 w-4" aria-hidden="true" /> {busy ? "Adding" : `Add ${KIND_LABEL[kind]}`}
            </button>
            <button type="button" onClick={() => setKind(null)} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function AddButton({ onAdd }: { onAdd: (p: { url: string; label: string; display: "button" }) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const norm = url.trim() ? normalizeUrl(url) : null;
  const err = norm && "error" in norm ? norm.error : null;
  const detected = norm && "url" in norm ? detectKind(norm.url) : null;

  const [empty, setEmpty] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return setEmpty(true);
    if (!norm || "error" in norm) return;
    const finalLabel = label.trim() || (detected ? KIND_LABEL[detected] : prettyUrl(norm.url).split("/")[0]);
    setBusy(true);
    const ok = await onAdd({ url: norm.url, label: finalLabel, display: "button" });
    setBusy(false);
    if (ok) {
      setUrl("");
      setLabel("");
      setOpen(false);
    }
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost w-full justify-center gap-2 sm:w-auto">
        <Plus className="h-5 w-5" aria-hidden="true" /> Add a link
      </button>
    );

  return (
    <form onSubmit={submit} className="box-inset grid gap-2.5 p-3">
      <label className="af-field">
        <span className="text-[13px] font-semibold text-ink-2">Link</span>
        <span className="flex items-center gap-2">
          {detected && <SocialIcon kind={detected} className="h-[18px] w-[18px] text-ink-2" />}
          <input autoFocus value={url} onChange={(e) => { setUrl(e.target.value); setEmpty(false); }} inputMode="url" autoComplete="off" autoCapitalize="none" placeholder="https://" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" aria-invalid={!!err} />
        </span>
      </label>
      {err && <p className="-mt-1 text-[13px] font-semibold text-coral">{err}</p>}
      {empty && <p className="-mt-1 text-[13px] font-semibold text-coral">Paste the link first, like yourname.art or a full https:// address.</p>}
      <label className="af-field">
        <span className="text-[13px] font-semibold text-ink-2">Button label</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder={detected ? KIND_LABEL[detected] : "Studio newsletter"} className="bg-transparent text-[15px] outline-none" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-sm gap-1.5">
          <Plus className="h-4 w-4" aria-hidden="true" /> {busy ? "Adding" : "Add link"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </form>
  );
}

/* ---------------- Panels ---------------- */

function Panel({ title, dab, aside, children, id }: { title: string; dab: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="af-panel grid gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2.5 font-display text-[24px] font-extrabold [font-variation-settings:'wdth'_80]">
          <i className="paint-dab h-4 w-5" style={{ ["--dab" as string]: dab }} />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PhonePreview({ data, theme }: { data: LinksPageData; theme: LinksTheme }) {
  return (
    <div className="mx-auto h-full w-full max-w-[380px] overflow-hidden rounded-[46px] border-[10px] border-ink bg-ink shadow-[12px_12px_0_rgba(21,22,27,.12)]">
      <div className="relative h-full overflow-y-auto overscroll-contain rounded-[36px] [scrollbar-width:none]">
        <LinkPage data={data} theme={theme} mode="preview" />
      </div>
    </div>
  );
}

/* ---------------- Editor ---------------- */

export default function LinksEditor({
  initialLinks,
  initialTheme,
  art,
  page,
}: {
  initialLinks: LinkRow[];
  initialTheme: LinksTheme;
  art: LinksArt[];
  page: LinksPageData;
}) {
  const [links, setLinks] = useState<LinkRow[]>(initialLinks);
  const [theme, setTheme] = useState<LinksTheme>(initialTheme);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const socials = links.filter((l) => isSocialKind(l.kind));
  const buttons = links.filter((l) => !isSocialKind(l.kind));
  const totalClicks = links.reduce((n, l) => n + l.clicks, 0);
  const shareUrl = `theartfinity.com/@${page.slug}/links`;
  const fullShareUrl = `https://${shareUrl}`;

  /* theme: autosave shortly after the last change */
  const lastSaved = useRef(JSON.stringify(initialTheme));
  useEffect(() => {
    const json = JSON.stringify(theme);
    if (json === lastSaved.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await api("/api/studio/links/theme", "PUT", { theme });
        lastSaved.current = json;
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        oops(e, () => setTheme((t) => ({ ...t })));
      }
    }, 600);
    return () => clearTimeout(t);
  }, [theme]);

  const setThemeKey = <K extends keyof LinksTheme>(key: K, value: LinksTheme[K]) => setTheme((t) => ({ ...t, [key]: value }));

  /* preview data mirrors the editor state */
  const previewData = useMemo<LinksPageData>(() => {
    const safe = art.filter((a) => a.sensitive.length === 0);
    const chosen = theme.bgArtworkId ? art.find((a) => a.id === theme.bgArtworkId) ?? null : null;
    return {
      ...page,
      links: links.filter((l) => l.active).map(({ id, kind, label, url }) => ({ id, kind, label, url })),
      background: chosen ?? safe[0] ?? null,
      theme,
    };
  }, [art, links, page, theme]);

  /* link actions */
  async function add(payload: Record<string, unknown>) {
    try {
      const { link } = await api<{ link: LinkRow }>("/api/studio/links", "POST", payload);
      setLinks((ls) => [...ls, link]);
      saved(`${link.label || KIND_LABEL[iconFor(link)]} added`, { description: "It's live on your links page now." });
      return true;
    } catch (e) {
      oops(e, () => add(payload));
      return false;
    }
  }

  async function save(id: string, patch: Record<string, unknown>, quiet = false) {
    try {
      const { link } = await api<{ link: LinkRow }>(`/api/studio/links/${id}`, "PATCH", patch);
      setLinks((ls) => {
        const next = ls.map((l) => (l.id === id ? link : l));
        // Switching between icon and button moves it to the other list; keep socials first.
        return [...next.filter((l) => isSocialKind(l.kind)), ...next.filter((l) => !isSocialKind(l.kind))];
      });
      if (!quiet) saved("Link saved");
      return true;
    } catch (e) {
      oops(e, () => save(id, patch, quiet));
      return false;
    }
  }

  async function toggle(id: string, active: boolean) {
    setLinks((ls) => ls.map((l) => (l.id === id ? { ...l, active } : l)));
    const ok = await save(id, { active }, true);
    if (ok) saved(active ? "Showing on your links page" : "Hidden from your links page", { description: active ? undefined : "It's still here. Switch it back on any time." });
    if (!ok) setLinks((ls) => ls.map((l) => (l.id === id ? { ...l, active: !active } : l)));
  }

  /** Gone right away, with Undo for 6 seconds; the delete is only sent after that (or when the page closes). */
  async function remove(id: string) {
    const at = links.findIndex((l) => l.id === id);
    const link = links[at];
    if (!link) return;
    undoable(`${link.label || KIND_LABEL[iconFor(link)]} deleted`, {
      hide: () => setLinks((ls) => ls.filter((l) => l.id !== id)),
      restore: () =>
        setLinks((ls) => {
          if (ls.some((l) => l.id === id)) return ls;
          const next = [...ls];
          next.splice(Math.min(at, next.length), 0, link);
          return next;
        }),
      commit: async () => {
        const res = await fetch(`/api/studio/links/${id}`, { method: "DELETE", credentials: "include", keepalive: true });
        if (!res.ok && res.status !== 404) throw new Error((await problemFrom(res, "That link wasn't deleted.")).message);
      },
      failMessage: "Link not deleted",
    });
  }

  async function persistOrder(next: LinkRow[]) {
    try {
      await api("/api/studio/links/reorder", "POST", { ids: next.map((l) => l.id) });
      saved("Order saved");
    } catch (e) {
      oops(e, () => persistOrder(next));
    }
  }

  function reorder(section: "social" | "button", list: LinkRow[], commit: boolean) {
    const next = section === "social" ? [...list, ...buttons] : [...socials, ...list];
    setLinks(next);
    if (commit) persistOrder(next);
  }

  function moveBy(section: "social" | "button", id: string, dir: -1 | 1) {
    const list = [...(section === "social" ? socials : buttons)];
    const i = list.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    reorder(section, list, true);
    // Keep keyboard focus on the moved row's same button.
    setTimeout(() => {
      const label = list[j].label || KIND_LABEL[iconFor(list[j])];
      const btn = document.querySelector<HTMLButtonElement>(`button[aria-label="Move ${CSS.escape(label)} ${dir < 0 ? "up" : "down"}"]:not(:disabled)`)
        ?? document.querySelector<HTMLButtonElement>(`button[aria-label="Move ${CSS.escape(label)} ${dir < 0 ? "down" : "up"}"]`);
      btn?.focus();
    }, 0);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      saved("Link copied", { description: "Paste it into your Instagram or TikTok bio." });
    } catch {
      failed("Couldn't copy", { description: `Your browser blocked it. Select ${shareUrl} and copy it by hand.` });
    }
  }

  function downloadQr() {
    const svg = qrSVG(fullShareUrl, { dots: "rounded", eyes: "rounded" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = `${page.slug}-links-qr.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    saved("QR code downloaded", { description: "Print it on cards or market signs. It opens this links page." });
  }

  const renderRows = (section: "social" | "button", list: LinkRow[]) => (
    <SortableList
      items={list}
      label={section === "social" ? "Your socials" : "Your links"}
      onReorder={(next, commit) => reorder(section, next, commit)}
      renderRow={(l, i, handle) => (
        <Row
          key={l.id + l.url + l.label + l.kind}
          link={l}
          index={i}
          count={list.length}
          handle={handle}
          onMove={(dir) => moveBy(section, l.id, dir)}
          onToggle={(v) => toggle(l.id, v)}
          onSave={(p) => save(l.id, p)}
          onDelete={() => remove(l.id)}
        />
      )}
    />
  );

  return (
    <div className={cn(linkFontVars, "grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_400px]")}>
      <div className="grid min-w-0 content-start gap-6 pb-16 lg:pb-0">
        {/* Share */}
        <section aria-label="Your link" className="af-card relative grid gap-4 overflow-hidden p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
          <div className="grid min-w-0 gap-2.5">
            <span className="eyebrow">Your link for bios</span>
            <a href={`/@${page.slug}/links`} target="_blank" rel="noreferrer" className="font-display text-[clamp(22px,3.4vw,30px)] [overflow-wrap:anywhere] font-extrabold leading-[1.05] text-ink no-underline [font-variation-settings:'wdth'_80] hover:text-scan">
              theartfinity.com/<wbr />@{page.slug}/<wbr />links
            </a>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} className="btn btn-blue btn-sm gap-1.5">
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <button type="button" onClick={downloadQr} className="btn btn-ghost btn-sm gap-1.5">
                <Download className="h-4 w-4" aria-hidden="true" /> QR code
              </button>
            </div>
            <p className="num text-[13px] text-ink-2">
              <b className="text-ink">{num(totalClicks)}</b> {totalClicks === 1 ? "click" : "clicks"} so far
              {totalClicks === 0 && <span>. Put it in your Instagram or TikTok bio.</span>}
            </p>
          </div>
          <div className="w-[104px] rounded-xl border-[1.5px] border-line bg-white p-2 sm:w-[120px]" title={`QR code for ${shareUrl}`}>
            <QRCode value={fullShareUrl} dots="rounded" eyes="rounded" />
          </div>
        </section>

        <Panel id="socials-h" title="Socials" dab="#5bc0be" aside={<span className="text-[13px] text-ink-2">Icons at the top. Also on your artist page.</span>}>
          <AddSocial onAdd={add} have={new Set(socials.map((s) => s.kind))} />
          {socials.length > 0 ? (
            renderRows("social", socials)
          ) : (
            <EmptyState compact title="No socials yet" body="Tap one above and add your handle. It shows as an icon up top." />
          )}
        </Panel>

        <Panel id="links-h" title="Links" dab="#ffd43b" aside={<span className="text-[13px] text-ink-2">Big buttons. Any link you like.</span>}>
          {buttons.length > 0 ? (
            renderRows("button", buttons)
          ) : (
            <EmptyState compact title="No links yet" body="Big buttons for anything, like this weekend's market or a commission form." />
          )}
          <AddButton onAdd={add} />
          <p className="flex items-center gap-2 rounded-lg bg-wall px-3 py-2.5 text-[13px] text-ink-2">
            <i className="paint-dab" style={{ ["--dab" as string]: "#2b37f0" }} />
            Shop my prints is always last, linked to your page.
          </p>
        </Panel>

        {/* Look: set once, so it starts folded. */}
        <details className="af-panel group p-4 sm:p-5">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span className="grid">
              <span className="flex items-center gap-2.5 font-display text-[24px] font-extrabold [font-variation-settings:'wdth'_80]">
                <i className="paint-dab h-4 w-5" style={{ ["--dab" as string]: "#e8743b" }} />
                Look
              </span>
              <span className="text-[13px] text-ink-2">Background, buttons, colors and fonts</span>
            </span>
            <span className="flex items-center gap-3">
              <span aria-live="polite" className={cn("text-[13px] font-semibold", saveState === "error" ? "text-coral" : "text-ink-2")}>
                {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved" : ""}
              </span>
              <ChevronDown className="h-5 w-5 transition group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          <div className="mt-4">
            <ThemeControls theme={theme} set={setThemeKey} art={art} />
          </div>
        </details>
      </div>

      {/* Desktop: live phone */}
      <aside aria-label="Live preview" className="hidden lg:block">
        <div className="sticky top-6 grid gap-3">
          <div className="h-[min(780px,calc(100vh-110px))]">
            <PhonePreview data={previewData} theme={theme} />
          </div>
          <p className="text-center text-[13px] text-ink-2">Live preview. Links don&apos;t open here.</p>
        </div>
      </aside>

      {/* Phones: Preview toggle */}
      <button
        type="button"
        onClick={() => setPreview(true)}
        className="btn fixed bottom-4 right-4 z-40 gap-2 shadow-[4px_4px_0_#ffd43b] lg:hidden"
        aria-haspopup="dialog"
      >
        <Eye className="h-5 w-5" aria-hidden="true" /> Preview
      </button>
      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Preview of your links page" className="fixed inset-0 z-50 grid grid-rows-[auto_minmax(0,1fr)] gap-3 bg-[rgba(21,22,27,.96)] p-3 pt-3 lg:hidden">
          <div className="flex items-center justify-between text-white">
            <span className="pl-2 text-[14px] font-semibold">Preview</span>
            <button type="button" onClick={() => setPreview(false)} autoFocus className="btn btn-sm gap-1.5 border-white bg-white text-ink">
              <X className="h-4 w-4" aria-hidden="true" /> Close
            </button>
          </div>
          <PhonePreview data={previewData} theme={theme} />
        </div>
      )}
    </div>
  );
}
