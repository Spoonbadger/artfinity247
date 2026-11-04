import Link from "next/link";
import { Download } from "lucide-react";
import { PaintChip } from "@/components/af/Brush";
import { StudioPage } from "@/components/studio/StudioPage";
import { money } from "@/lib/earnings";
import { requireArtist, getSales, SIZE_LABEL, STUDIO_TZ } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales" };

const monthKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit" });
const monthName = (d: Date) => d.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "long", year: "numeric" });
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "short", day: "numeric", year: "numeric" });

export default async function SalesPage() {
  const artist = await requireArtist("/studio/sales");
  const sales = await getSales(artist.id);

  const months: { key: string; name: string; prints: number; gross: number; share: number }[] = [];
  for (const s of sales) {
    const k = monthKey(s.date);
    let m = months.find((x) => x.key === k);
    if (!m) { m = { key: k, name: monthName(s.date), prints: 0, gross: 0, share: 0 }; months.push(m); }
    m.prints += s.quantity;
    m.gross += s.priceCents;
    m.share += s.shareCents;
  }
  const maxShare = Math.max(1, ...months.map((m) => m.share));
  const total = sales.reduce((n, s) => n + s.shareCents, 0);
  const prints = sales.reduce((n, s) => n + s.quantity, 0);
  const thisMonth = months.find((m) => m.key === monthKey(new Date()));

  return (
    <StudioPage
      title="Sales"
      sub="You get 60% of profit on orders from Oct 21, 2026. 50% before that."
      actions={
        <a href="/api/my-sales/export" className="btn btn-ghost" download>
          <Download className="h-4 w-4" aria-hidden="true" />Export CSV
        </a>
      }
    >
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <PaintChip color="#0f7a55" value={money(total)} label="earned, all time" note="Viridian" earned />
        <PaintChip color="#0f7a55" value={money(thisMonth?.share || 0)} label="earned this month" note={new Date().toLocaleDateString("en-US", { month: "long", timeZone: STUDIO_TZ })} earned />
        <PaintChip color="#e8743b" value={prints.toLocaleString("en-US")} label="prints sold" note="Cadmium" />
        <PaintChip color="#15161b" value={sales.length.toLocaleString("en-US")} label="orders" note="Ivory black" />
      </section>

      {sales.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-[4px] border-2 border-dashed border-line bg-wall px-6 py-16 text-center">
          <h2 className="display text-[34px]">No sales yet.</h2>
          <p className="text-ink-2">Hang a code where people linger.</p>
          <Link href="/studio/qr" className="btn btn-blue">Print codes</Link>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <section className="af-card grid gap-3 p-4 sm:p-5" aria-labelledby="months-h">
            <h2 id="months-h" className="text-[20px] font-bold">By month</h2>
            <ul className="grid gap-4">
              {months.map((m) => (
                <li key={m.key} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="text-[15px]">{m.name}</b>
                    <b className="num text-[17px] text-earned">{money(m.share)}</b>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-wall" aria-hidden="true">
                    <div className="h-full rounded-full bg-earned" style={{ width: `${Math.max(4, (m.share / maxShare) * 100)}%` }} />
                  </div>
                  <span className="num text-[12.5px] text-ink-2">{m.prints} {m.prints === 1 ? "print" : "prints"} · {money(m.gross)} in sales</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="af-card min-w-0 p-4 sm:p-5" aria-labelledby="orders-h">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 id="orders-h" className="text-[20px] font-bold">Orders</h2>
              <span className="num text-[12.5px] text-ink-2">{sales.length}</span>
            </div>
            <table className="num w-full border-collapse text-[14px]">
              <thead className="sr-only sm:not-sr-only">
                <tr className="text-left text-[12px] text-ink-2">
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold">Piece</th>
                  <th className="pb-2 font-semibold">Size</th>
                  <th className="pb-2 text-right font-semibold">Price</th>
                  <th className="pb-2 text-right font-semibold">Your share</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-x-3 border-t border-line py-2.5 sm:table-row sm:py-0">
                    <td className="hidden whitespace-nowrap py-2.5 pr-3 text-ink-2 sm:table-cell">{shortDate(s.date)}</td>
                    <td className="row-span-2 sm:hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {s.imageUrl && <img src={s.imageUrl} alt="" className="h-11 w-11 rounded-[3px] object-cover" />}
                    </td>
                    <td className="min-w-0 sm:py-2.5 sm:pr-3">
                      <span className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {s.imageUrl && <img src={s.imageUrl} alt="" className="hidden h-9 w-9 shrink-0 rounded-[3px] object-cover sm:block" />}
                        <b className="truncate font-semibold">{s.title}</b>
                      </span>
                    </td>
                    <td className="hidden py-2.5 pr-3 sm:table-cell">{SIZE_LABEL[s.size]}{s.framed ? ", framed" : ""}{s.quantity > 1 ? ` ×${s.quantity}` : ""}</td>
                    <td className="hidden py-2.5 pr-3 text-right sm:table-cell">{money(s.priceCents)}</td>
                    <td className="row-span-2 text-right sm:py-2.5">
                      <b className="block text-earned">+{money(s.shareCents)}</b>
                      <span className="text-[11.5px] text-ink-2">{Math.round(s.split * 100)}%</span>
                    </td>
                    <td className="col-start-2 text-[12.5px] text-ink-2 sm:hidden">
                      {shortDate(s.date)} · {SIZE_LABEL[s.size]} · {money(s.priceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </StudioPage>
  );
}
