import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../_components/gate";
import AuditList from "../_components/AuditList";
import { PageHead } from "../_components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity" };

const PAGE = 100;
const TARGETS = ["artist", "artwork", "order", "review", "report", "payout", "reprint", "scene", "setting", "alert", "invite", "venue"];

type SP = { action?: string; admin?: string; target?: string; id?: string; from?: string; to?: string; before?: string };

const day = (s: string | undefined, end = false) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00-05:00`);
  return end ? new Date(d.getTime() + 86_400_000) : d;
};

export default async function ActivityPage({ searchParams }: { searchParams: SP }) {
  await adminOrRedirect("/admin/activity");
  const sp = searchParams;
  const where: Prisma.AdminActionWhereInput = {};
  // "artwork" matches every artwork.* action; "artwork.approve" matches exactly.
  if (sp.action) where.action = sp.action.includes(".") ? sp.action : { startsWith: `${sp.action}.` };
  if (sp.admin) where.adminEmail = sp.admin;
  if (sp.target && TARGETS.includes(sp.target)) where.targetType = sp.target;
  if (sp.id?.trim()) {
    const id = sp.id.trim();
    where.OR = [{ targetId: id }, { details: { path: ["artistId"], equals: id } }, { details: { path: ["orderId"], equals: id } }];
  }
  const from = day(sp.from), to = day(sp.to, true);
  const before = sp.before ? new Date(sp.before) : null;
  if (from || to || (before && !Number.isNaN(before.getTime()))) {
    where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}), ...(before && !Number.isNaN(before.getTime()) ? { lt: before } : {}) };
  }

  const [rows, actions, admins, total] = await Promise.all([
    prisma.adminAction.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE + 1 }),
    prisma.adminAction.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
    prisma.adminAction.groupBy({ by: ["adminEmail"], _count: { _all: true } }),
    prisma.adminAction.count({ where }),
  ]);
  const more = rows.length > PAGE;
  const shown = rows.slice(0, PAGE);
  const groups = Array.from(new Set(actions.map((a) => a.action.split(".")[0])));
  const nextHref = more ? `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => !!v)), before: shown[shown.length - 1].createdAt.toISOString() })}` : null;
  const filtered = Object.entries(sp).some(([k, v]) => k !== "before" && !!v);

  const field = "w-full min-w-0 min-h-[40px] rounded-lg border-[1.5px] border-line bg-white px-2.5 text-[14px] text-ink";
  const more_ = !!(sp.target || sp.id || sp.from || sp.to);
  return (
    <div className="grid gap-5">
      <PageHead title="Activity" sub={`${total.toLocaleString()} ${total === 1 ? "entry" : "entries"}${filtered ? " match" : ""}${sp.before ? " (older page)" : ""}`} />

      <form className="grid gap-2" method="get">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-[180px] flex-1 gap-1 text-[13px] font-semibold sm:max-w-[260px]">Action
            <select name="action" defaultValue={sp.action || ""} className={field}>
              <option value="">All actions</option>
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  <option value={g}>All {g}.*</option>
                  {actions.filter((a) => a.action.startsWith(`${g}.`)).map((a) => <option key={a.action} value={a.action}>{a.action} ({a._count._all})</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="grid min-w-[180px] flex-1 gap-1 text-[13px] font-semibold sm:max-w-[260px]">Admin
            <select name="admin" defaultValue={sp.admin || ""} className={field}>
              <option value="">Anyone</option>
              {admins.map((a) => <option key={a.adminEmail} value={a.adminEmail}>{a.adminEmail || "(no email)"}</option>)}
            </select>
          </label>
          <button type="submit" className="btn btn-ghost btn-sm min-h-[40px]">Apply</button>
          {filtered && <Link href="/admin/activity" className="min-h-[40px] content-center px-1 text-[13px] font-semibold text-ink-2 underline underline-offset-2">Clear filters</Link>}
        </div>
        <details open={more_}>
          <summary className="inline-flex min-h-[40px] cursor-pointer items-center text-[13.5px] font-semibold text-ink-2 hover:text-ink">More filters</summary>
          <div className="af-panel mt-1 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end [&>label]:min-w-0">
            <label className="grid gap-1 text-[13px] font-semibold">Target
              <select name="target" defaultValue={sp.target || ""} className={field}>
                <option value="">Any</option>
                {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[13px] font-semibold">Target id
              <input name="id" defaultValue={sp.id || ""} placeholder="Artist, order or artwork id" className={field} />
            </label>
            <label className="grid gap-1 text-[13px] font-semibold">From
              <input type="date" name="from" defaultValue={sp.from || ""} className={field} />
            </label>
            <label className="grid gap-1 text-[13px] font-semibold">To
              <input type="date" name="to" defaultValue={sp.to || ""} className={field} />
            </label>
          </div>
        </details>
      </form>

      <AuditList rows={shown} empty={filtered ? "Nothing matches these filters." : "Nothing logged yet."} />
      {nextHref && <Link href={nextHref} className="btn btn-ghost btn-sm justify-self-start">Older entries</Link>}
    </div>
  );
}
