"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { roleCan, type AdminRole } from "@/lib/adminCaps";

type NavLink = { href: string; label: string; dab: string; exact?: boolean; owner?: boolean; minRole?: AdminRole; match?: string };
// Today = the daily queues. Everything else is grouped by what it's about.
const SECTIONS: { title: string; links: NavLink[] }[] = [
  { title: "Today", links: [
    { href: "/admin", label: "Home", dab: "var(--af-sticker)", exact: true },
    { href: "/admin/alerts", label: "Alerts", dab: "var(--af-coral)" },
    { href: "/admin/orders", label: "Orders", dab: "var(--af-scan)" },
    { href: "/admin/moderation", label: "Moderation", dab: "var(--af-coral)" },
  ] },
  { title: "Prints", links: [
    { href: "/admin/reprints", label: "Reprints", dab: "#c98a5a" },
    { href: "/admin/code-orders", label: "Code orders", dab: "#ffd43b" },
    { href: "/admin/scanning", label: "Scanning", dab: "#2b37f0" },
  ] },
  { title: "People", links: [
    { href: "/admin/artists", label: "Artists", dab: "#b98bd9" },
    { href: "/admin/verification", label: "Verification", dab: "var(--af-sticker)" },
    { href: "/admin/reports", label: "Reports", dab: "var(--af-ink)" },
    { href: "/admin/reviews", label: "Reviews", dab: "#e3b23c" },
    { href: "/admin/venues", label: "Venues", dab: "#e8743b" },
  ] },
  { title: "Money", links: [
    { href: "/admin/payouts", label: "Payouts", dab: "var(--af-earned)" },
  ] },
  { title: "Content", links: [
    { href: "/admin/artworks", label: "Artworks", dab: "#7c8cff" },
    { href: "/admin/scenes", label: "Scenes", dab: "#5bc0be" },
    { href: "/admin/social", label: "Social", dab: "#c13584" },
  ] },
  { title: "System", links: [
    { href: "/admin/activity", label: "Activity", dab: "#9aa3b5" },
    { href: "/admin/jobs", label: "Jobs", dab: "#5bc0be", minRole: "admin" },
    { href: "/admin/team", label: "Team", dab: "#7c8cff" },
    // Settings, alert emails, rewards, scanning service and code print prices share tabs (settings/layout.tsx).
    { href: "/admin/settings", label: "Settings", dab: "var(--af-ink)", match: "/admin/settings" },
  ] },
];

const isOn = (pathname: string | null, l: NavLink) => (l.exact ? pathname === l.href : !!pathname?.startsWith(l.match ?? l.href));

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="num ml-auto rounded-full bg-coral px-1.5 text-[12px] font-bold leading-[18px] text-white" aria-label={`${n} open`}>{n}</span>;
}

/** Grouped admin menu: a sidebar on desktop; on phones, the Today queues plus a "More" menu. `counts` adds badges by href. */
export default function AdminNav({ counts = {}, role }: { counts?: Record<string, number>; role?: AdminRole }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [pathname]);
  // Only owners can open the general settings page; everyone else lands on their alert emails.
  const fix = (l: NavLink) => (l.href === "/admin/settings" && !roleCan(role, "owner") ? { ...l, href: "/admin/settings/notifications" } : l);
  const sections = SECTIONS.map((s) => ({ ...s, links: s.links.filter((l) => (!l.owner || roleCan(role, "owner")) && (!l.minRole || roleCan(role, l.minRole))).map(fix) })).filter((s) => s.links.length);
  const [today, ...rest] = sections;
  const restCount = rest.reduce((n, s) => n + s.links.reduce((m, l) => m + (counts[l.href] || 0), 0), 0);
  const restOn = rest.flatMap((s) => s.links).find((l) => isOn(pathname, l));
  return (
    <>
      {/* phones and tablets */}
      <nav aria-label="Admin" className="grid gap-2 lg:hidden">
        <div className="flex flex-wrap gap-1.5">
          {today.links.map((l) => {
            const on = isOn(pathname, l);
            return (
              <Link
                key={l.href} href={l.href} aria-current={on ? "page" : undefined}
                className={cn("flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 text-[14px] font-semibold no-underline", on ? "border-ink bg-ink text-white" : "border-edge-strong bg-white text-ink")}
              >
                {l.label}
                <Badge n={counts[l.href]} />
              </Link>
            );
          })}
          <button type="button" aria-expanded={more} aria-controls="admin-more" onClick={() => setMore(!more)} className={cn("flex min-h-[40px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 text-[14px] font-semibold", restOn ? "border-ink bg-ink text-white" : "border-edge-strong bg-white text-ink")}>
              {restOn ? restOn.label : "More"}
              <Badge n={restCount} />
              <svg aria-hidden="true" viewBox="0 0 12 12" className={cn("h-3 w-3 transition", more && "rotate-180")}><path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
        </div>
        <div id="admin-more" className={cn(more ? "grid" : "hidden", "grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-edge bg-white p-3 sm:grid-cols-3")}>
              {rest.map((s) => (
                <div key={s.title} className="grid content-start gap-0.5">
                  <p className="eyebrow pb-1">{s.title}</p>
                  {s.links.map((l) => {
                    const on = isOn(pathname, l);
                    return (
                      <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} className={cn("flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-[15px] font-semibold text-ink no-underline", on && "bg-wall ring-1 ring-line")}>
                        {l.label}
                        <Badge n={counts[l.href]} />
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
      </nav>

      {/* desktop sidebar */}
      <nav aria-label="Admin" className="sticky top-[76px] hidden max-h-[calc(100svh-96px)] content-start gap-3 overflow-y-auto lg:grid">
        {sections.map((s) => (
          <div key={s.title} className="grid gap-0.5">
            <p className="eyebrow px-3 pb-1">{s.title}</p>
            {s.links.map((l) => {
              const on = isOn(pathname, l);
              return (
                <Link
                  key={l.href} href={l.href} aria-current={on ? "page" : undefined}
                  className={cn("flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[15px] font-semibold text-ink no-underline transition", on ? "bg-white shadow-[0_1px_0_var(--af-line)] ring-1 ring-line" : "hover:bg-white/70")}
                >
                  <span className="paint-dab" style={{ ["--dab" as string]: on ? l.dab : "var(--af-edge)" }} />
                  {l.label}
                  <Badge n={counts[l.href]} />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
