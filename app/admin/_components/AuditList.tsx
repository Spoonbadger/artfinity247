import Link from "next/link";
import { auditTargetHref } from "@/lib/audit";
import { DataTable, type Row } from "./table";

export type AuditRow = { id: string; adminEmail: string; action: string; targetType: string; targetId: string | null; summary: string; details: unknown; createdAt: Date };

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** What each action group looks like in the log. */
function tone(action: string) {
  if (/suspend|delete|reject|takedown|refund|revoke|decline|hide/.test(action) && !/unsuspend|undo/.test(action)) return "bg-coral/15 text-coral";
  if (/approve|verify|publish|restore|mark_paid|stripe_transfer|unsuspend|reopen|grant/.test(action)) return "bg-earned-soft text-earned";
  if (action.startsWith("note.")) return "bg-[#e6dcff] text-ink";
  return "bg-scan-soft text-scan";
}

/** Audit log rows, newest first. `compact` hides the target column (e.g. on an artist's own page). */
export default function AuditList({ rows, compact = false, empty = "Nothing logged yet." }: { rows: AuditRow[]; compact?: boolean; empty?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-[14px] text-ink-2">{empty}</p>;
  if (!compact) {
    // The full log: a sortable, searchable table.
    return (
      <DataTable
        id="activity"
        caption="Admin activity"
        minWidth={680}
        defaultSort={{ key: "when", dir: "desc" }}
        search="Summary, action or admin"
        columns={[
          { key: "when", label: "When", firstDir: "desc" },
          { key: "action", label: "Action" },
          { key: "summary", label: "What happened", sortable: false },
          { key: "admin", label: "Admin" },
        ]}
        rows={rows.map((r): Row => {
          const href = auditTargetHref(r.targetType, r.targetId, r.details);
          return {
            id: r.id,
            search: `${r.summary} ${r.action} ${r.adminEmail} ${r.targetType}`,
            sort: { when: r.createdAt.toISOString(), action: r.action, admin: r.adminEmail },
            cells: {
              when: <span className="num whitespace-nowrap text-[13px] text-ink-2">{when(r.createdAt)}</span>,
              action: <span className={`inline-block whitespace-nowrap rounded-full px-2 py-px text-[12px] font-bold ${tone(r.action)}`}>{r.action}</span>,
              summary: (
                <span className="block min-w-[220px]">
                  {r.summary || "—"}
                  {href && <Link href={href} className="ml-2 whitespace-nowrap text-[13px] font-semibold text-scan hover:underline">{r.targetType} →</Link>}
                </span>
              ),
              admin: <span className="block max-w-[200px] truncate text-[13px] text-ink-2">{r.adminEmail}</span>,
            },
          };
        })}
      />
    );
  }
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const href = auditTargetHref(r.targetType, r.targetId, r.details);
        return (
          <li key={r.id} className={compact ? "grid gap-1 py-2.5" : "grid gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[130px_minmax(0,1fr)_auto] sm:items-baseline"}>
            <span className="num text-[12.5px] text-ink-2">{when(r.createdAt)}{compact ? ` · ${r.adminEmail}` : ""}</span>
            <div className="min-w-0">
              <span className={`mr-2 inline-block rounded-full px-2 py-px text-[11.5px] font-bold ${tone(r.action)}`}>{r.action}</span>
              <span className="text-[14px]">{r.summary || "—"}</span>
              {!compact && href && (
                <Link href={href} className="ml-2 whitespace-nowrap text-[13px] font-semibold text-scan hover:underline">
                  {r.targetType} →
                </Link>
              )}
            </div>
            {compact ? null : <span className="truncate text-[12.5px] text-ink-2 sm:text-right">{r.adminEmail}</span>}
          </li>
        );
      })}
    </ul>
  );
}
