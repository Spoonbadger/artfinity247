"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";
import { passes, sortRows, SortSelect, TableToolbar, useTable, type SortDir } from "../_components/table";
import Medal from "@/components/af/Medal";
import VerifiedBadge from "@/components/af/VerifiedBadge";
import { fmtDate, type Evidence } from "@/components/artist/verification";
import type { MedalTier } from "@/lib/medals";

export type VerRow = {
  id: string;
  slug: string;
  name: string;
  email: string;
  city: string;
  avatar: string | null;
  joined: string;
  status: "NONE" | "PENDING" | "VERIFIED" | "REJECTED";
  verifiedAt: string | null;
  requestedAt: string | null;
  evidence: Evidence;
  note: string | null;
  printsSold: number;
  medal: MedalTier | null;
  art: { id: string; title: string; imageUrl: string }[];
};

const EMPTY: Record<string, string> = {
  queue: "No requests waiting",
  verified: "No verified artists yet",
  declined: "Nothing declined",
};
const SORTS: { key: string; dir: SortDir; label: string }[] = [
  { key: "date", dir: "asc", label: "Oldest first" },
  { key: "date", dir: "desc", label: "Newest first" },
  { key: "name", dir: "asc", label: "Name A–Z" },
  { key: "sold", dir: "desc", label: "Most prints sold" },
];

type Action = "approve" | "decline" | "revoke";

