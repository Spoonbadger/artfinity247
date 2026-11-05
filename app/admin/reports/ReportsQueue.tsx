"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { REASON_SHORT, type AnyReason, type DmcaCounter, type DmcaNotice } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { artistPath, artPath } from "@/lib/urls";
import { useAdminCan } from "../_components/AdminRole";

export type ReportRow = {
  id: string;
  reason: string;
  details: string;
  notice: DmcaNotice | DmcaCounter | null;
  name: string;
  email: string;
  isRightsHolder: boolean;
  status: string;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  restoreAfter: string | null;
  artworkUrl: string;
  art: {
    slug: string | null;
    title: string;
    imageUrl: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    artistName: string;
    artistSlug: string;
    artistEmail: string;
    strikes: number;
  } | null;
};

const CHIP: Record<string, string> = {
  copyright: "bg-coral text-white",
  counter: "bg-scan text-white",
  ai: "bg-sticker text-ink",
  offensive: "bg-ink text-white",
  other: "bg-wall text-ink border border-line",
};
const ART_STATUS: Record<string, [string, string]> = {
  APPROVED: ["Live", "text-earned"],
  PENDING: ["Pending", "text-ink-2"],
  REJECTED: ["Taken down", "text-coral"],
};
const STATUS_LABEL: Record<string, string> = { removed: "Taken down", dismissed: "Dismissed", restored: "Restored" };
const EMPTY: Record<string, string> = { queue: "No reports waiting.", removed: "Nothing taken down yet.", closed: "Nothing here yet." };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

type Action = "takedown" | "dismiss" | "restore";

