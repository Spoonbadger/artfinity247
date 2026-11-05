"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Hit = { kind: "artist" | "order" | "artwork" | "code"; id: string; title: string; sub: string; href: string };
const KIND: Record<Hit["kind"], string> = { artist: "Artist", order: "Order", artwork: "Artwork", code: "Code" };

/** Header search box; ⌘K / Ctrl+K opens it anywhere in the admin. */
export default function AdminSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
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

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    const n = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`);
        const d = await r.json();
        if (n === seq.current) { setHits(d.hits || []); setSel(0); }
      } catch {
        if (n === seq.current) setHits([]);
      } finally {
        if (n === seq.current) setBusy(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

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
        <button type="button" className="flex min-h-[40px] w-full items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-3 text-left text-[14px] text-ink-2 hover:border-ink sm:w-[260px]" aria-label="Search the admin">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">Artists, orders, art, codes</span>
          <kbd className="hidden rounded border border-line px-1.5 text-[11px] font-semibold sm:inline">⌘K</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-[10svh] z-[61] grid w-[min(640px,calc(100vw-32px))] -translate-x-1/2 gap-0 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          <Dialog.Title className="sr-only">Search the admin</Dialog.Title>
          <Dialog.Description className="sr-only">Artists by name, handle or email; orders by number, buyer email or name; artworks by title or slug; printed codes.</Dialog.Description>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="h-5 w-5 shrink-0 text-ink-2" aria-hidden="true" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
              placeholder="Name, @handle, email, order number, title, code…"
              aria-label="Search" role="combobox" aria-expanded={hits.length > 0} aria-controls="admin-search-results"
              className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none"
            />
            {busy && <span className="text-[12px] text-ink-2">…</span>}
          </div>
          <ul id="admin-search-results" role="listbox" className="max-h-[60svh] overflow-y-auto py-1">
            {q.trim().length >= 2 && !busy && hits.length === 0 && <li className="px-4 py-6 text-center text-[14px] text-ink-2">Nothing found.</li>}
            {q.trim().length < 2 && <li className="px-4 py-5 text-[13.5px] text-ink-2">Type at least 2 characters. ↑ ↓ to move, Enter to open.</li>}
            {hits.map((h, i) => (
              <li key={`${h.kind}-${h.id}`} role="option" aria-selected={i === sel}>
                <button
                  type="button" onMouseEnter={() => setSel(i)} onClick={() => go(h)}
                  className={cn("grid w-full grid-cols-[72px_minmax(0,1fr)] items-baseline gap-3 px-4 py-2.5 text-left", i === sel && "bg-wall")}
                >
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-2">{KIND[h.kind]}</span>
                  <span className="min-w-0">
                    <b className="block truncate text-[14.5px]">{h.title}</b>
                    <span className="block truncate text-[12.5px] text-ink-2">{h.sub}</span>
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
