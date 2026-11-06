import Link from "next/link";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import ExportCsvButton from "@/components/money/ExportCsvButton";
import { UrlPicker } from "@/components/money/SortSelect";
import { prisma } from "@/lib/prisma";
import HelpLink from "@/components/help/HelpLink";
import ViewsChart from "@/components/studio/ViewsChart";
import { conversion, getArtistAnalytics, parseRange, RANGES } from "@/lib/analytics";
import { sourceLabel } from "@/lib/pageviews";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

const n = (v: number) => v.toLocaleString("en-US");
const DAB: Record<string, string> = {
  qr: "#2b37f0", instagram: "#c13584", tiktok: "#15161b", facebook: "#1877f2", pinterest: "#e60023",
  email: "#0f7a55", search: "#ffd43b", share: "#ff5a36", embed: "#9aa0ff", direct: "#5a5d6b",
};
const DEVICE: Record<string, string> = { mobile: "Phone", desktop: "Computer", tablet: "Tablet", unknown: "Unknown" };
const SRC_SORTS = [{ value: "views", label: "Most views" }, { value: "visitors", label: "Most visitors" }, { value: "sales", label: "Most sales" }];
const ART_SORTS = [{ value: "views", label: "Most views" }, { value: "scans", label: "Most scans" }, { value: "sales", label: "Most sales" }];
const SOURCES_SHOWN = 6;