export default function ReportsQueue({ rows: initial, tab }: { rows: ReportRow[]; tab: string }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // DMCA notices and counter-notices: owner and admin only (support sees them, can't decide them).
  const canDmca = useAdminCan("takedown");

  async function act(r: ReportRow, action: Action) {
    if (action === "takedown" && !confirm(`Take down “${r.art?.title}”? The artist and reporter will be emailed.`)) return;
    if (action === "restore" && r.restoreAfter && new Date() < new Date(r.restoreAfter) && !confirm("The 10 business-day wait isn’t over. Restore anyway?")) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/reports/${r.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: notes[r.id] || "" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong.");
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toast.success(action === "takedown" ? "Taken down. Artist and reporter emailed." : action === "restore" ? "Restored. The artist was emailed." : "Dismissed.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  if (!rows.length) {
    return (
      <div className="grid justify-items-start gap-2 rounded-2xl border border-dashed border-line bg-white p-8">
        <span className="paint-dab h-5 w-5" style={{ ["--dab" as string]: "var(--af-scan)" }} aria-hidden="true" />
        <p className="text-[17px] font-semibold">{EMPTY[tab]}</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-5">
      {rows.map((r) => {
        const counter = r.reason === "counter";
        const n = r.notice;
        const [artLabel, artCls] = ART_STATUS[r.art?.status ?? ""] ?? ["", ""];
        return (
          <li key={r.id} className="af-card grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            {/* The art */}
            <div className="grid content-start gap-3">
              {r.art ? (
                <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                  <a href={artPath(r.art.artistSlug, r.art.slug ?? "")} target="_blank" rel="noopener noreferrer" className="block aspect-[4/5] overflow-hidden rounded-[3px] bg-gallery">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.art.imageUrl} alt={r.art.title} className="h-full w-full object-cover" loading="lazy" />
                  </a>
                  <div className="grid min-w-0 content-start gap-1">
                    <a href={artPath(r.art.artistSlug, r.art.slug ?? "")} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 text-[18px] font-bold text-ink hover:text-scan">
                      <span className="truncate">{r.art.title}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                    <span className="truncate text-[14px] text-ink-2">
                      by <Link href={artistPath(r.art.artistSlug)} target="_blank" className="font-semibold text-ink hover:text-scan">{r.art.artistName}</Link>
                    </span>
                    <span className="truncate text-[13px] text-ink-2">{r.art.artistEmail}</span>
                    <span className={cn("text-[13px] font-bold", artCls)}>{artLabel}</span>
                    {r.art.strikes > 0 && (
                      <span className="w-fit rounded-full bg-coral/10 px-2 py-0.5 text-[12px] font-bold text-coral">
                        {r.art.strikes} copyright takedown{r.art.strikes === 1 ? "" : "s"}{r.art.strikes >= 3 ? ": repeat infringer" : ""}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-1 rounded-xl border border-dashed border-line p-3 text-[14px]">
                  <span className="eyebrow">Not matched to a piece</span>
                  <a href={r.artworkUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-semibold text-scan">{r.artworkUrl || "No link given"}</a>
                </div>
              )}
            </div>

            {/* The report */}
            <div className="grid content-start gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-[12.5px] font-bold", CHIP[r.reason] ?? CHIP.other)}>{REASON_SHORT[r.reason as AnyReason] ?? r.reason}</span>
                {r.isRightsHolder && <span className="text-[12.5px] font-semibold text-ink-2">Signed by rights holder</span>}
                <span className="num ml-auto text-[13px] text-ink-2">{fmt(r.createdAt)}</span>
              </div>

              <dl className="grid gap-2 rounded-xl bg-wall p-3 text-[14px]">
                <Row label={counter ? "Artist" : "Reporter"}>
                  <b>{r.name}</b> · <a href={`mailto:${r.email}`} className="text-scan">{r.email}</a>
                </Row>
                {n && (
                  <Row label="Contact">{n.address} · {n.phone}</Row>
                )}
                {n?.kind === "dmca-notice" && <Row label="Original work"><Linkish text={n.original} /></Row>}
                {n?.kind === "dmca-notice" && n.notes && <Row label="Notes"><span className="whitespace-pre-wrap">{n.notes}</span></Row>}
                {n?.kind === "dmca-counter" && <Row label="Why it’s theirs"><span className="whitespace-pre-wrap">{n.removedWork}</span></Row>}
                {!n && <Row label="Details"><span className="whitespace-pre-wrap">{r.details || <i className="text-ink-2">None</i>}</span></Row>}
                {n && (
                  <Row label="Signed">
                    <span className="font-display italic">{n.signature}</span> · {fmt(n.signedAt)}
                    <ul className="mt-1 grid gap-0.5 text-[12.5px] text-ink-2">{n.statements.map((s) => <li key={s}>✓ {s}</li>)}</ul>
                  </Row>
                )}
                {counter && r.restoreAfter && r.status === "open" && (
                  <Row label="Restore after">
                    <b>{fmt(r.restoreAfter)}</b> <span className="text-ink-2">(10 business days after receipt, and by 14. Don’t restore if the reporter says they’ve filed suit.)</span>
                  </Row>
                )}
                {r.status !== "open" && (
                  <Row label="Outcome">
                    {STATUS_LABEL[r.status] ?? r.status} · {fmt(r.resolvedAt)}{r.adminNote ? ` · ${r.adminNote}` : ""}
                  </Row>
                )}
              </dl>

              {r.status === "open" && (
                <>
                  <label className="af-field">
                    <span className="label">{counter ? "Note (sent to the artist if you dismiss)" : "Note (sent to the artist if you take it down)"}</span>
                    <textarea rows={2} maxLength={1000} value={notes[r.id] || ""} onChange={(e) => setNotes((x) => ({ ...x, [r.id]: e.target.value }))} placeholder="Optional" />
                  </label>
                  {(counter || r.reason === "copyright") && !canDmca && <p className="text-[12.5px] text-ink-2">DMCA decisions need the admin or owner role.</p>}
                  <div className="flex flex-wrap gap-2">
                    {counter ? (
                      <button type="button" className="btn btn-blue" disabled={busy === r.id || !r.art || !canDmca} onClick={() => act(r, "restore")}>Restore</button>
                    ) : (
                      <button type="button" className="btn btn-blue" disabled={busy === r.id || !r.art || r.art.status === "REJECTED" || (r.reason === "copyright" && !canDmca)} onClick={() => act(r, "takedown")}>Take down</button>
                    )}
                    <button type="button" className="btn btn-ghost" disabled={busy === r.id || ((counter || r.reason === "copyright") && !canDmca)} onClick={() => act(r, "dismiss")}>Dismiss</button>
                  </div>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
      <dt className="eyebrow pt-0.5">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Linkish({ text }: { text: string }) {
  return /^https?:\/\/\S+$/i.test(text) ? (
    <a href={text} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-scan">{text}</a>
  ) : (
    <span className="whitespace-pre-wrap">{text}</span>
  );
}
