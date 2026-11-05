import Link from "next/link";
import { Plus } from "lucide-react";
import { PaintChip } from "@/components/af/Brush";
import { StudioPage } from "@/components/studio/StudioPage";
import HelpLink from "@/components/help/HelpLink";
import { requireArtist, usd } from "../_lib/data";
import { getCodes, pct, status, windowTotals, WINDOW_DAYS, type CodeRow } from "./_lib";

export const dynamic = "force-dynamic";
export const metadata = { title: "My codes" };

const DAY = 86400000;
const n = (v: number) => v.toLocaleString("en-US");
const date = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Thumb({ c }: { c: CodeRow }) {
  return c.artwork ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.artwork.imageUrl} alt={c.artwork.title} className="h-14 w-14 shrink-0 rounded-[3px] object-cover shadow-[0_2px_0_var(--af-line)]" />
  ) : (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[3px] bg-wall text-center text-[11px] font-bold leading-tight text-ink-2 shadow-[0_2px_0_var(--af-line)]">Your<br />page</span>
  );
}

function Status({ c }: { c: CodeRow }) {
  const s = status(c);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-bold ${s.on ? "text-ink" : "text-ink-2"}`}>
      <i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: s.on ? "#0f7a55" : "#b9bcc4" }} aria-hidden="true" />
      {s.text}
    </span>
  );
}

function Deal({ c }: { c: CodeRow }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2">
      <b className="text-ink">{c.code}</b>
      {c.venue && <span>· {c.venue}</span>}
      {c.discountPct ? <span className="rounded-full bg-sticker px-2 py-0.5 font-bold text-ink">{c.discountPct}% off</span> : null}
    </span>
  );
}

export default async function CodesPage() {
  const artist = await requireArtist("/studio/codes");
  const now = new Date();
  const codes = await getCodes(artist.id);
  // Every headline tile uses the same window; the table below is all-time per code.
  const win = await windowTotals(codes.map((c) => c.id), new Date(now.getTime() - WINDOW_DAYS * DAY));
  const allScans = codes.reduce((n, c) => n + c.stats.scans, 0);

  return (
    <StudioPage
      title="My codes"
      sub={codes.length ? "Every printed code. Edit any of them, even after printing." : undefined}
      actions={<><HelpLink href="/help/qr-codes/change-after-printing" /><Link href="/studio/qr" className="btn btn-blue btn-sm"><Plus className="h-4 w-4" aria-hidden="true" />Make a code</Link></>}
    >
      {codes.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-[4px] border-2 border-dashed border-line bg-wall px-6 py-16 text-center">
          <h2 className="display text-[34px]">No codes yet.</h2>
          <p className="text-ink-2">Print one and hang it beside your work.</p>
          <Link href="/studio/qr" className="btn btn-blue">Make a code</Link>
        </div>
      ) : (
        <>
          <section aria-labelledby="totals-h" className="grid gap-2">
            <h2 id="totals-h" className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-2">
              Last {WINDOW_DAYS} days
              <span className="num text-[12.5px] font-semibold normal-case tracking-normal">{n(allScans)} scans all time</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <PaintChip color="#2b37f0" value={n(win.scans)} label="scans" note="Ultramarine · every scan" />
              <PaintChip color="#7b2d8e" value={n(win.people)} label="people scanned" note="Dioxazine · unique visitors" />
              <PaintChip color="#e8743b" value={n(win.sales)} label="sales from codes" note={`Cadmium · ${pct(win.sales, win.scans)} of scans`} />
              <PaintChip color="#0f7a55" value={usd(win.shareCents)} label="you earned" note="Viridian · from code sales" earned />
            </div>
          </section>

          {/* Phones: cards */}
          <ul className="grid gap-3 md:hidden" aria-label="Codes">
            {codes.map((c) => (
              <li key={c.id}>
                <Link href={`/studio/codes/${c.code}`} className="af-card grid gap-3 p-4 text-ink no-underline">
                  <div className="flex items-start gap-3">
                    <Thumb c={c} />
                    <div className="grid min-w-0 flex-1 gap-1">
                      <b className="truncate text-[16px]">{c.label || c.artwork?.title || "Your page"}</b>
                      <Deal c={c} />
                    </div>
                    <Status c={c} />
                  </div>
                  <dl className="grid grid-cols-4 gap-2 border-t border-line pt-3 text-center">
                    {([["scans", n(c.stats.scans)], ["7 days", n(c.stats.scans7)], ["sales", n(c.stats.sales)], ["earned", usd(c.stats.shareCents)]] as const).map(([l, v], i) => (
                      <div key={l} className="grid gap-0.5">
                        <dd className={`num text-[16px] font-bold ${i === 3 ? "text-earned" : ""}`}>{v}</dd>
                        <dt className="text-[11.5px] text-ink-2">{l}</dt>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          {/* Wider: a table */}
          <div className="af-card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-left text-[14px]">
              <caption className="sr-only">Your codes and what they did</caption>
              <thead className="border-b border-line text-[12px] text-ink-2">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Code</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Scans</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">7 days</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">People</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Sales</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Revenue</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">You earned</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Converts</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-wall/60">
                    <td className="px-4 py-3">
                      <Link href={`/studio/codes/${c.code}`} className="flex items-center gap-3 text-ink no-underline">
                        <Thumb c={c} />
                        <span className="grid min-w-0 gap-0.5">
                          <b className="max-w-[260px] truncate">{c.label || c.artwork?.title || "Your page"}</b>
                          <Deal c={c} />
                          <span className="text-[12px] text-ink-2">Made {date(c.createdAt)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="num px-3 py-3 text-right font-bold">{n(c.stats.scans)}</td>
                    <td className="num px-3 py-3 text-right">{n(c.stats.scans7)}</td>
                    <td className="num px-3 py-3 text-right">{n(c.stats.visitors)}</td>
                    <td className="num px-3 py-3 text-right">{n(c.stats.sales)}</td>
                    <td className="num px-3 py-3 text-right">{usd(c.stats.revenueCents)}</td>
                    <td className="num px-3 py-3 text-right font-bold text-earned">{usd(c.stats.shareCents)}</td>
                    <td className="num px-3 py-3 text-right">{pct(c.stats.sales, c.stats.scans)}</td>
                    <td className="px-4 py-3"><Status c={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </StudioPage>
  );
}
