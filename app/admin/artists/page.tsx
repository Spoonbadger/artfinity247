import type { Metadata } from "next";
import Link from "next/link";
import { adminOrRedirect } from "../_components/gate";
import { usd } from "../_components/util";
import { ARTIST_FILTER_KEYS, listArtists, type ArtistFilters } from "@/lib/adminArtists";
import ActionButton from "../_components/ActionButton";
import { ROLE_LABEL, asAdminRole } from "@/lib/adminCaps";
import { cn } from "@/lib/utils";
import { PageHead, Pill } from "../_components/ui";
import { DataTable, type Row } from "../_components/table";
import { EmptyState } from "@/components/studio/EmptyState";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artists" };

const PAGE = 500;

export default async function AdminArtistsPage({ searchParams }: { searchParams: ArtistFilters & { page?: string } }) {
  await adminOrRedirect("/admin/artists");
  const f: ArtistFilters = Object.fromEntries(ARTIST_FILTER_KEYS.map((k) => [k, searchParams[k]]));
  const rows = await listArtists(f);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => !!v) as [string, string][]);
  const filtered = qs.toString().length > 0;
  const totalBalance = rows.reduce((n, r) => n + r.balanceCents, 0);
  const field = "w-full min-w-0 min-h-[40px] rounded-lg border-[1.5px] border-line bg-white px-2.5 text-[14px] text-ink";

  const advanced = (["verified", "status", "plan", "stripe", "role", "signin", "email", "joined", "balance"] as const).filter((k) => !!f[k]).length;
  const tableRows: Row[] = shown.map((a) => ({
    id: a.id,
    sort: { name: a.name.toLowerCase(), live: a.live, prints: a.prints, sales: a.salesCents, unpaid: a.balanceCents },
    cells: {
      name: (
        <div className="min-w-0">
          <Link href={`/admin/artists/${a.id}`} className="block truncate text-[15px] font-bold text-ink no-underline hover:text-scan">{a.name}</Link>
          <span className="block truncate text-[13px] text-ink-2">@{a.slug} · {a.email}</span>
        </div>
      ),
      status: (
        <div className="flex flex-wrap gap-1">
          {a.role === "ADMIN" && <Pill tone="ink">{ROLE_LABEL[asAdminRole(a.adminRole)]}</Pill>}
          {a.suspended && <Pill tone="red">Suspended</Pill>}
          {a.closed && <Pill tone="red">Closed</Pill>}
          {a.verification === "VERIFIED" && <Pill tone="blue">Verified</Pill>}
          {a.verification === "PENDING" && <Pill tone="amber">Verify request</Pill>}
          {a.infinity && <Pill tone="blue">Infinity</Pill>}
          {a.stripe === "pending" && <Pill tone="amber">Stripe unfinished</Pill>}
          {!a.emailVerified && <Pill>Email unconfirmed</Pill>}
          {!a.hasPassword && <Pill>{a.providers.length ? `${a.providers.join(", ")} only` : "No password"}</Pill>}
        </div>
      ),
      live: a.live,
      prints: a.prints,
      sales: usd(a.salesCents),
      unpaid: <span className={cn("font-semibold", a.balanceCents > 0 && "text-earned")}>{usd(a.balanceCents)}</span>,
    },
  }));

  return (
    <div className="grid gap-5">
      <PageHead
        title="Artists"
        sub={`${rows.length} ${rows.length === 1 ? "account" : "accounts"}${filtered ? " match" : ""} · ${usd(totalBalance)} unpaid`}
        action={
          <>
            <ActionButton
              url="/api/admin/artists" need="accounts" tone="blue" label="Create account" title="Create an artist account"
              confirm="For an artist you met in person. They get an email to set a password."
              fields={[
                { name: "artist_name", label: "Artist name (shown on their page)", required: true },
                { name: "handle", label: "Handle", required: true, placeholder: "e.g. maya.paints", hint: "3–30 letters, numbers, dots or underscores. Their page is /@handle." },
                { name: "email", label: "Email", required: true },
                { name: "city", label: "City", required: true, defaultValue: "New York" },
                { name: "first_name", label: "First name (for emails)", placeholder: "Optional" },
              ]}
              confirmLabel="Create and send invite" done="Account created"
            />
            <a href={`/api/admin/artists/export?${qs}`} className="btn btn-ghost btn-sm" download>Export CSV</a>
          </>
        }
      />

      <form method="get" className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[200px] flex-1 sm:max-w-[340px]">
            <span className="sr-only">Search</span>
            <input name="q" type="search" defaultValue={f.q || ""} placeholder="Name, @handle, email, city" className={field} />
          </label>
          <button type="submit" className="btn btn-ghost btn-sm">Search</button>
          {filtered && <Link href="/admin/artists" className="min-h-[40px] content-center px-1 text-[13px] font-semibold text-ink-2 underline underline-offset-2">Clear filters</Link>}
        </div>
        <details open={advanced > 0} className="group">
          <summary className="inline-flex min-h-[40px] cursor-pointer items-center text-[13.5px] font-semibold text-ink-2 hover:text-ink">More filters{advanced ? ` (${advanced} on)` : ""}</summary>
          <div className="af-panel mt-1 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end [&>label]:min-w-0">
            <label className="grid gap-1 text-[12.5px] font-semibold">Verified
              <select name="verified" defaultValue={f.verified || ""} className={field}>
                <option value="">Any</option><option value="yes">Verified</option><option value="pending">Requested</option><option value="no">Not verified</option>
              </select>
            </label>
            <label className="grid gap-1 text-[12.5px] font-semibold">Account
              <select name="status" defaultValue={f.status || ""} className={field}>
                <option value="">Any</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option>
              </select>
            </label>
            <label className="grid gap-1 text-[12.5px] font-semibold">Plan
              <select name="plan" defaultValue={f.plan || ""} className={field}>
                <option value="">Any</option><option value="infinity">Infinity</option><option value="free">Free</option>
              </select>
            </label>
            <label className="grid gap-1 text-[12.5px] font-semibold">Payouts
              <select name="stripe" defaultValue={f.stripe || ""} className={field}>
                <option value="">Any</option><option value="ready">Stripe ready</option><option value="pending">Stripe unfinished</option><option value="none">No Stripe</option>
              </select>
            </label>
            <label className="grid gap-1 text-[12.5px] font-semibold">Who
              <select name="role" defaultValue={f.role || ""} className={field}>
                <option value="">All accounts</option><option value="artists">Artists</option><option value="admins">Admins</option>
              </select>
            </label>
            <label className="grid gap-1 text-[12.5px] font-semibold">Sign-in
              <select name="signin" defaultValue={f.signin || ""} className={field}>
                <option value="">Any</option><option value="social">Social only (no password)</option>
              </select>
            </label>
            <label className="flex min-h-[40px] items-center gap-2 text-[13.5px] font-semibold">
              <input type="checkbox" name="email" value="unverified" defaultChecked={f.email === "unverified"} className="h-4 w-4 accent-[var(--af-ink)]" />
              Email not confirmed
            </label>
            <label className="flex min-h-[40px] items-center gap-2 text-[13.5px] font-semibold">
              <input type="checkbox" name="joined" value="7d" defaultChecked={f.joined === "7d"} className="h-4 w-4 accent-[var(--af-ink)]" />
              Joined in the last 7 days
            </label>
            <label className="flex min-h-[40px] items-center gap-2 text-[13.5px] font-semibold">
              <input type="checkbox" name="balance" value="1" defaultChecked={f.balance === "1"} className="h-4 w-4 accent-[var(--af-ink)]" />
              Has a balance
            </label>
            <div><button type="submit" className="btn btn-ghost btn-sm">Apply</button></div>
          </div>
        </details>
      </form>

      <DataTable
        id="artists"
        caption="Artists"
        minWidth={760}
        defaultSort={{ key: "name", dir: "asc" }}
        columns={[
          { key: "name", label: "Artist" },
          { key: "status", label: "Status", sortable: false },
          { key: "live", label: "Live art", align: "right" },
          { key: "prints", label: "Prints", align: "right" },
          { key: "sales", label: "Sales", align: "right" },
          { key: "unpaid", label: "Unpaid", align: "right" },
        ]}
        rows={tableRows}
        empty={<EmptyState title="No artists match" action={{ label: "Clear filters", href: "/admin/artists" }} />}
      />
      {rows.length > PAGE && (
        <div className="flex gap-2">
          {page > 1 && <Link href={`?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page - 1) })}`} className="btn btn-ghost btn-sm">Previous</Link>}
          {page * PAGE < rows.length && <Link href={`?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page + 1) })}`} className="btn btn-ghost btn-sm">Next</Link>}
        </div>
      )}
    </div>
  );
}
