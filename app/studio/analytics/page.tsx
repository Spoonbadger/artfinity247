import Link from "next/link";
import { Download } from "lucide-react";
import { PaintChip } from "@/components/af/Brush";
import { StudioPage } from "@/components/studio/StudioPage";
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

export default async function AnalyticsPage({ searchParams }: { searchParams: { range?: string } }) {
  const artist = await requireArtist("/studio/analytics");
  const range = parseRange(searchParams.range);
  const a = await getArtistAnalytics(artist.id, range);
  const win = `last ${range} days`;
  const maxSource = Math.max(1, ...a.sources.map((s) => s.views));
  const deviceTotal = a.devices.reduce((s, d) => s + d.views, 0) || 1;
  const otherSales = a.sales - a.qrSales;

  return (
    <StudioPage
      title="Analytics"
      sub="Which walls and posts bring people in, and what they buy."
      actions={
        <a href={`/api/studio/analytics?range=${range}`} className="btn btn-ghost" download>
          <Download className="h-4 w-4" aria-hidden="true" />Export CSV
        </a>
      }
    >
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

      <section aria-label={`Totals, ${win}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        <PaintChip color="#2b37f0" value={n(a.views)} label="page views" note={win} />
        <PaintChip color="#5bc0be" value={n(a.visitors)} label="visitors" note={win} />
        <PaintChip color="#ffd43b" value={n(a.scans)} label="scans" note={win} />
        <PaintChip color="#e8743b" value={n(a.sales)} label="sales" note={win} />
        <div className="col-span-2 grid sm:col-span-1">
          <PaintChip color="#0f7a55" value={conversion(a.sales, a.visitors)} label="of visitors bought" note={win} earned />
        </div>
      </section>

      {!a.everViewed ? (
        <div className="grid justify-items-center gap-4 rounded-[4px] border-2 border-dashed border-line bg-wall px-6 py-16 text-center">
          <h2 className="display text-[34px]">No views yet.</h2>
          <p className="text-ink-2">Share your page and views show up here.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/studio/share" className="btn btn-blue">Share kit</Link>
            <Link href="/studio/qr" className="btn btn-ghost">Print codes</Link>
          </div>
        </div>
      ) : (
        <>
          <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="views-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="views-h" className="text-[20px] font-bold">Views by day</h2>
              <span className="num text-[12.5px] text-ink-2">{n(a.views)} in {range} days</span>
            </div>
            <ViewsChart days={a.days} />
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section className="af-card min-w-0 p-4 sm:p-5" aria-labelledby="sources-h">
              <h2 id="sources-h" className="mb-2 text-[20px] font-bold">Where visitors came from</h2>
              {a.sources.length === 0 ? (
                <p className="text-[14px] text-ink-2">No visits in this range.</p>
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
                    {a.sources.map((s) => (
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
              <p className="mt-3 text-[12.5px] text-ink-2">
                Sales are counted for QR codes only.{otherSales > 0 ? ` ${n(otherSales)} other ${otherSales === 1 ? "sale" : "sales"} came in without a code.` : ""}
              </p>
            </section>

            <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="devices-h">
              <h2 id="devices-h" className="text-[20px] font-bold">Devices</h2>
              {a.devices.length === 0 ? (
                <p className="text-[14px] text-ink-2">No visits in this range.</p>
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
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 id="art-h" className="text-[20px] font-bold">Top artworks</h2>
              <span className="text-[12.5px] text-ink-2">{win}</span>
            </div>
            {a.artworks.length === 0 ? (
              <p className="text-[14px] text-ink-2">Views of single pieces show up here.</p>
            ) : (
              <table className="num w-full border-collapse text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] text-ink-2">
                    <th className="pb-2 font-semibold">Piece</th>
                    <th className="pb-2 pl-3 text-right font-semibold">Views</th>
                    <th className="pb-2 pl-3 text-right font-semibold">Sales</th>
                    <th className="pb-2 pl-3 text-right font-semibold"><abbr title="Sales ÷ visitors" className="no-underline">Bought</abbr></th>
                  </tr>
                </thead>
                <tbody>
                  {a.artworks.slice(0, 10).map((w) => (
                    <tr key={w.id} className="border-t border-line">
                      <td className="min-w-0 py-2 pr-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {w.imageUrl && <img src={w.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-[3px] object-cover" />}
                          {w.slug ? (
                            <Link href={`/studio/art/${w.slug}`} className="truncate font-semibold text-ink underline-offset-2 hover:underline">{w.title}</Link>
                          ) : (
                            <b className="truncate font-semibold">{w.title}</b>
                          )}
                        </span>
                      </td>
                      <td className="py-2 pl-2 text-right">{n(w.views)}</td>
                      <td className="py-2 pl-2 text-right">{w.sales ? <b className="text-earned">{n(w.sales)}</b> : "0"}</td>
                      <td className="py-2 pl-2 text-right">{conversion(w.sales, w.visitors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="text-[12.5px] text-ink-2">
            Visitors are counted once per page every 30 minutes. Your own visits, bots and people who ask not to be tracked are left out.
          </p>
        </>
      )}
    </StudioPage>
  );
}