export default function VerificationQueue({ rows: initial, tab }: { rows: VerRow[]; tab: string }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revoking, setRevoking] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const t = useTable(`verification-${tab}`, { sort: { key: "date", dir: tab === "queue" ? "asc" : "desc" } });
  const shown = sortRows(
    rows.filter((r) => passes(t.filters, { search: `${r.name} ${r.email} ${r.slug} ${r.city}`, date: (tab === "verified" ? r.verifiedAt : r.requestedAt) ?? r.joined })),
    t.sort,
    (r, k) => (k === "date" ? (tab === "verified" ? r.verifiedAt : r.requestedAt) : k === "name" ? r.name.toLowerCase() : r.printsSold),
  );

  async function act(r: VerRow, action: Action) {
    const note = (notes[r.id] || "").trim();
    if (action === "decline" && !note) {
      setNoteOpen((o) => ({ ...o, [r.id]: true }));
      failed("Add a note so they know what to fix.", { description: "Declining needs a reason." });
      setTimeout(() => document.getElementById(`note-${r.id}`)?.focus(), 0);
      return;
    }
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/verification/${r.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong.");
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      saved(action === "approve" ? `${r.name} is verified` : action === "decline" ? "Declined" : `Seal removed from ${r.name}`, { description: action === "approve" ? "We emailed them." : action === "decline" ? `${r.name} got your note.` : undefined });
      router.refresh();
    } catch (e) {
      failed(e instanceof Error ? e.message : "Something went wrong.", { retry: () => act(r, action) });
    } finally {
      setBusy(null);
      setRevoking(null);
    }
  }

  if (!rows.length) {
    return <EmptyState title={EMPTY[tab]} dab="var(--af-earned)" />;
  }

  const toolbar = (
    <>
      <TableToolbar filters={t.filters} setFilter={t.setFilter} clear={t.clear} active={t.active} search="Name, email or city" dates count={shown.length} total={rows.length}>
        <SortSelect options={SORTS} sort={t.sort} onChange={t.setSort} />
      </TableToolbar>
      {shown.length === 0 && <EmptyState compact title="Nothing matches" action={{ label: "Clear filters", onClick: t.clear }} />}
    </>
  );

  if (tab === "queue") {
    return (
      <div className="grid min-w-0 gap-3">
      {toolbar}
      <ul className="grid gap-4">
        {shown.map((r) => (
          <li key={r.id} className="af-panel grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Who */}
            <div className="grid content-start gap-4">
              <Who r={r} />
              {r.art.length > 0 && (
                <div className="grid gap-1.5">
                  <span className="eyebrow">Their work on Artfinity</span>
                  <div className="grid grid-cols-4 gap-2">
                    {r.art.map((a) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={a.id} src={a.imageUrl} alt={a.title} className="aspect-[4/5] w-full rounded-[3px] object-cover" loading="lazy" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Evidence + decision */}
            <div className="grid content-start gap-4">
              <div className="grid gap-3 rounded-xl bg-wall p-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                {r.evidence.photo ? (
                  <a href={r.evidence.photo} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.evidence.photo} alt={`Photo sent by ${r.name}`} className="h-40 w-full rounded-lg object-cover sm:w-40" />
                  </a>
                ) : (
                  <div className="grid h-24 w-full place-items-center rounded-lg border border-dashed border-line text-[13px] text-ink-2 sm:h-40 sm:w-40">No photo</div>
                )}
                <dl className="grid min-w-0 content-start gap-2 text-[14px]">
                  <EvidenceLink label="Instagram" href={r.evidence.instagram} />
                  <EvidenceLink label="Website" href={r.evidence.website} />
                  {r.evidence.note && (
                    <div className="grid gap-0.5">
                      <dt className="eyebrow">Note</dt>
                      <dd className="text-ink">{r.evidence.note}</dd>
                    </div>
                  )}
                  <div className="grid gap-0.5">
                    <dt className="eyebrow">Sent</dt>
                    <dd className="text-ink-2">{fmtDate(r.requestedAt) || "Unknown"}</dd>
                  </div>
                </dl>
              </div>

              <details open={!!noteOpen[r.id] || !!notes[r.id]} onToggle={(e) => { const open = (e.target as HTMLDetailsElement).open; setNoteOpen((o) => ({ ...o, [r.id]: open })); }}>
                <summary className="cursor-pointer text-[13.5px] font-semibold text-ink-2 hover:text-ink">Note to the artist <span className="font-normal">(needed to decline)</span></summary>
                <label className="af-field mt-2">
                  <span className="label">Note</span>
                  <textarea
                    id={`note-${r.id}`}
                    rows={2}
                    maxLength={500}
                    value={notes[r.id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="e.g. The Instagram name doesn't match. Send a link that shows your name."
                  />
                </label>
              </details>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm" disabled={busy === r.id} onClick={() => act(r, "approve")}>
                  <VerifiedBadge size={16} className="-ml-1" /> Approve
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => act(r, "decline")}>
                  Decline
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
    {toolbar}
    <ul className="grid gap-3">
      {shown.map((r) => (
        <li key={r.id} className="af-panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="grid gap-2">
            <Who r={r} compact />
            {tab === "declined" && r.note && <p className="rounded-lg bg-wall px-3 py-2 text-[14px] text-ink-2">{r.note}</p>}
          </div>
          {tab === "verified" &&
            (revoking === r.id ? (
              <div className="grid gap-2 sm:w-[320px]">
                <label className="af-field">
                  <span className="label">Why (sent to the artist)</span>
                  <input id={`note-${r.id}`} value={notes[r.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} placeholder="Optional" />
                </label>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-sm" disabled={busy === r.id} onClick={() => act(r, "revoke")}>
                    Remove seal
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevoking(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm min-h-[40px] w-fit" onClick={() => setRevoking(r.id)}>
                Revoke
              </button>
            ))}
        </li>
      ))}
    </ul>
    </div>
  );
}

function Who({ r, compact = false }: { r: VerRow; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {r.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.avatar} alt="" className={compact ? "h-11 w-11 shrink-0 rounded-full object-cover" : "h-14 w-14 shrink-0 rounded-full object-cover"} />
      ) : (
        <span className={`grid shrink-0 place-items-center rounded-full bg-ink font-display font-bold text-white ${compact ? "h-11 w-11" : "h-14 w-14 text-xl"}`}>{r.name[0]}</span>
      )}
      <div className="grid min-w-0 gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Link href={`/@${r.slug}`} target="_blank" className={`truncate font-bold text-ink hover:text-scan ${compact ? "text-[16px]" : "text-[19px]"}`}>
            {r.name}
          </Link>
          {r.status === "VERIFIED" && <VerifiedBadge size={18} verifiedAt={r.verifiedAt} />}
          {r.medal && <Medal tier={r.medal} size={20} />}
        </span>
        <span className="truncate text-[13.5px] text-ink-2">
          {r.email}
          {r.city ? ` · ${r.city}` : ""}
        </span>
        <span className="num text-[12.5px] text-ink-2">
          {r.printsSold} prints sold · joined {fmtDate(r.joined)}
          {r.status === "VERIFIED" && r.verifiedAt ? ` · verified ${fmtDate(r.verifiedAt)}` : ""}
          {r.status === "REJECTED" && r.requestedAt ? ` · last sent ${fmtDate(r.requestedAt)}` : ""}
        </span>
      </div>
    </div>
  );
}

function EvidenceLink({ label, href }: { label: string; href?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="min-w-0 truncate">
        {href && /^https?:\/\//i.test(href) ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-scan">
            {href.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        ) : href ? (
          <span className="text-ink">{href}</span>
        ) : (
          <span className="text-ink-2">None</span>
        )}
      </dd>
    </div>
  );
}
