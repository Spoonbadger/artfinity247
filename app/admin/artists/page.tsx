import type { Metadata } from "next";
import Link from "next/link";
import { adminOrRedirect } from "../_components/gate";
import { usd } from "../_components/util";
import { ARTIST_FILTER_KEYS, listArtists, type ArtistFilters } from "@/lib/adminArtists";
import ActionButton from "../_components/ActionButton";
import { ROLE_LABEL, asAdminRole } from "@/lib/adminCaps";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accounts" };

const PAGE = 100;
const STRIPE: Record<string, string> = { ready: "Stripe", pending: "Stripe setup unfinished", not_connected: "" };

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

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{rows.length} {rows.length === 1 ? "account" : "accounts"}{filtered ? " match" : ""} · {usd(totalBalance)} unpaid</p>
          <h1 className="display text-[44px] sm:text-[56px]">Artists</h1>
          <p className="text-[13.5px] text-ink-2">Every account, artists and admins.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            url="/api/admin/artists" need="accounts" tone="blue" label="Create account" title="Create an artist account"
            confirm="For an artist you met in person. They get an email to set their password; their page is live once they add art."
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
        </div>
      </div>

      <form method="get" className="af-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end [&>label]:min-w-0">
        <label className="grid gap-1 text-[12.5px] font-semibold">Search
          <input name="q" defaultValue={f.q || ""} placeholder="Name, @handle, email, city" className={field} />
        </label>
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
          Signed up in the last 7 days
        </label>
        <label className="flex min-h-[40px] items-center gap-2 text-[13.5px] font-semibold">
          <input type="checkbox" name="balance" value="1" defaultChecked={f.balance === "1"} className="h-4 w-4 accent-[var(--af-ink)]" />
          Has a balance
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-blue btn-sm">Filter</button>
          {filtered && <Link href="/admin/artists" className="btn btn-ghost btn-sm">Clear</Link>}
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_70px_80px_110px_110px] gap-4 border-b border-line bg-wall/60 px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2 md:grid">
          <span>Artist</span><span>Status</span><span className="text-right">Live art</span><span className="text-right">Prints</span><span className="text-right">Sales</span><span className="text-right">Unpaid</span>
        </div>
        {shown.length === 0 && <p className="px-4 py-14 text-center text-[15px] text-ink-2">No artists match.</p>}
        <ul className="divide-y divide-line">
          {shown.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/artists/${a.id}`} className="grid gap-x-4 gap-y-1 px-4 py-3 text-ink no-underline hover:bg-wall/50 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_70px_80px_110px_110px] md:items-center">
                <div className="min-w-0">
                  <b className="block truncate text-[15px]">{a.name}</b>
                  <span className="block truncate text-[13px] text-ink-2">@{a.slug} · {a.email}{a.city ? ` · ${a.city}` : ""}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {a.role === "ADMIN" && <Chip c="bg-ink text-white">{ROLE_LABEL[asAdminRole(a.adminRole)]}</Chip>}
                  {!a.emailVerified && <Chip c="bg-wall text-ink-2 ring-1 ring-line">Email unconfirmed</Chip>}
                  {!a.hasPassword && <Chip c="bg-wall text-ink-2 ring-1 ring-line">{a.providers.length ? `${a.providers.join(", ")} only` : "No password yet"}</Chip>}
                  {a.suspended && <Chip c="bg-coral text-white">Suspended</Chip>}
                  {a.closed && <Chip c="bg-coral/15 text-coral">Closed</Chip>}
                  {a.verification === "VERIFIED" && <Chip c="bg-scan-soft text-scan">Verified</Chip>}
                  {a.verification === "PENDING" && <Chip c="bg-sticker text-ink">Verify request</Chip>}
                  {a.infinity && <Chip c="bg-[#e6dcff] text-ink">Infinity</Chip>}
                  {STRIPE[a.stripe] && <Chip c={a.stripe === "ready" ? "bg-earned-soft text-earned" : "bg-sticker/60 text-ink"}>{STRIPE[a.stripe]}</Chip>}
                </div>
                <span className="num text-[13.5px] md:text-right"><span className="text-ink-2 md:hidden">Live art </span>{a.live}</span>
                <span className="num text-[13.5px] md:text-right"><span className="text-ink-2 md:hidden">Prints </span>{a.prints}</span>
                <span className="num text-[13.5px] md:text-right"><span className="text-ink-2 md:hidden">Sales </span>{usd(a.salesCents)}</span>
                <span className={cn("num text-[13.5px] font-semibold md:text-right", a.balanceCents > 0 && "text-earned")}><span className="font-normal text-ink-2 md:hidden">Unpaid </span>{usd(a.balanceCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {rows.length > PAGE && (
        <div className="flex gap-2">
          {page > 1 && <Link href={`?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page - 1) })}`} className="btn btn-ghost btn-sm">Previous</Link>}
          {page * PAGE < rows.length && <Link href={`?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page + 1) })}`} className="btn btn-ghost btn-sm">Next</Link>}
        </div>
      )}
    </div>
  );
}

function Chip({ c, children }: { c: string; children: React.ReactNode }) {
  return <span className={cn("rounded-full px-2 py-px text-[11.5px] font-bold", c)}>{children}</span>;
}
