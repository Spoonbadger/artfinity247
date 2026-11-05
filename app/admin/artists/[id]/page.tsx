import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../../_components/gate";
import { usd } from "../../_components/util";
import ActionButton from "../../_components/ActionButton";
import NotesPanel from "../../_components/NotesPanel";
import AuditList from "../../_components/AuditList";
import { getBalance, monthLabel } from "@/lib/balance";
import { activeFollowerCount } from "@/lib/followers";
import { formatPlanDate, isProActive } from "@/lib/plans";
import { orderNumber } from "@/lib/printer";
import { artPath, artistPath } from "@/lib/urls";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artist" };

const day = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const ART_STATUS: Record<string, string> = { PENDING: "bg-sticker text-ink", APPROVED: "bg-scan-soft text-scan", REJECTED: "bg-coral/15 text-coral" };
const STRIPE_LABEL: Record<string, string> = { ready: "Connected, payouts on", pending: "Started, not finished", not_connected: "Not connected" };

export default async function AdminArtistPage({ params }: { params: { id: string } }) {
  await adminOrRedirect(`/admin/artists/${params.id}`);
  const a = await prisma.artist.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, artist_name: true, first_name: true, last_name: true, slug: true, email: true, phone: true, city: true, state: true,
      profileImage: true, bio: true, createdAt: true, role: true, plan: true, proUntil: true, referralCode: true, referredById: true,
      verification: true, verifiedAt: true, verificationRequestedAt: true, verificationEvidence: true, verificationNote: true,
      closedAt: true, suspendedAt: true, suspendedReason: true, venmoHandle: true, venmoPending: true, termsAcceptedAt: true,
      stripeAccountId: true,
    },
  });
  if (!a) notFound();
  const name = a.artist_name || a.name;

  const [balance, artworks, orderRows, reviews, reports, referredBy, referrals, followers, codes, notes, audit] = await Promise.all([
    getBalance(a.id),
    prisma.artwork.findMany({
      where: { artistId: a.id }, orderBy: { createdAt: "desc" },
      select: { id: true, title: true, slug: true, imageUrl: true, status: true, flaggedReason: true, createdAt: true, editionSize: true, _count: { select: { OrderItem: { where: { order: { paymentStatus: "paid" } } } } } },
    }),
    prisma.order.findMany({
      where: { items: { some: { artwork: { artistId: a.id } } } }, orderBy: { createdAt: "desc" }, take: 25,
      select: { id: true, createdAt: true, email: true, shippingName: true, amountTotal: true, paymentStatus: true, shippingStatus: true, kind: true, _count: { select: { items: true } } },
    }),
    prisma.review.findMany({ where: { artistId: a.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, rating: true, body: true, buyerName: true, status: true, createdAt: true, artwork: { select: { title: true } } } }),
    prisma.artReport.findMany({ where: { artwork: { artistId: a.id } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, reason: true, status: true, createdAt: true, name: true, artwork: { select: { title: true } } } }),
    a.referredById ? prisma.artist.findUnique({ where: { id: a.referredById }, select: { id: true, artist_name: true, name: true, slug: true } }) : null,
    prisma.artist.findMany({ where: { referredById: a.id, NOT: { id: a.id } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, artist_name: true, name: true, createdAt: true } }),
    activeFollowerCount(a.id),
    prisma.qrCode.findMany({ where: { artistId: a.id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, code: true, label: true, venue: true, active: true, discountPct: true, artwork: { select: { title: true } }, _count: { select: { scans: true } } } }),
    prisma.adminNote.findMany({ where: { targetType: "artist", targetId: a.id }, orderBy: { createdAt: "desc" } }),
    prisma.adminAction.findMany({
      where: { OR: [{ targetType: "artist", targetId: a.id }, { details: { path: ["artistId"], equals: a.id } }] },
      orderBy: { createdAt: "desc" }, take: 50,
    }),
  ]);
  const evidence = (a.verificationEvidence && typeof a.verificationEvidence === "object" ? a.verificationEvidence : {}) as Record<string, unknown>;
  const infinity = isProActive(a);
  const prints = balance.ledger.filter((l) => !l.refunded).reduce((n, l) => n + l.quantity, 0);
  const gross = balance.ledger.filter((l) => !l.refunded).reduce((n, l) => n + l.grossCents, 0);
  const lastPaid = balance.payouts.find((p) => p.status === "paid");
  const target = `/api/admin/artists/${a.id}`;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link href="/admin/artists" className="text-[13.5px] font-semibold text-ink-2 no-underline hover:text-ink">← Artists</Link>
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {a.profileImage ? <img src={a.profileImage} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="h-16 w-16 rounded-full bg-gallery" />}
          <div className="min-w-0">
            <h1 className="display text-[40px] sm:text-[52px]">{name}</h1>
            <p className="text-[14px] text-ink-2">@{a.slug} · {a.email} · {a.phone || "no phone"} · {[a.city, a.state].filter(Boolean).join(", ")} · joined {day(a.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {a.role === "ADMIN" && <Chip c="bg-ink text-white">Admin</Chip>}
          {a.suspendedAt && <Chip c="bg-coral text-white">Suspended {day(a.suspendedAt)}</Chip>}
          {a.closedAt && <Chip c="bg-coral/15 text-coral">Closed {day(a.closedAt)}</Chip>}
          <Chip c={a.verification === "VERIFIED" ? "bg-scan-soft text-scan" : a.verification === "PENDING" ? "bg-sticker text-ink" : "bg-wall text-ink-2"}>
            {a.verification === "VERIFIED" ? `Verified ${day(a.verifiedAt)}` : a.verification === "PENDING" ? "Verification requested" : a.verification === "REJECTED" ? "Verification declined" : "Not verified"}
          </Chip>
          <Chip c={infinity ? "bg-[#e6dcff] text-ink" : "bg-wall text-ink-2"}>{infinity ? `Infinity until ${formatPlanDate(a.proUntil!)}` : "Free plan"}</Chip>
          <Chip c="bg-wall text-ink-2">{followers} followers</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          {!a.closedAt && !a.suspendedAt && <a href={artistPath(a.slug)} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">Public page ↗</a>}
          {(a.closedAt || a.suspendedAt) && <span className="self-center text-[13px] text-ink-2">Public page is offline.</span>}
          <Link href={`/admin/activity?id=${a.id}`} className="btn btn-ghost btn-sm">Full activity</Link>
        </div>
        {a.suspendedAt && (
          <p className="rounded-lg border-[1.5px] border-coral bg-[#fff1ed] px-3 py-2 text-[14px]"><b>Suspended:</b> {a.suspendedReason || "no reason given"}. Their pages 404, codes go nowhere and checkout is blocked. They see a banner in Studio.</p>
        )}
      </div>

      <section aria-label="Actions" className="af-card flex flex-wrap gap-2 p-4">
        {a.verification === "VERIFIED" ? (
          <ActionButton url={`/api/admin/verification/${a.id}`} body={{ action: "revoke" }} label="Unverify" title={`Remove ${name}'s verified seal?`} tone="danger"
            confirm="The seal comes off their page and they get an email with your note." fields={[{ name: "note", label: "Note for the artist", type: "textarea", placeholder: "Optional" }]} confirmLabel="Unverify" done="Verification removed" />
        ) : (
          <ActionButton url={`/api/admin/verification/${a.id}`} body={{ action: "approve" }} label="Verify" title={`Verify ${name}?`} tone="blue"
            confirm="Their page shows the verified seal and they get an email." confirmLabel="Verify" done="Verified" />
        )}
        {a.suspendedAt ? (
          <ActionButton url={target} body={{ action: "unsuspend" }} label="Unsuspend" title={`Unsuspend ${name}?`} tone="blue"
            confirm="Their page, art and printed codes come back online and buyers can check out again. They get an email." confirmLabel="Unsuspend" done="Unsuspended" />
        ) : (
          <ActionButton url={target} body={{ action: "suspend" }} label="Suspend" title={`Suspend ${name}?`} tone="danger" disabled={a.role === "ADMIN"}
            confirm="Their public pages 404, printed codes go nowhere and nobody can check out their work. Earnings are still paid. They get an email and see the reason in Studio."
            fields={[{ name: "reason", label: "Reason (the artist sees this)", type: "textarea", required: true, placeholder: "e.g. Several copyright reports while we look into it" }]} confirmLabel="Suspend" done="Suspended" />
        )}
        {a.closedAt && (
          <ActionButton url={target} body={{ action: "reopen" }} label="Reopen account" title={`Reopen ${name}'s account?`}
            confirm="Their art goes back to how it was before they closed, and they can log in again." confirmLabel="Reopen" done="Account reopened" />
        )}
        <ActionButton url={target} body={{ action: "grant_infinity" }} label="Grant Infinity" title={`Give ${name} Infinity months`}
          confirm={infinity ? `Adds to their current Infinity, which runs until ${formatPlanDate(a.proUntil!)}.` : "Starts today. They get the Infinity split on new sales while it lasts."}
          fields={[{ name: "months", label: "Months", type: "number", defaultValue: "2", required: true, hint: "1 to 24" }]} confirmLabel="Grant" done="Infinity granted" />
        <ActionButton url={target} body={{ action: "resend_payout_email" }} label="Resend payout email" title="Resend the payout email?" disabled={!lastPaid}
          confirm={lastPaid ? `Sends the “payout sent” email for ${lastPaid.label} (${usd(lastPaid.amountCents)}) to ${a.email} again.` : "No paid payout yet."} confirmLabel="Send" done="Payout email sent" />
      </section>

      <section aria-label="Money" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Prints sold" value={String(prints)} />
        <Stat label="Sales" value={usd(gross)} />
        <Stat label="Lifetime earnings" value={usd(balance.lifetimeCents)} earned />
        <Stat label="On hold (14 days)" value={usd(balance.pendingCents)} />
        <Stat label="Ready to pay" value={usd(balance.availableCents)} earned />
        <Stat label="Paid out" value={usd(balance.paidTotalCents)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card title="Payouts" sub={`${balance.payoutVia === "stripe" ? "Paid by Stripe" : "Paid by Venmo"} · Stripe: ${STRIPE_LABEL[balance.stripeStatus]} · Venmo: ${a.venmoHandle ? `@${a.venmoHandle.replace(/^@/, "")}` : "none"}${a.venmoPending ? ` (change to @${a.venmoPending} unconfirmed)` : ""}`}>
            {balance.lateMonths.length > 0 && <p className="mb-2 rounded-lg bg-coral/10 px-3 py-2 text-[13.5px] font-semibold text-coral">Late: {balance.lateMonths.map((m) => monthLabel(m)).join(", ")}</p>}
            {balance.adjustmentCents !== 0 && <p className="mb-2 text-[13px] text-ink-2">Paid months differ from today&apos;s recompute by {usd(balance.adjustmentCents)} (a refund or change after payout).</p>}
            {balance.payouts.length === 0 ? <Empty>No sales yet.</Empty> : (
              <Table head={["Month", "Amount", "Status", "Method", "Sales"]}>
                {balance.payouts.map((p) => (
                  <tr key={p.month} className="border-t border-line">
                    <td className="py-1.5 pr-3">{p.label}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold">{usd(p.amountCents)}</td>
                    <td className="py-1.5 pr-3">{p.status === "paid" ? `Paid ${day(p.paidAt)}` : p.status === "scheduled" ? (balance.lateMonths.includes(p.month) ? <span className="font-semibold text-coral">Late</span> : `Due ${day(p.dueDate)}`) : "This month"}</td>
                    <td className="py-1.5 pr-3 text-ink-2">{p.method}</td>
                    <td className="py-1.5 text-right">{p.sales}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title="Artworks" sub={`${artworks.filter((x) => x.status === "APPROVED").length} live of ${artworks.length}`}>
            {artworks.length === 0 ? <Empty>No artworks.</Empty> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {artworks.map((w) => (
                  <li key={w.id} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.imageUrl} alt="" className="h-[55px] w-[44px] rounded-[3px] object-cover" loading="lazy" />
                    <div className="min-w-0 text-[13.5px]">
                      <Link href={`/admin/artworks/${w.id}/edit`} className="block truncate font-semibold text-ink hover:text-scan">{w.title}</Link>
                      <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
                        <Chip c={ART_STATUS[w.status]}>{w.status === "APPROVED" ? "Live" : w.status === "PENDING" ? "In review" : "Rejected"}</Chip>
                        {w._count.OrderItem} sold{w.editionSize ? ` · edition of ${w.editionSize}` : ""}
                        {w.slug && w.status === "APPROVED" && <a href={artPath(a.slug, w.slug)} target="_blank" rel="noopener" className="font-semibold text-scan">View</a>}
                      </span>
                      {w.flaggedReason && <span className="block truncate text-[11.5px] text-coral">{w.flaggedReason}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Orders" sub="Latest 25 with their work">
            {orderRows.length === 0 ? <Empty>No orders.</Empty> : (
              <Table head={["Order", "Buyer", "Total", "Status"]}>
                {orderRows.map((o) => (
                  <tr key={o.id} className="border-t border-line">
                    <td className="py-1.5 pr-3"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-scan">{orderNumber(o.id)}</Link><span className="block text-[12px] text-ink-2">{day(o.createdAt)}</span></td>
                    <td className="max-w-[200px] truncate py-1.5 pr-3">{o.shippingName || o.email}</td>
                    <td className="py-1.5 pr-3 text-right">{usd(o.amountTotal)}</td>
                    <td className="py-1.5 text-[12.5px]">{o.kind !== "retail" ? `${o.kind} · ` : ""}{o.paymentStatus === "paid" || o.kind === "reprint" ? o.shippingStatus : o.paymentStatus}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title="Printed codes" id="codes" sub={`${codes.length} codes`}>
            {codes.length === 0 ? <Empty>No codes.</Empty> : (
              <Table head={["Code", "Points to", "Where", "Scans"]}>
                {codes.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-1.5 pr-3 font-semibold">{c.code}{!c.active && <span className="ml-1 text-[11.5px] text-ink-2">(off)</span>}</td>
                    <td className="max-w-[180px] truncate py-1.5 pr-3">{c.artwork?.title || "Artist page"}</td>
                    <td className="max-w-[180px] truncate py-1.5 pr-3 text-ink-2">{[c.label, c.venue].filter(Boolean).join(" · ") || "—"}{c.discountPct ? ` · ${c.discountPct}% off` : ""}</td>
                    <td className="py-1.5 text-right">{c._count.scans}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <NotesPanel targetType="artist" targetId={a.id} notes={notes.map((n) => ({ id: n.id, adminEmail: n.adminEmail, body: n.body, createdAt: n.createdAt.toISOString() }))} />

          <Card title="Verification">
            <dl className="grid gap-1.5 text-[13.5px]">
              <Row k="State">{a.verification.toLowerCase()}{a.verifiedAt ? ` · ${day(a.verifiedAt)}` : ""}</Row>
              {a.verificationRequestedAt && <Row k="Requested">{day(a.verificationRequestedAt)}</Row>}
              {Object.entries(evidence).filter(([, v]) => typeof v === "string" && v).map(([k, v]) => (
                <Row key={k} k={k}>{/^https?:\/\//.test(String(v)) ? <a href={String(v)} target="_blank" rel="noreferrer" className="break-all text-scan">{String(v)}</a> : <span className="break-words">{String(v)}</span>}</Row>
              ))}
              {a.verificationNote && <Row k="Our note">{a.verificationNote}</Row>}
              <Row k="Terms accepted">{day(a.termsAcceptedAt)}</Row>
            </dl>
            {a.verification === "PENDING" && <Link href="/admin/verification" className="btn btn-ghost btn-sm mt-2">Review in Verification</Link>}
          </Card>

          <Card title="Referrals">
            <dl className="grid gap-1.5 text-[13.5px]">
              <Row k="Their code">{a.referralCode || "—"}</Row>
              <Row k="Referred by">{referredBy ? <Link href={`/admin/artists/${referredBy.id}`} className="text-scan">{referredBy.artist_name || referredBy.name}</Link> : "—"}</Row>
              <Row k="Brought in">{referrals.length ? referrals.map((r, i) => <span key={r.id}>{i > 0 && ", "}<Link href={`/admin/artists/${r.id}`} className="text-scan">{r.artist_name || r.name}</Link></span>) : "nobody yet"}</Row>
            </dl>
          </Card>

          <Card title="Reviews" sub={`${reviews.length} latest`}>
            {reviews.length === 0 ? <Empty>No reviews.</Empty> : (
              <ul className="grid gap-2">
                {reviews.map((r) => (
                  <li key={r.id} className="text-[13.5px]">
                    <span className="font-semibold">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></span>
                    <span className="text-ink-2"> · {r.buyerName} · {r.artwork?.title || "—"} · {day(r.createdAt)}</span>
                    {r.status !== "published" && <Chip c="ml-1 bg-coral/15 text-coral">{r.status}</Chip>}
                    {r.body && <p className="line-clamp-2 text-ink-2">{r.body}</p>}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/reviews" className="mt-2 inline-block text-[13px] font-semibold text-scan">Manage reviews →</Link>
          </Card>

          <Card title="Reports against their work">
            {reports.length === 0 ? <Empty>None.</Empty> : (
              <ul className="grid gap-1.5 text-[13.5px]">
                {reports.map((r) => (
                  <li key={r.id}><b>{r.artwork?.title || "—"}</b> <span className="text-ink-2">· {r.reason} · {r.status} · {day(r.createdAt)} · from {r.name}</span></li>
                ))}
              </ul>
            )}
            <Link href="/admin/reports" className="mt-2 inline-block text-[13px] font-semibold text-scan">Open reports →</Link>
          </Card>

          <Card title="Audit trail" sub="Admin actions about this artist">
            <AuditList rows={audit} compact empty="No admin actions yet." />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Chip({ c, children }: { c: string; children: React.ReactNode }) {
  return <span className={cn("inline-block rounded-full px-2 py-px text-[11.5px] font-bold", c)}>{children}</span>;
}
function Stat({ label, value, earned }: { label: string; value: string; earned?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <b className={cn("num block text-[22px]", earned && "text-earned")}>{value}</b>
      <span className="text-[12.5px] text-ink-2">{label}</span>
    </div>
  );
}
function Card({ title, sub, id, children }: { title: string; sub?: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="af-card grid content-start gap-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {sub && <span className="text-[12.5px] text-ink-2">{sub}</span>}
      </div>
      {children}
    </section>
  );
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="num w-full min-w-[420px] text-left text-[13.5px]">
        <thead className="text-[11.5px] uppercase tracking-[0.06em] text-ink-2">
          <tr>{head.map((h, i) => <th key={h} className={cn("pb-1.5 pr-3 font-bold last:pr-0", i > 0 && ["Amount", "Total", "Sales", "Scans"].includes(h) && "text-right")}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2"><dt className="capitalize text-ink-2">{k}</dt><dd>{children}</dd></div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-[13.5px] text-ink-2">{children}</p>;
}
