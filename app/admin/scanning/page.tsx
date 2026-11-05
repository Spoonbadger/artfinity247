import type { Metadata } from "next";
import Link from "next/link";
import { adminRoleOrRedirect } from "../_components/gate";
import { prisma } from "@/lib/prisma";
import { readScanSettings } from "@/lib/scanning.server";
import { HANDOFF_LABEL, SCAN_STATUSES, STATUS_DAB, STATUS_LABEL, dayLabel, estimate, estimateText, isItemBand, isScanStatus, usd, type ItemBand, type ScanStatus } from "@/lib/scanning";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scanning" };

const DAY = 86400000;
const FILTERS = ["open", ...SCAN_STATUSES, "all"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = { open: "Open", all: "All", ...Object.fromEntries(SCAN_STATUSES.map((s) => [s, STATUS_LABEL[s].split(" ·")[0]])) } as Record<Filter, string>;
const OPEN: ScanStatus[] = ["requested", "confirmed", "paid", "scanning", "delivered"];
const nyDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export default async function AdminScanningPage({ searchParams }: { searchParams: { status?: string } }) {
  await adminRoleOrRedirect("/admin/scanning");
  const filter: Filter = (FILTERS as readonly string[]).includes(searchParams.status ?? "") ? (searchParams.status as Filter) : "open";
  const where = filter === "all" ? {} : filter === "open" ? { status: { in: OPEN } } : isScanStatus(filter) ? { status: filter } : {};
  const [s, rows, counts, waitlist] = await Promise.all([
    readScanSettings(),
    prisma.scanBooking.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 200, include: { items: { select: { band: true, artworkId: true, scanUrl: true } } } }),
    prisma.scanBooking.groupBy({ by: ["status"], _count: true }),
    prisma.scanWaitlist.count(),
  ]);
  const artists = await prisma.artist.findMany({ where: { id: { in: Array.from(new Set(rows.map((r) => r.artistId))) } }, select: { id: true, name: true, artist_name: true, slug: true } });
  const who = new Map(artists.map((a) => [a.id, a.artist_name || a.name]));
  const countOf = (f: Filter) => (f === "all" ? counts.reduce((n, c) => n + c._count, 0) : f === "open" ? counts.filter((c) => (OPEN as string[]).includes(c.status)).reduce((n, c) => n + c._count, 0) : counts.find((c) => c.status === f)?._count ?? 0);

  // Calendar: the next 3 weeks from this week's Monday, with confirmed dates and (lighter) the dates new requests asked for.
  const today = new Date();
  const monday = new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY);
  const days = Array.from({ length: 21 }, (_, i) => nyDay(new Date(monday.getTime() + i * DAY)));
  const calendarRows = await prisma.scanBooking.findMany({
    where: { OR: [{ scheduledFor: { gte: new Date(monday.getTime() - DAY), lte: new Date(monday.getTime() + 22 * DAY) }, status: { in: OPEN } }, { status: "requested" }] },
    select: { id: true, artistId: true, status: true, handoff: true, scheduledFor: true, preferredDates: true, _count: { select: { items: true } } },
  });
  const calArtists = await prisma.artist.findMany({ where: { id: { in: Array.from(new Set(calendarRows.map((r) => r.artistId))) } }, select: { id: true, name: true, artist_name: true } });
  const calWho = new Map(calArtists.map((a) => [a.id, a.artist_name || a.name]));
  const byDay = new Map<string, { id: string; label: string; status: string; asked: boolean; handoff: string }[]>();
  for (const r of calendarRows) {
    const label = `${calWho.get(r.artistId) ?? "Artist"} · ${r._count.items}`;
    if (r.scheduledFor && r.status !== "requested") {
      const k = nyDay(r.scheduledFor);
      byDay.set(k, [...(byDay.get(k) ?? []), { id: r.id, label, status: r.status, asked: false, handoff: r.handoff }]);
    } else {
      for (const d of r.preferredDates) byDay.set(d, [...(byDay.get(d) ?? []), { id: r.id, label, status: r.status, asked: true, handoff: r.handoff }]);
    }
  }
  const todayKey = nyDay(today);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Painting scans · NYC</p>
          <h1 className="display text-[44px] sm:text-[56px]">Scanning</h1>
          <p className="mt-1 max-w-[62ch] text-[14.5px] text-ink-2">
            Artists book, you confirm a date and price, they pay, you scan and put the files on their artworks. The service is{" "}
            <b className={s.enabled ? "text-earned" : "text-coral"}>{s.enabled ? "on" : "off"}</b>{s.enabled ? "" : ` (Studio and /scanning show the waitlist: ${waitlist} signed up)`}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/scanning" className="btn btn-ghost btn-sm">Public page</Link>
          <Link href="/admin/settings/scanning" className="btn btn-ghost btn-sm">Settings</Link>
        </div>
      </div>

      <section aria-labelledby="cal-h" className="af-card grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="cal-h" className="text-[19px] font-bold">Next 3 weeks</h2>
          <span className="flex flex-wrap gap-3 text-[12.5px] text-ink-2">
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-scan" aria-hidden="true" />Booked date</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-dashed border-ink-2" aria-hidden="true" />Asked for (not confirmed)</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7 gap-1.5">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d} className="px-1 text-[12px] font-semibold text-ink-2">{d}</span>)}
            {days.map((d) => {
              const list = byDay.get(d) ?? [];
              return (
                <div key={d} className={cn("grid min-h-[86px] content-start gap-1 rounded-lg border p-1.5", d === todayKey ? "border-ink bg-white" : "border-line bg-wall/60", d < todayKey && "opacity-60")}>
                  <span className="num text-[12px] font-bold">{dayLabel(d, { month: "short", day: "numeric" })}</span>
                  {list.map((e) => (
                    <Link
                      key={`${e.id}-${e.asked}`} href={`/admin/scanning/${e.id}`}
                      className={cn("truncate rounded px-1.5 py-0.5 text-[11.5px] font-semibold no-underline", e.asked ? "border border-dashed border-ink-2 text-ink" : "bg-scan text-white")}
                      title={`${e.label} · ${HANDOFF_LABEL[e.handoff as "dropoff" | "pickup"] ?? e.handoff} · ${STATUS_LABEL[e.status as ScanStatus] ?? e.status}`}
                    >
                      {e.handoff === "pickup" ? "⇢ " : ""}{e.label}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <nav aria-label="Filter bookings" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f} href={f === "open" ? "/admin/scanning" : `/admin/scanning?status=${f}`} aria-current={filter === f ? "page" : undefined}
            className={cn("flex min-h-[36px] items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[13.5px] font-semibold no-underline", filter === f ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}>
            {FILTER_LABEL[f]}<span className={cn("num text-[12px]", filter === f ? "text-white/80" : "text-ink-2")}>{countOf(f)}</span>
          </Link>
        ))}
      </nav>

      <section aria-labelledby="list-h" className="af-card overflow-x-auto">
        <h2 id="list-h" className="sr-only">Bookings</h2>
        {rows.length ? (
          <table className="w-full min-w-[820px] text-left text-[14px]">
            <caption className="sr-only">Scan bookings, {FILTER_LABEL[filter]}</caption>
            <thead className="border-b border-line text-[12px] text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Artist</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Paintings</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Handoff</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Date</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Price</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Booked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = r.status as ScanStatus;
                const live = estimate(r.items.map((i) => ({ band: (isItemBand(i.band) ? i.band : "oversized") as ItemBand })), r.handoff === "pickup" ? "pickup" : "dropoff", s);
                const done = r.items.filter((i) => i.scanUrl).length;
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-wall/60">
                    <td className="px-4 py-3"><Link href={`/admin/scanning/${r.id}`} className="font-bold text-ink underline-offset-2 hover:underline">{who.get(r.artistId) ?? "Unknown artist"}</Link></td>
                    <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold"><i className="paint-dab !h-2.5 !w-2.5" style={{ ["--dab" as string]: STATUS_DAB[st] }} aria-hidden="true" />{STATUS_LABEL[st] ?? r.status}</span></td>
                    <td className="num px-3 py-3 text-right">{r.items.length}{(st === "scanning" || st === "paid" || st === "delivered") && <span className="block text-[12px] text-ink-2">{done} scanned</span>}</td>
                    <td className="px-3 py-3">{HANDOFF_LABEL[r.handoff as "dropoff" | "pickup"] ?? r.handoff}</td>
                    <td className="px-3 py-3">{r.scheduledFor ? dayLabel(r.scheduledFor) : <span className="text-ink-2">asked {r.preferredDates.map((d) => dayLabel(d, { month: "short", day: "numeric" })).join(", ") || "—"}</span>}</td>
                    <td className="num px-3 py-3 text-right">{r.priceCents != null ? usd(r.priceCents) : <span className="text-ink-2">est. {estimateText(live)}</span>}</td>
                    <td className="num px-4 py-3 text-right text-ink-2">{dayLabel(r.createdAt, { month: "short", day: "numeric" })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="grid justify-items-start gap-2 p-5">
            <p className="text-[15px] font-semibold">No {filter === "all" ? "" : `${FILTER_LABEL[filter].toLowerCase()} `}bookings.</p>
            <p className="text-[14px] text-ink-2">{s.enabled ? "Artists book from Studio → Art → Painting scans, or from the “Book a scan” fix when a file is too small." : "The service is off, so artists see the waitlist. Turn it on in Settings when you're ready."}</p>
            <div className="flex flex-wrap gap-2">
              {filter !== "all" && <Link href="/admin/scanning?status=all" className="btn btn-ghost btn-sm">See all bookings</Link>}
              <Link href="/admin/settings/scanning" className="btn btn-ghost btn-sm">Scanning settings</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