export default async function AnalyticsPage({ searchParams }: { searchParams: { range?: string; src?: string; art?: string } }) {
  const artist = await requireArtist("/studio/analytics");
  const range = parseRange(searchParams.range);
  const [a, artCount] = await Promise.all([getArtistAnalytics(artist.id, range), prisma.artwork.count({ where: { artistId: artist.id } })]);
  const longer = range < 90 ? `/studio/analytics?range=90` : null;
  const win = `last ${range} days`;
  const maxSource = Math.max(1, ...a.sources.map((s) => s.views));
  const deviceTotal = a.devices.reduce((s, d) => s + d.views, 0) || 1;
  const otherSales = a.sales - a.qrSales;
  const srcSort = (SRC_SORTS.some((o) => o.value === searchParams.src) ? searchParams.src : "views") as "views" | "visitors" | "sales";
  const artSort = (ART_SORTS.some((o) => o.value === searchParams.art) ? searchParams.art : "views") as "views" | "scans" | "sales";
  const sources = a.sources.slice().sort((x, y) => (y[srcSort] ?? -1) - (x[srcSort] ?? -1) || y.views - x.views);
  const artworks = a.artworks.slice().sort((x, y) => y[artSort] - x[artSort] || y.views - x.views);

  return (
    <StudioPage
      title="Analytics"
      actions={
        <>
          <HelpLink href="/help/growing/analytics" />
          {a.everViewed && <ExportCsvButton href={`/api/studio/analytics?range=${range}`} />}
        </>
      }
    >
      {a.everViewed && (
      <nav aria-label="Time range" className="flex gap-1.5">
        {RANGES.map((r) => {
          const on = r === range;
          return (
            <Link key={r} href={r === 30 ? "/studio/analytics" : `/studio/analytics?range=${r}`} aria-current={on ? "page" : undefined} scroll={false}
              className={`rounded-full border-2 px-3.5 py-1.5 text-[13.5px] font-semibold no-underline ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>
              {r} days
            </Link>
          );
        })}
      </nav>
      )}

      {a.everViewed && (
      <section aria-label={`Totals, ${win}`} className="af-card grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-5 sm:p-5">
        <Stat label="Page views" value={n(a.views)} />
        <Stat label="Visitors" value={n(a.visitors)} />
        <Stat label="Scans" value={n(a.scans)} />
        <Stat label="Sales" value={n(a.sales)} />
        <Stat label="Visitors who bought" value={conversion(a.sales, a.visitors)} earned />
      </section>
      )}
      {a.everViewed && !a.views && !a.scans && (
        <EmptyState
          compact
          title={`No visits in the ${win}`}
          body="Try a longer range, or share your page again."
          action={longer ? { label: "See 90 days", href: longer } : { label: "Open Share kit", href: "/studio/share" }}
          secondary={longer ? { label: "Open Share kit", href: "/studio/share" } : { label: "Print a QR code", href: "/studio/qr" }}
        />
      )}

      {!a.everViewed ? (
        artCount === 0 ? (
          <EmptyState
            title="No views yet"
            body="Visits, scans and top pieces show up here. Add a piece first."
            action={{ label: "Add your first piece", href: "/studio/art/new" }}
            secondary={{ label: "Share your page", href: "/studio/share" }}
            help={{ label: "How analytics work", href: "/help/growing/analytics" }}
          />
        ) : (
          <EmptyState
            title="No views yet"
            body="Share your page or hang a code. Visits show up within minutes."
            action={{ label: "Open Share kit", href: "/studio/share" }}
            secondary={{ label: "Print a QR code", href: "/studio/qr" }}
            help={{ label: "How analytics work", href: "/help/growing/analytics" }}
          />
        )
      ) : (
        <>
          {a.views > 0 && (
          <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="views-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="views-h" className="t-card">Views by day</h2>
              <span className="num text-[13px] text-ink-2">{n(a.views)} in {range} days</span>
            </div>
            <ViewsChart days={a.days} />
          </section>
          )}

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section className="af-card min-w-0 p-4 sm:p-5" aria-labelledby="sources-h">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 id="sources-h" className="t-card">Where visitors came from</h2>
                {a.sources.length > 1 && <UrlPicker param="src" label="Sort sources" value={srcSort} options={SRC_SORTS} storageKey="af:analytics:src" />}
              </div>
              {sources.length === 0 ? (
                <p className="text-[14px] text-ink-2">No visits in this range.{longer && <> <Link href={longer} className="font-semibold text-scan underline-offset-2 hover:underline">See 90 days</Link></>}</p>
              ) : (
                <table className="num w-full border-collapse text-[14px]">
                  <thead>
                    <tr className="text-left text-[12px] text-ink-2">
                      <th className="pb-2 font-semibold">Source</th>
                      <th className="pb-2 pl-3 text-right font-semibold">Views</th>
                      <th className="pb-2 pl-3 text-right font-semibold">Visitors</th>
                      <th className="pb-2 pl-3 text-right font-semibold">Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.slice(0, SOURCES_SHOWN).map((s) => (
                      <tr key={s.source} className="border-t border-line">
                        <td className="w-full py-2.5 pr-3">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <i className="paint-dab shrink-0" style={{ ["--dab" as string]: DAB[s.source] || "#c98a5a" }} />
                            <span className="min-w-0 flex-1">
                              <b className="block truncate font-semibold">{sourceLabel(s.source)}</b>
                              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-wall" aria-hidden="true">
                                <span className="block h-full rounded-full bg-scan" style={{ width: `${Math.max(3, (s.views / maxSource) * 100)}%` }} />
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="py-2.5 pl-2 text-right">{n(s.views)}</td>
                        <td className="py-2.5 pl-2 text-right">{n(s.visitors)}</td>
                        <td className="py-2.5 pl-2 text-right">{s.sales === null ? <span className="text-ink-2" aria-label="not tracked">–</span> : <b className="text-earned">{n(s.sales)}</b>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-3 text-[13px] text-ink-2">
                Sales are counted for QR codes only.{otherSales > 0 ? ` ${n(otherSales)} more came in without a code.` : ""}
              </p>
              {sources.length > SOURCES_SHOWN && (
                <details className="group mt-2">
                  <summary className="inline-flex min-h-[40px] cursor-pointer list-none items-center text-[14px] font-bold text-scan [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Show {sources.length - SOURCES_SHOWN} more</span><span className="hidden group-open:inline">Show fewer</span>
                  </summary>
                  <ul className="num grid text-[14px]">
                    {sources.slice(SOURCES_SHOWN).map((s) => (
                      <li key={s.source} className="flex items-center gap-3 border-t border-line py-2">
                        <i className="paint-dab shrink-0" style={{ ["--dab" as string]: DAB[s.source] || "#c98a5a" }} aria-hidden="true" />
                        <b className="min-w-0 flex-1 truncate font-semibold">{sourceLabel(s.source)}</b>
                        <span className="text-ink-2">{n(s.views)} views · {n(s.visitors)} visitors</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>

            <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="devices-h">
              <h2 id="devices-h" className="t-card">Devices</h2>
              {a.devices.length === 0 ? (
                <p className="text-[14px] text-ink-2">No visits in this range.{longer && <> <Link href={longer} className="font-semibold text-scan underline-offset-2 hover:underline">See 90 days</Link></>}</p>
              ) : (
                <ul className="grid gap-3.5">
                  {a.devices.map((d) => {
                    const pct = Math.round((d.views / deviceTotal) * 100);
                    return (
                      <li key={d.device} className="grid gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-[15px]">
                          <b>{DEVICE[d.device] || d.device}</b>
                          <span className="num text-ink-2"><b className="text-ink">{pct}%</b> · {n(d.views)}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-wall" aria-hidden="true">
                          <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <section className="af-card min-w-0 p-4 sm:p-5" aria-labelledby="art-h">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 id="art-h" className="t-card">Top artworks</h2>
              {a.artworks.length > 1 && <UrlPicker param="art" label="Sort artworks" value={artSort} options={ART_SORTS} storageKey="af:analytics:art" />}
            </div>
            {artworks.length === 0 ? (
              <p className="text-[14px] text-ink-2">
                Views of single pieces show up here when someone opens one.{" "}
                <Link href={artCount ? "/studio/qr" : "/studio/art/new"} className="font-semibold text-scan underline-offset-2 hover:underline">{artCount ? "Print a code for a piece" : "Add your first piece"}</Link>
              </p>
            ) : (
              <table className="num w-full border-collapse text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] text-ink-2">
                    <th className="pb-2 font-semibold">Piece</th>
                    <th className="pb-2 pl-3 text-right font-semibold">Views</th>
                    <th className="pb-2 pl-3 text-right font-semibold">Scans</th>
                    <th className="pb-2 pl-3 text-right font-semibold">Sales</th>
                    <th className="hidden pb-2 pl-3 text-right font-semibold sm:table-cell"><abbr title="Sales ÷ visitors" className="no-underline">Bought</abbr></th>
                  </tr>
                </thead>
                <tbody>
                  {artworks.slice(0, 10).map((w) => (
                    <tr key={w.id} className="border-t border-line">
                      <td className="w-full max-w-0 py-2 pr-2">
                        <span className="flex min-w-0 items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {w.imageUrl && <img src={w.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-[3px] object-cover sm:h-10 sm:w-10" />}
                          {w.slug ? (
                            <Link href={`/studio/art/${w.slug}`} className="truncate font-semibold text-ink underline-offset-2 hover:underline">{w.title}</Link>
                          ) : (
                            <b className="truncate font-semibold">{w.title}</b>
                          )}
                        </span>
                      </td>
                      <td className="py-2 pl-2 text-right">{n(w.views)}</td>
                      <td className="py-2 pl-2 text-right">{n(w.scans)}</td>
                      <td className="py-2 pl-2 text-right">{w.sales ? <b className="text-earned">{n(w.sales)}</b> : "0"}</td>
                      <td className="hidden py-2 pl-2 text-right sm:table-cell">{conversion(w.sales, w.visitors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="text-[13px] text-ink-2">
            One visit per person per page every 30 minutes. Your own visits, bots and do-not-track visitors don&apos;t count.
          </p>
        </>
      )}
    </StudioPage>
  );
}

function Stat({ label, value, earned = false }: { label: string; value: string; earned?: boolean }) {
  return (
    <div className="grid min-w-0 gap-0.5 last:col-span-2 sm:last:col-span-1">
      <span className="truncate text-[13px] text-ink-2">{label}</span>
      <b className={`display num truncate text-[26px] leading-tight sm:text-[30px] ${earned ? "text-earned" : ""}`}>{value}</b>
    </div>
  );
}
