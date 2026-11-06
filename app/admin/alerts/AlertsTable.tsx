"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { passes, sortRows, SortTh, TableToolbar, Th, useTable } from "../_components/table";
import { StatusPill, THEAD } from "../_components/ui";
import { EmptyState } from "@/components/studio/EmptyState";

export type AlertRow = { id: string; severity: string; kind: string; kindLabel: string; title: string; href: string; at: string; meta: string; state: "open" | "snoozed" | "resolved" };

const RANK: Record<string, number> = { urgent: 0, normal: 1, low: 2 };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong.");
  return d as { message?: string };
}

/** Sortable, filterable alert list with bulk resolve and snooze. */
export default function AlertsTable({ rows, tab }: { rows: AlertRow[]; tab: string }) {
  const router = useRouter();
  const t = useTable(`alerts-${tab}`, { sort: tab === "open" ? { key: "severity", dir: "asc" } : { key: "at", dir: "desc" } });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const kinds = useMemo(() => Array.from(new Map(rows.map((r) => [r.kind, r.kindLabel]))).map(([value, label]) => ({ value, label })), [rows]);
  const shown = useMemo(
    () => sortRows(rows.filter((r) => passes(t.filters, { search: `${r.title} ${r.kindLabel}`, status: r.kind, date: r.at })), t.sort, (r, k) =>
      k === "severity" ? (RANK[r.severity] ?? 1) * 1e13 - new Date(r.at).getTime() / 1e3 : k === "at" ? r.at : k === "kind" ? r.kindLabel : r.title),
    [rows, t.filters, t.sort],
  );
  const picked = shown.filter((r) => sel.has(r.id));
  const all = shown.length > 0 && picked.length === shown.length;
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const run = async (action: string, ids: string[], extra: Record<string, unknown> = {}) => {
    setBusy(action + ids.join());
    let ok = 0;
    let err = "";
    for (const id of ids) {
      try { await post({ action, id, ...extra }); ok++; } catch (e: any) { err = e?.message || "Something went wrong."; }
    }
    setBusy(null);
    setSel(new Set());
    const verb = action === "resolve" ? "Resolved" : action === "snooze" ? "Snoozed" : action === "unsnooze" ? "Back in the list:" : "Reopened";
    if (ok) saved(`${verb} ${ok === 1 ? "1 alert" : `${ok} alerts`}`);
    if (err) failed(ids.length - ok === 1 ? err : `${ids.length - ok} didn't go through: ${err}`, { retry: () => run(action, ids, extra) });
    router.refresh();
  };

  if (rows.length === 0) {
    return <EmptyState dab="var(--af-edge-strong)" title={tab === "open" ? "Nothing needs you" : tab === "snoozed" ? "Nothing snoozed" : "No resolved alerts yet"} body={tab === "open" ? "New alerts show up here and on Home." : undefined} action={tab === "open" ? undefined : { label: "Open alerts", href: "/admin/alerts" }} />;
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <TableToolbar filters={t.filters} setFilter={t.setFilter} clear={t.clear} active={t.active} search="Search alerts" statuses={kinds.length > 1 ? kinds : undefined} statusLabel="Kind" dates count={shown.length} total={rows.length} />
      {picked.length > 0 && (
        <div className="sticky top-[64px] z-10 flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-white px-3 py-2 shadow-sm" role="region" aria-label="Bulk actions">
          <b className="num text-[14px]">{picked.length} selected</b>
          {tab === "history" ? (
            <button type="button" disabled={!!busy} onClick={() => run("reopen", picked.map((r) => r.id))} className="btn btn-blue btn-sm">Reopen</button>
          ) : (
            <>
              <button type="button" disabled={!!busy} onClick={() => run("resolve", picked.map((r) => r.id))} className="btn btn-blue btn-sm">Resolve</button>
              {tab === "open" && <button type="button" disabled={!!busy} onClick={() => run("snooze", picked.map((r) => r.id), { days: 1 })} className="btn btn-ghost btn-sm">Snooze 1 day</button>}
              {tab === "snoozed" && <button type="button" disabled={!!busy} onClick={() => run("unsnooze", picked.map((r) => r.id))} className="btn btn-ghost btn-sm">Unsnooze</button>}
            </>
          )}
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto min-h-[40px] text-[13px] font-semibold text-ink-2 underline">Clear</button>
        </div>
      )}
      <div className="relative overflow-x-auto rounded-2xl border border-edge bg-white">
        <table className="w-full text-[14px]">
          <caption className="sr-only">Alerts</caption>
          <thead className={THEAD}>
            <tr>
              <th scope="col" className="w-10 px-3 py-2"><input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(shown.map((r) => r.id)))} aria-label="Select all shown" className="h-4 w-4 accent-[var(--af-ink)]" /></th>
              <SortTh k="severity" label="Level" sort={t.sort} onSort={t.toggleSort} className="hidden sm:table-cell" />
              <SortTh k="title" label="Alert" sort={t.sort} onSort={t.toggleSort} />
              <SortTh k="at" label="Raised" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden sm:table-cell" />
              <Th align="right"><span className="sr-only">Actions</span></Th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-ink-2">Nothing matches. <button type="button" onClick={t.clear} className="font-semibold text-scan underline">Clear filters</button></td></tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className={cn("border-b border-line align-top last:border-b-0", sel.has(r.id) && "bg-scan-soft/40")}>
                <td className="px-3 py-2.5"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.title}`} className="h-4 w-4 accent-[var(--af-ink)]" /></td>
                <td className="hidden px-3 py-2.5 sm:table-cell"><StatusPill status={r.severity} /></td>
                <td className="min-w-0 px-3 py-2.5">
                  <span className="sm:hidden"><StatusPill status={r.severity} /></span>
                  <Link href={r.href} className="block break-words font-semibold text-ink no-underline hover:text-scan">{r.title}</Link>
                  <p className="text-[13px] text-ink-2">{r.kindLabel}{r.meta ? ` · ${r.meta}` : ""}<span className="sm:hidden"> · {when(r.at)}</span></p>
                </td>
                <td className="num hidden whitespace-nowrap px-3 py-2.5 text-right text-[13px] text-ink-2 sm:table-cell">{when(r.at)}</td>
                <td className="px-3 py-2.5 text-right">
                  {r.state === "resolved" ? (
                    <button type="button" disabled={!!busy} onClick={() => run("reopen", [r.id])} className="btn btn-ghost btn-sm">Reopen</button>
                  ) : r.state === "snoozed" ? (
                    <button type="button" disabled={!!busy} onClick={() => run("unsnooze", [r.id])} className="btn btn-ghost btn-sm">Unsnooze</button>
                  ) : (
                    <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end">
                      <label>
                        <span className="sr-only">Snooze {r.title}</span>
                        <select disabled={!!busy} value="" onChange={(e) => e.target.value && run("snooze", [r.id], { days: Number(e.target.value) })} className="min-h-[36px] cursor-pointer rounded-full border-[1.5px] border-line bg-white px-2.5 text-[13px] font-semibold text-ink hover:border-ink">
                          <option value="">Snooze</option>
                          <option value="1">1 day</option>
                          <option value="3">3 days</option>
                          <option value="7">1 week</option>
                        </select>
                      </label>
                      <button type="button" disabled={!!busy} onClick={() => run("resolve", [r.id])} className="btn btn-ghost btn-sm">Resolve</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
