import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminRoleOrRedirect } from "../../../_components/gate";
import ActionButton from "../../../_components/ActionButton";
import MonthPicker from "../../../_components/MonthPicker";
import { currentMonth, usd } from "../../../_components/util";
import PrintButton from "../../_components/PrintButton";
import { isMonth, monthLabel, pctLabel, venueReport, venueStatement } from "@/lib/venues";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Venue statement" };

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function VenueStatementPage({ params, searchParams }: { params: { id: string }; searchParams: { month?: string } }) {
  await adminRoleOrRedirect(`/admin/venues/${params.id}`);
  const report = await venueReport(params.id);
  if (!report) notFound();
  const months = Array.from(new Set([...report.months.map((m) => m.month), currentMonth()])).sort().reverse();
  const month = isMonth(searchParams.month) ? searchParams.month : months[0];
  const s = await venueStatement(params.id, month);
  if (!s) notFound();
  const { venue: v, lines, totals: t } = s;
  const label = monthLabel(month);

  return (
    <div className="grid gap-5">
      <style dangerouslySetInnerHTML={{ __html: `@media print { header, nav[aria-label="Admin"], .no-print { display: none !important; } main { padding: 0 !important; } .af-card { box-shadow: none !important; } }` }} />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <Link href={`/admin/venues/${v.id}`} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-ink-2 no-underline hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{v.name}</Link>
        <div className="flex flex-wrap items-end gap-2">
          <MonthPicker months={months} value={month} allowAll={false} />
          <a href={`/api/admin/venues/${v.id}/statement?month=${month}`} className="btn btn-ghost btn-sm mb-1">CSV</a>
          <PrintButton className="btn btn-ghost btn-sm mb-1" />
          <ActionButton
            url={`/api/admin/venues/${v.id}/statement`} body={{ month }} need="money" tone="blue" label="Email statement to venue" title={`Email the ${label} statement`}
            className="mb-1" disabled={!v.contactEmail}
            confirm={v.contactEmail ? <>Sends this statement to <b>{v.contactEmail}</b>.</> : "Add a contact email on the venue page first."}
            confirmLabel="Send statement"
          />
        </div>
      </div>

      <article className="af-card grid gap-5 p-5 sm:p-8" aria-labelledby="st-h">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="eyebrow">Artfinity venue statement</p>
            <h1 id="st-h" className="display text-[36px] sm:text-[44px]">{v.name}</h1>
            <p className="text-[14px] text-ink-2">{[v.neighborhood, v.address].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right text-[14px]">
            <b className="block text-[18px]">{label}</b>
            <span className="text-ink-2">Share: {pctLabel(v.sharePct)} of Artfinity&apos;s profit</span>
            {v.contactName && <span className="block text-ink-2">Attn: {v.contactName}</span>}
          </div>
        </header>

        {lines.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-[14px]">
              <caption className="sr-only">Sales from codes at {v.name} in {label}</caption>
              <thead className="border-b border-line text-[12px] text-ink-2">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Artwork</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Code</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Sale</th>
                  <th scope="col" className="py-2 text-right font-semibold">Artfinity profit</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className={`border-b border-line last:border-0 ${l.refunded ? "text-ink-2" : ""}`}>
                    <td className="py-2 pr-3">{day(l.date)}</td>
                    <td className="py-2 pr-3">{l.title}{l.artist ? <span className="text-ink-2"> · {l.artist}</span> : null}{l.quantity > 1 ? ` ×${l.quantity}` : ""}{l.refunded && <b className="ml-2 text-[12px] text-coral">Refunded</b>}</td>
                    <td className="num py-2 pr-3">{l.code}</td>
                    <td className="num py-2 pr-3 text-right">{l.refunded ? <s>{usd(l.grossCents)}</s> : usd(l.grossCents)}</td>
                    <td className="num py-2 text-right">{usd(l.artfinityCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[14.5px] text-ink-2">No sales from codes at {v.name} in {label}.</p>
        )}

        <dl className="ml-auto grid w-full max-w-[380px] grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-[14.5px]">
          <dt>Sales ({t.sales})</dt><dd className="num text-right">{usd(t.grossCents)}</dd>
          {t.refundedLines > 0 && (<><dt className="text-ink-2">Refunded, left out ({t.refundedLines})</dt><dd className="num text-right text-ink-2">{usd(t.refundedCents)}</dd></>)}
          <dt>Artfinity profit</dt><dd className="num text-right">{usd(t.artfinityCents)}</dd>
          <dt className="border-t border-line pt-1.5 font-bold">Venue share ({pctLabel(v.sharePct)})</dt><dd className="num border-t border-line pt-1.5 text-right font-bold text-earned">{usd(t.owedCents)}</dd>
          <dt className="text-ink-2">Status</dt><dd className="text-right text-ink-2">{t.paid ? `Paid ${usd(t.paid.amountCents)}` : t.owedCents > 0 ? "Unpaid" : "Nothing owed"}</dd>
        </dl>
        <p className="text-[12.5px] text-ink-2">Artfinity profit is the sale price minus printing, payment fees and the artist&apos;s share. Months run on UTC dates.</p>
      </article>
    </div>
  );
}
