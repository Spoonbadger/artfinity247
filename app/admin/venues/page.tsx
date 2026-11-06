import type { Metadata } from "next";
import Link from "next/link";
import { adminRoleOrRedirect } from "../_components/gate";
import ActionButton from "../_components/ActionButton";
import { usd } from "../_components/util";
import VenueForm from "./_components/VenueForm";
import { PageHead, Pill } from "../_components/ui";
import { DataTable, type Row } from "../_components/table";
import { EmptyState } from "@/components/studio/EmptyState";
import { pctLabel, unlinkedVenueNames, venueList } from "@/lib/venues";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Venues" };

const n = (v: number) => v.toLocaleString("en-US");

export default async function AdminVenuesPage() {
  await adminRoleOrRedirect("/admin/venues");
  const [venues, unlinked] = await Promise.all([venueList(), unlinkedVenueNames()]);
  const options = venues.map((v) => ({ value: v.id, label: `${v.name}${v.neighborhood ? ` · ${v.neighborhood}` : ""}${v.active ? "" : " (paused)"}` }));
  const owed = venues.reduce((s, v) => s + v.unpaidCents, 0);

  const rows: Row[] = venues.map((v) => ({
    id: v.id,
    status: v.active ? "active" : "paused",
    search: `${v.name} ${v.neighborhood ?? ""}`,
    sort: { name: v.name.toLowerCase(), codes: v.liveCodes, sales: v.sales, revenue: v.grossCents, profit: v.artfinityCents, share: v.sharePct, unpaid: v.unpaidCents },
    cells: {
      name: (
        <>
          <Link href={`/admin/venues/${v.id}`} className="font-bold text-ink underline-offset-2 hover:underline">{v.name}</Link>
          <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">{v.neighborhood || "—"}{!v.active && <Pill>Paused</Pill>}</span>
        </>
      ),
      codes: <>{n(v.liveCodes)}<span className="text-ink-2">/{n(v.codes)}</span></>,
      sales: n(v.sales),
      revenue: usd(v.grossCents),
      profit: usd(v.artfinityCents),
      share: v.sharePct > 0 ? pctLabel(v.sharePct) : <span className="text-ink-2">0%</span>,
      unpaid: <b className={v.unpaidCents ? "text-earned" : "text-ink-2"}>{usd(v.unpaidCents)}</b>,
    },
  }));

  return (
    <div className="grid gap-5">
      <PageHead
        title="Venues"
        sub={`${n(venues.length)} ${venues.length === 1 ? "venue" : "venues"}${owed > 0 ? ` · ${usd(owed)} unpaid share` : ""}`}
        action={<Link href="/venues" className="btn btn-ghost btn-sm">Public list</Link>}
      />

      <DataTable
        id="venues"
        caption="Partner venues"
        minWidth={760}
        defaultSort={{ key: "unpaid", dir: "desc" }}
        search={venues.length > 6 ? "Venue or neighborhood" : undefined}
        statuses={[{ value: "active", label: "Active" }, { value: "paused", label: "Paused" }]}
        columns={[
          { key: "name", label: "Venue" },
          { key: "codes", label: "Codes on", align: "right" },
          { key: "sales", label: "Sales", align: "right" },
          { key: "revenue", label: "Revenue", align: "right" },
          { key: "profit", label: "Profit", align: "right" },
          { key: "share", label: "Share", align: "right" },
          { key: "unpaid", label: "Unpaid", align: "right" },
        ]}
        rows={rows}
        empty={<EmptyState dab="var(--af-edge-strong)" title="No venues yet" body="Add one below, or create one from a name artists already use." />}
      />

      <section aria-labelledby="merge-h" className="af-panel grid gap-3 p-4 sm:p-5">
        <div>
          <h2 id="merge-h" className="t-card">Unlinked venue names {unlinked.length > 0 && <span className="num text-[14px] font-normal text-ink-2">{unlinked.length}</span>}</h2>
          <p className="t-small">What artists typed on their codes. Link it or make it a venue.</p>
        </div>
        {unlinked.length ? (
          <ul className="grid gap-2">
            {unlinked.map((u) => (
              <li key={u.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge px-3 py-2.5">
                <div className="min-w-0">
                  <b className="text-[15px]">{u.text}</b>
                  {u.spellings.length > 1 && <span className="ml-2 text-[13px] text-ink-2">also &ldquo;{u.spellings.filter((s) => s !== u.text).join("”, “")}&rdquo;</span>}
                  <span className="block text-[13px] text-ink-2">{n(u.codes)} {u.codes === 1 ? "code" : "codes"} ({n(u.live)} on) · {u.artists.join(", ")}</span>
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
                    url="/api/admin/venues" body={{ fromText: u.text }} need="accounts" label="Make venue" title="New venue"
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
          <p className="text-[14px] text-ink-2">All linked.</p>
        )}
      </section>

      <details id="add" className="af-panel p-4 sm:p-5" open={venues.length === 0}>
        <summary className="cursor-pointer text-[18px] font-bold">Add a venue</summary>
        <div className="mt-3"><VenueForm /></div>
      </details>
    </div>
  );
}
