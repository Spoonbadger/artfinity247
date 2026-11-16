"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { STUDIO_NAV } from "./StudioNav";

type Hit = { kind: "page" | "art" | "collection"; id: string; title: string; sub: string; href: string };
const KIND: Record<Hit["kind"], string> = { page: "Page", art: "Art", collection: "Collection" };

/** Studio header search: Studio pages (matched here), plus the artist's art and collections. ⌘K / Ctrl+K opens it. */
export default function StudioSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = q.trim().toLowerCase();
  const pages = useMemo<Hit[]>(() => {
    if (!term) return [];
    return STUDIO_NAV.filter((p) => p.label.toLowerCase().includes(term))
      .slice(0, 5)
      .map((p) => ({ kind: "page", id: p.href, title: p.label, sub: p.href.startsWith("/studio") ? "Studio" : "Artfinity", href: p.href }));
  }, [term]);

  useEffect(() => {
    if (term.length < 2) { setFound([]); setBusy(false); return; }
    const n = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/studio/search?q=${encodeURIComponent(term)}`);
        const d = await r.json();
        if (n === seq.current) setFound(d.hits || []);
      } catch {
        if (n === seq.current) setFound([]);
      } finally {
        if (n === seq.current) setBusy(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [term]);

  const hits = useMemo(() => [...pages, ...found], [pages, found]);
  useEffect(() => setSel(0), [hits.length]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    setOpen(false);
    setQ("");
    router.push(h.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(hits[sel]); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Search your Studio"
          className={cn(
            "flex h-10 items-center gap-2 rounded-full border-[1.5px] border-[color:var(--af-field-edge)] bg-white text-left text-[14px] text-ink-2 hover:border-ink",
            "w-10 justify-center sm:w-[300px] sm:justify-start sm:px-3",
            className,
          )}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden flex-1 truncate sm:inline">Pages, art, collections</span>
          <kbd className="hidden rounded border border-line px-1.5 text-[12px] font-semibold md:inline">⌘K</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-[10svh] z-[61] grid w-[min(640px,calc(100vw-32px))] -translate-x-1/2 gap-0 overflow-hidden rounded-2xl border border-edge bg-white shadow-xl">
          <Dialog.Title className="sr-only">Search your Studio</Dialog.Title>
          <Dialog.Description className="sr-only">Studio pages, your art by title, and your collections.</Dialog.Description>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="h-5 w-5 shrink-0 text-ink-2" aria-hidden="true" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
              placeholder="Search pages, art, collections…"
              aria-label="Search" role="combobox" aria-expanded={hits.length > 0} aria-controls="studio-search-results"
              aria-autocomplete="list" aria-activedescendant={hits[sel] ? `studio-hit-${sel}` : undefined}
              className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none"
            />
            {busy && <span className="t-small">…</span>}
          </div>
          <ul id="studio-search-results" role="listbox" className="max-h-[60svh] overflow-y-auto py-1">
            {term && !busy && hits.length === 0 && <li className="px-4 py-6 text-center text-[14px] text-ink-2">Nothing found.</li>}
            {!term && <li className="px-4 py-5 text-[13.5px] text-ink-2">Type a page name or a title. ↑ ↓ to move, Enter to open.</li>}
            {hits.map((h, i) => (
              <li key={`${h.kind}-${h.id}`} id={`studio-hit-${i}`} role="option" aria-selected={i === sel}>
                <button
                  type="button" onMouseEnter={() => setSel(i)} onClick={() => go(h)}
                  className={cn("grid w-full grid-cols-[88px_minmax(0,1fr)] items-baseline gap-3 px-4 py-2.5 text-left", i === sel && "bg-wall")}
                >
                  <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">{KIND[h.kind]}</span>
                  <span className="min-w-0">
                    <b className="block truncate text-[14.5px]">{h.title}</b>
                    {h.sub && <span className="block truncate text-[13px] text-ink-2">{h.sub}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
