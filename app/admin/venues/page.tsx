import type { Metadata } from "next";
import Link from "next/link";
import { adminRoleOrRedirect } from "../_components/gate";
import ActionButton from "../_components/ActionButton";
import { usd } from "../_components/util";
import VenueForm from "./_components/VenueForm";
import { pctLabel, unlinkedVenueNames, venueList } from "@/lib/venues";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Venues" };

const n = (v: number) => v.toLocaleString("en-US");

export default async function AdminVenuesPage() {
  await adminRoleOrRedirect("/admin/venues");
  const [venues, unlinked] = await Promise.all([venueList(), unlinkedVenueNames()]);
  const options = venues.map((v) => ({ value: v.id, label: `${v.name}${v.neighborhood ? ` · ${v.neighborhood}` : ""}${v.active ? "" : " (paused)"}` }));
  const owed = venues.reduce((s, v) => s + v.unpaidCents, 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Venue partner program</p>
          <h1 className="display text-[44px] sm:text-[56px]">Venues</h1>
          <p className="mt-1 max-w-[62ch] text-[14.5px] text-ink-2">
            Cafés, bars, shops and markets that hang artists&apos; codes. Each gets a public page and, if you set one, a share of Artfinity&apos;s profit on sales from its walls.
          </p>
        </div>
        <Link href="/venues" className="btn btn-ghost btn-sm">Public venue list</Link>
      </div>

      <section aria-labelledby="list-h" className="af-card overflow-x-auto">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
          <h2 id="list-h" className="text-[19px] font-bold">{n(venues.length)} {venues.length === 1 ? "venue" : "venues"}</h2>
          {owed > 0 && <span className="text-[13.5px] text-ink-2">Unpaid venue share, all months: <b className="num text-ink">{usd(owed)}</b></span>}
        </div>
        {venues.length ? (
          <table className="mt-2 w-full min-w-[760px] text-left text-[14px]">
            <caption className="sr-only">Partner venues</caption>
            <thead className="border-b border-line text-[12px] text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Venue</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Codes</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Sales</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Revenue</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Artfinity profit</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Share</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Unpaid share</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id} className="border-b border-line last:border-0 hover:bg-wall/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/venues/${v.id}`} className="font-bold text-ink underline-offset-2 hover:underline">{v.name}</Link>
                    <span className="block text-[12.5px] text-ink-2">{[v.neighborhood, v.active ? null : "Paused"].filter(Boolean).join(" · ") || "—"}</span>
                  </td>
                  <td className="num px-3 py-3 text-right">{n(v.liveCodes)}<span className="text-ink-2">/{n(v.codes)}</span></td>
                  <td className="num px-3 py-3 text-right">{n(v.sales)}</td>
                  <td className="num px-3 py-3 text-right">{usd(v.grossCents)}</td>
                  <td className="num px-3 py-3 text-right">{usd(v.artfinityCents)}</td>
                  <td className="num px-3 py-3 text-right">{v.sharePct > 0 ? pctLabel(v.sharePct) : <span className="text-ink-2">0%</span>}</td>
                  <td className={`num px-4 py-3 text-right font-bold ${v.unpaidCents ? "text-earned" : "text-ink-2"}`}>{usd(v.unpaidCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 pb-4 pt-2 text-[14.5px] text-ink-2">No venues yet. Add one below, or create one from a venue name artists already use.</p>
        )}
      </section>

      <section aria-labelledby="merge-h" className="af-card grid gap-3 p-4 sm:p-5">
        <div>
          <h2 id="merge-h" className="text-[19px] font-bold">Venue names on codes, not linked yet</h2>
          <p className="text-[13.5px] text-ink-2">What artists typed as the venue. Link a name to a partner venue (its codes then count for that venue) or turn it into a new venue.</p>
        </div>
        {unlinked.length ? (
          <ul className="grid gap-2">
            {unlinked.map((u) => (
              <li key={u.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                <div className="min-w-0">
                  <b className="text-[15px]">{u.text}</b>
                  {u.spellings.length > 1 && <span className="ml-2 text-[12.5px] text-ink-2">also &ldquo;{u.spellings.filter((s) => s !== u.text).join("”, “")}&rdquo;</span>}
                  <span className="block text-[12.5px] text-ink-2">{n(u.codes)} {u.codes === 1 ? "code" : "codes"} ({n(u.live)} on) · {u.artists.join(", ")}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {options.length > 0 && (
                    <ActionButton
                      url="/api/admin/venues/link" body={{ text: u.text }} need="accounts" label="Link to venue" title={`Link “${u.text}” to a venue`}
                      confirm={<>The {u.codes === 1 ? "code" : `${u.codes} codes`} named &ldquo;{u.text}&rdquo; will hang at the venue you pick. Buyers see the venue&apos;s name when they scan.</>}
                      fields={[{ name: "venueId", label: "Venue", type: "select", options, defaultValue: options[0]?.value }]}
                      confirmLabel="Link codes"
                    />
                  )}
                  <ActionButton
                    url="/api/admin/venues" body={{ fromText: u.text }} need="accounts" tone="blue" label="Create venue from this" title="New venue"
                    confirm={<>Creates the venue and links {u.codes === 1 ? "its code" : `its ${u.codes} codes`}. Add the address and contact on its page after.</>}
                    fields={[
                      { name: "name", label: "Name", required: true, defaultValue: u.text },
                      { name: "neighborhood", label: "Neighborhood", placeholder: "Williamsburg" },
                      { name: "address", label: "Address", placeholder: "Street, Brooklyn, NY" },
                    ]}
                    confirmLabel="Create venue"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-ink-2">Every venue name on a code is linked.</p>
        )}
      </section>

      <section aria-labelledby="add-h" className="af-card grid gap-3 p-4 sm:p-5">
        <h2 id="add-h" className="text-[19px] font-bold">Add a venue</h2>
        <VenueForm />
      </section>
    </div>
  );
}
