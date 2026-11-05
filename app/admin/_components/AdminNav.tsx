"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { roleCan, type AdminRole } from "@/lib/adminCaps";

type NavLink = { href: string; label: string; dab: string; exact?: boolean; owner?: boolean; minRole?: AdminRole };
const SECTIONS: { title: string; links: NavLink[] }[] = [
  { title: "Today", links: [
    { href: "/admin", label: "Dashboard", dab: "var(--af-sticker)", exact: true },
    { href: "/admin/alerts", label: "Alerts", dab: "var(--af-coral)" },
    { href: "/admin/activity", label: "Activity", dab: "#9aa3b5" },
  ] },
  { title: "Catalog", links: [
    { href: "/admin/artworks", label: "Artworks", dab: "#7c8cff" },
    { href: "/admin/moderation", label: "Moderation", dab: "var(--af-coral)" },
    { href: "/admin/scenes", label: "Scenes", dab: "#5bc0be" },
    { href: "/admin/social", label: "Social", dab: "#c13584" },
  ] },
  { title: "Orders", links: [
    { href: "/admin/orders", label: "Orders", dab: "var(--af-scan)" },
    { href: "/admin/reprints", label: "Reprints", dab: "#c98a5a" },
    { href: "/admin/scanning", label: "Scanning", dab: "#2b37f0" },
    { href: "/admin/code-orders", label: "Code orders", dab: "#ffd43b" },
  ] },
  { title: "People", links: [
    { href: "/admin/artists", label: "Artists", dab: "#b98bd9" },
    { href: "/admin/verification", label: "Verification", dab: "var(--af-sticker)" },
    { href: "/admin/reviews", label: "Reviews", dab: "#e3b23c" },
    { href: "/admin/reports", label: "Reports", dab: "var(--af-ink)" },
    { href: "/admin/venues", label: "Venues", dab: "#e8743b" },
  ] },
  { title: "Money", links: [
    { href: "/admin/payouts", label: "Payouts", dab: "var(--af-earned)" },
  ] },
  { title: "Admin", links: [
    { href: "/admin/jobs", label: "Jobs", dab: "#5bc0be", minRole: "admin" },
    { href: "/admin/team", label: "Team", dab: "#7c8cff" },
    { href: "/admin/settings", label: "Settings", dab: "var(--af-ink)", exact: true, owner: true },
    { href: "/admin/settings/notifications", label: "Alert emails", dab: "#9aa3b5" },
    { href: "/admin/settings/rewards", label: "Collector rewards", dab: "#e3b23c" },
    { href: "/admin/settings/scanning", label: "Scanning service", dab: "#2b37f0" },
    { href: "/admin/settings/code-prints", label: "Code print prices", dab: "#ff5a36" },
  ] },
];

const isOn = (pathname: string | null, l: NavLink) => (l.exact ? pathname === l.href : !!pathname?.startsWith(l.href));

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="num ml-auto rounded-full bg-coral px-1.5 text-[12px] font-bold leading-[18px] text-white" aria-label={`${n} open`}>{n}</span>;
}

/** Grouped admin menu: a sidebar on desktop, a scrolling strip on phones. `counts` adds badges by href. */
export default function AdminNav({ counts = {}, role }: { counts?: Record<string, number>; role?: AdminRole }) {
  const pathname = usePathname();
  const sections = SECTIONS.map((s) => ({ ...s, links: s.links.filter((l) => (!l.owner || roleCan(role, "owner")) && (!l.minRole || roleCan(role, l.minRole))) })).filter((s) => s.links.length);
  return (
    <>
      {/* phones and tablets */}
      <nav aria-label="Admin" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:hidden">
        {sections.map((s, si) => (
          <div key={s.title} className="flex shrink-0 items-center gap-1">
            {si > 0 && <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />}
            {s.links.map((l) => {
              const on = isOn(pathname, l);
              return (
                <Link
                  key={l.href} href={l.href} aria-current={on ? "page" : undefined}
                  className={cn("flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 text-[14px] font-semibold no-underline", on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}
                >
                  {l.label}
                  <Badge n={counts[l.href]} />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* desktop sidebar */}
      <nav aria-label="Admin" className="sticky top-[76px] hidden max-h-[calc(100svh-96px)] content-start gap-4 overflow-y-auto lg:grid">
        {sections.map((s) => (
          <div key={s.title} className="grid gap-0.5">
            <p className="eyebrow px-3 pb-1">{s.title}</p>
            {s.links.map((l) => {
              const on = isOn(pathname, l);
              return (
                <Link
                  key={l.href} href={l.href} aria-current={on ? "page" : undefined}
                  className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] font-semibold text-ink no-underline transition", on ? "bg-white shadow-[0_1px_0_var(--af-line)] ring-1 ring-line" : "hover:bg-white/70")}
                >
                  <span className="paint-dab" style={{ ["--dab" as string]: l.dab }} />
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
