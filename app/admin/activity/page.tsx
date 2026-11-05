import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../_components/gate";
import AuditList from "../_components/AuditList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity" };

const PAGE = 100;
const TARGETS = ["artist", "artwork", "order", "review", "report", "payout", "reprint", "scene"];

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

  const field = "min-h-[40px] rounded-lg border-[1.5px] border-line bg-white px-2.5 text-[14px] text-ink";
  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">Audit log</p>
        <h1 className="display text-[44px] sm:text-[56px]">Activity</h1>
        <p className="mt-2 max-w-[640px] text-[15px] text-ink-2">Every admin action, who did it and when. Filter by action, admin, what it was done to, or date.</p>
      </div>

      <form className="af-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.2fr_auto_auto_auto] lg:items-end" method="get">
        <label className="grid gap-1 text-[12.5px] font-semibold">Action
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
        <label className="grid gap-1 text-[12.5px] font-semibold">Admin
          <select name="admin" defaultValue={sp.admin || ""} className={field}>
            <option value="">Anyone</option>
            {admins.map((a) => <option key={a.adminEmail} value={a.adminEmail}>{a.adminEmail || "(no email)"}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold">Target
          <select name="target" defaultValue={sp.target || ""} className={field}>
            <option value="">Any</option>
            {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold">Target id
          <input name="id" defaultValue={sp.id || ""} placeholder="Artist, order or artwork id" className={field} />
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold">From
          <input type="date" name="from" defaultValue={sp.from || ""} className={field} />
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold">To
          <input type="date" name="to" defaultValue={sp.to || ""} className={field} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-blue btn-sm">Filter</button>
          {filtered && <Link href="/admin/activity" className="btn btn-ghost btn-sm">Clear</Link>}
        </div>
      </form>

      <section className="af-card grid gap-2 p-4">
        <p className="num text-[13px] text-ink-2">{total.toLocaleString()} {total === 1 ? "entry" : "entries"}{sp.before ? " (older page)" : ""}</p>
        <AuditList rows={shown} empty={filtered ? "Nothing matches these filters." : "Nothing logged yet. Admin actions show up here as they happen."} />
        {nextHref && <Link href={nextHref} className="btn btn-ghost btn-sm justify-self-start">Older entries</Link>}
      </section>
    </div>
  );
}
