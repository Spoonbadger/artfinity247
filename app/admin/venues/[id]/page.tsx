import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { artPath } from "@/lib/urls";
import { adminRoleOrRedirect } from "../../_components/gate";
import ActionButton from "../../_components/ActionButton";
import { usd } from "../../_components/util";
import VenueForm from "../_components/VenueForm";
import { monthLabel, pctLabel, venueReport } from "@/lib/venues";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Venue" };

const n = (v: number) => v.toLocaleString("en-US");
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

export default async function AdminVenuePage({ params }: { params: { id: string } }) {
  await adminRoleOrRedirect(`/admin/venues/${params.id}`);
  const r = await venueReport(params.id);
  if (!r) notFound();
  const { venue: v, codes, months, totals } = r;
  const activity = await prisma.adminAction.findMany({
    where: { targetType: "venue", targetId: v.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, summary: true, adminEmail: true, createdAt: true },
  });
  const share = pctLabel(v.sharePct);

  const tiles: [string, string, boolean?][] = [
    [`${n(totals.liveCodes)}/${n(totals.codes)}`, "codes on"],
    [n(totals.scans), "scans"],
    [n(totals.sales), totals.sales === 1 ? "sale" : "sales"],
    [usd(totals.grossCents), "revenue"],
    [usd(totals.artfinityCents), "Artfinity profit"],
    [usd(totals.unpaidCents), `unpaid share (${share})`, true],
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/venues" className="mb-2 inline-flex items-center gap-1 text-[13.5px] font-semibold text-ink-2 no-underline hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Venues</Link>
          <p className="eyebrow">{[v.neighborhood, v.active ? "Active" : "Paused", `${share} of Artfinity's profit`].filter(Boolean).join(" · ")}</p>
          <h1 className="display text-[40px] sm:text-[52px]">{v.name}</h1>
          {v.address && <p className="text-[14.5px] text-ink-2">{v.address}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {v.active && <a href={`/venues/${v.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Public page<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>}
          <a href={`/admin/venues/${v.id}/kit`} target="_blank" rel="noreferrer" className="btn btn-blue btn-sm"><Printer className="h-4 w-4" aria-hidden="true" />Download venue kit</a>
        </div>
      </div>

      <section aria-label="Totals" className="af-card grid grid-cols-2 gap-x-3 gap-y-4 p-4 sm:grid-cols-3 sm:p-5 xl:grid-cols-6">
        {tiles.map(([val, label, money]) => (
          <div key={label} className="grid min-w-0 gap-0.5">
            <b className={`display num truncate text-[26px] ${money ? "text-earned" : ""}`}>{val}</b>
            <span className="text-[12.5px] text-ink-2">{label}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="months-h" className="af-card overflow-x-auto">
        <div className="grid gap-1 px-4 pt-4">
          <h2 id="months-h" className="text-[19px] font-bold">Venue share by month</h2>
          <p className="text-[13px] text-ink-2">
            {share} of Artfinity&apos;s profit (sale − printing, fees and the artist&apos;s share) on sales from codes hanging here. Refunded lines are left out. Months are UTC, like artist payouts.
          </p>
        </div>
        {months.length ? (
          <table className="mt-2 w-full min-w-[860px] text-left text-[14px]">
            <caption className="sr-only">Venue share owed by month</caption>
            <thead className="border-b border-line text-[12px] text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Month</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Sales</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Revenue</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Refunded</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Artfinity profit</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Share owed</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const label = monthLabel(m.month);
                const drift = m.paid && m.paid.amountCents !== m.owedCents;
                return (
                  <tr key={m.month} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3 font-semibold"><Link href={`/admin/venues/${v.id}/statement?month=${m.month}`} className="text-ink underline-offset-2 hover:underline">{label}</Link></td>
                    <td className="num px-3 py-3 text-right">{n(m.sales)}</td>
                    <td className="num px-3 py-3 text-right">{usd(m.grossCents)}</td>
                    <td className="num px-3 py-3 text-right text-ink-2">{m.refundedLines ? `${m.refundedLines} · ${usd(m.refundedCents)}` : "—"}</td>
                    <td className="num px-3 py-3 text-right">{usd(m.artfinityCents)}</td>
                    <td className="num px-3 py-3 text-right font-bold text-earned">{usd(m.owedCents)}</td>
                    <td className="px-3 py-3 text-[13px]">
                      {m.paid ? (
                        <>
                          <b className="text-earned">Paid {usd(m.paid.amountCents)}</b>
                          <span className="block text-ink-2">{day(m.paid.at)} · {m.paid.adminEmail}</span>
                          {drift && <span className="block font-semibold text-coral">Now {usd(m.owedCents)} (refund or share change since)</span>}
                        </>
                      ) : m.owedCents > 0 ? <span className="font-semibold">Unpaid</span> : <span className="text-ink-2">Nothing owed</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Link href={`/admin/venues/${v.id}/statement?month=${m.month}`} className="btn btn-ghost btn-sm">Statement</Link>
                        <a href={`/api/admin/venues/${v.id}/statement?month=${m.month}`} className="btn btn-ghost btn-sm" aria-label={`CSV for ${label}`}>CSV</a>
                        <ActionButton
                          url={`/api/admin/venues/${v.id}/statement`} body={{ month: m.month }} need="money" label="Email" title={`Email the ${label} statement`}
                          disabled={!v.contactEmail}
                          confirm={v.contactEmail ? <>Sends {v.name}&apos;s {label} statement to <b>{v.contactEmail}</b>.</> : "Add a contact email first."}
                          confirmLabel="Send statement"
                        />
                        {m.paid ? (
                          <ActionButton
                            url={`/api/admin/venues/${v.id}/payout`} body={{ month: m.month, unmark: true }} need="money" tone="danger" label="Unmark" title={`Unmark ${label} as paid`}
                            confirm={<>Clears the {usd(m.paid.amountCents)} payout record for {label}. Only do this if the money didn&apos;t go out.</>}
                            confirmLabel="Unmark paid"
                          />
                        ) : (
                          <ActionButton
                            url={`/api/admin/venues/${v.id}/payout`} body={{ month: m.month }} need="money" tone="blue" label="Mark paid" title={`Mark ${label} paid`}
                            disabled={m.owedCents <= 0}
                            confirm={<>Records <b>{usd(m.owedCents)}</b> paid to {v.name} for {label} in the admin log. Send the money first (Venmo, check, Zelle).</>}
                            fields={[{ name: "note", label: "How it was paid (optional)", placeholder: "Zelle to owner, ref 1234" }]}
                            confirmLabel="Mark paid"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="px-4 pb-4 pt-2 text-[14px] text-ink-2">No sales from codes hanging here yet.</p>
        )}
      </section>

      <section aria-labelledby="codes-h" className="af-card overflow-x-auto">
        <h2 id="codes-h" className="px-4 pt-4 text-[19px] font-bold">Codes hanging here</h2>
        {codes.length ? (
          <table className="mt-2 w-full min-w-[760px] text-left text-[14px]">
            <caption className="sr-only">Codes at {v.name}</caption>
            <thead className="border-b border-line text-[12px] text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Artwork</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Artist</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Code</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Scans</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Sales</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Revenue</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Artfinity profit</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      {c.artwork ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.artwork.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-[3px] object-cover" />
                      ) : (
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[3px] bg-wall text-[10.5px] font-bold leading-tight text-ink-2" aria-hidden="true">Page</span>
                      )}
                      <span className="grid min-w-0">
                        {c.artwork?.slug ? (
                          <a href={artPath(c.artist.slug, c.artwork.slug)} target="_blank" rel="noreferrer" className="truncate font-semibold text-ink underline-offset-2 hover:underline">{c.artwork.title}</a>
                        ) : (
                          <b className="truncate font-semibold">{c.artwork?.title || "Artist page"}</b>
                        )}
                        <span className="truncate text-[12.5px] text-ink-2">{c.label || "—"}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3"><Link href={`/admin/artists/${c.artist.id}`} className="text-ink underline-offset-2 hover:underline">{c.artistName}</Link></td>
                  <td className="px-3 py-3">
                    <b className="num">{c.code}</b>
                    <span className={`block text-[12px] ${c.live ? "text-earned" : "text-ink-2"}`}>{c.live ? "On" : c.active ? "Ended" : "Paused"}</span>
                  </td>
                  <td className="num px-3 py-3 text-right">{n(c.scans)}</td>
                  <td className="num px-3 py-3 text-right">{n(c.sales)}</td>
                  <td className="num px-3 py-3 text-right">{usd(c.grossCents)}</td>
                  <td className="num px-4 py-3 text-right">{usd(c.artfinityCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 pb-4 pt-2 text-[14px] text-ink-2">No codes linked yet. Artists pick this venue in My codes, or link a venue name from the Venues list.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="edit-h" className="af-card grid gap-3 p-4 sm:p-5">
          <h2 id="edit-h" className="text-[19px] font-bold">Venue details</h2>
          <VenueForm
            initial={{
              id: v.id, name: v.name, neighborhood: v.neighborhood || "", address: v.address || "", contactName: v.contactName || "", contactEmail: v.contactEmail || "",
              sharePct: Math.round(v.sharePct * 10000) / 100, active: v.active, notes: v.notes || "",
            }}
          />
        </section>
        <section aria-labelledby="log-h" className="af-card grid content-start gap-3 p-4 sm:p-5">
          <h2 id="log-h" className="text-[19px] font-bold">History</h2>
          {activity.length ? (
            <ul className="grid gap-2.5 text-[13.5px]">
              {activity.map((a) => (
                <li key={a.id} className="grid gap-0.5">
                  <span>{a.summary}</span>
                  <span className="text-[12px] text-ink-2">{day(a.createdAt)} · {a.adminEmail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-ink-2">Nothing yet.</p>
          )}
          <Link href={`/admin/activity?target=venue&id=${v.id}`} className="text-[13px] font-semibold text-scan">All activity for this venue</Link>
        </section>
      </div>
    </div>
  );
}
