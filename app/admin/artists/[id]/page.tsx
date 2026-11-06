import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminRoleOrRedirect } from "../../_components/gate";
import { ROLE_LABEL, asAdminRole, roleCan } from "@/lib/adminCaps";
import { PROVIDER_LABEL, isProviderId } from "@/lib/oauth/meta";
import { deleteBlocker } from "@/lib/adminAccounts";
import { usd } from "../../_components/util";
import ActionButton from "../../_components/ActionButton";
import MoreMenu from "../../_components/MoreMenu";
import { PageHead, Pill, StatusPill } from "../../_components/ui";
import { DataTable, type Row as TRow } from "../../_components/table";
import { Problem } from "@/components/studio/Problem";
import NotesPanel from "../../_components/NotesPanel";
import AuditList from "../../_components/AuditList";
import { getBalance, monthLabel } from "@/lib/balance";
import { activeFollowerCount } from "@/lib/followers";
import { formatPlanDate, isProActive } from "@/lib/plans";
import { getBillingSummary, stripeDashboardUrl } from "@/lib/billing";
import { hasLiveSubscription, type BillingView } from "@/lib/billingStatus";
import { orderNumber } from "@/lib/printer";
import { artPath, artistPath } from "@/lib/urls";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artist" };

const day = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "—");
const ART_STATUS: Record<string, string> = { PENDING: "bg-sticker text-ink", APPROVED: "bg-scan-soft text-scan", REJECTED: "bg-coral/15 text-coral" };
const STRIPE_LABEL: Record<string, string> = { ready: "Connected, payouts on", pending: "Started, not finished", not_connected: "Not connected" };
const BILLING_LABEL: Record<BillingView["kind"], string> = {
  free: "No subscription", earned: "Free months (no subscription)", renews: "Paying, renews", trial: "Subscribed, free months first", cancels: "Subscribed, cancels at period end", payment_failed: "Infinity payment failed",
};

export default async function AdminArtistPage({ params }: { params: { id: string } }) {
  const me = await adminRoleOrRedirect(`/admin/artists/${params.id}`);
  const a = await prisma.artist.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, artist_name: true, first_name: true, last_name: true, slug: true, email: true, phone: true, city: true, state: true,
      profileImage: true, bio: true, createdAt: true, role: true, plan: true, proUntil: true, referralCode: true, referredById: true,
      verification: true, verifiedAt: true, verificationRequestedAt: true, verificationEvidence: true, verificationNote: true,
      closedAt: true, suspendedAt: true, suspendedReason: true, venmoHandle: true, venmoPending: true, termsAcceptedAt: true,
      stripeAccountId: true, adminRole: true, emailVerifiedAt: true, password: true, sessionVersion: true,
      oauthAccounts: { orderBy: { createdAt: "asc" }, select: { id: true, provider: true, email: true, createdAt: true, lastUsedAt: true } },
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
  const billing = await getBillingSummary(a.id, a.proUntil);
  const sub = billing.state;
  const subLive = hasLiveSubscription(sub);
  const billingTarget = `/api/admin/artists/${a.id}/billing`;
  const prints = balance.ledger.filter((l) => !l.refunded).reduce((n, l) => n + l.quantity, 0);
  const gross = balance.ledger.filter((l) => !l.refunded).reduce((n, l) => n + l.grossCents, 0);
  const lastPaid = balance.payouts.find((p) => p.status === "paid");
  const target = `/api/admin/artists/${a.id}`;
  const hasPassword = !!a.password;
  const isAdmin = a.role === "ADMIN";
  const self = a.id === me.id;
  // Another admin's account: account-level actions need an owner (the API checks this too).
  const teammate = isAdmin && !self && !roleCan(me.adminRole, "team");
  const blocker = roleCan(me.adminRole, "deleteAccount") ? await deleteBlocker(a.id) : null;

  const payoutRows: TRow[] = balance.payouts.map((p) => {
    const late = balance.lateMonths.includes(p.month);
    return {
      id: p.month,
      status: p.status === "paid" ? "paid" : late ? "late" : p.status === "scheduled" ? "due" : "open",
      sort: { month: p.month, amount: p.amountCents, status: p.status === "paid" ? 2 : late ? 0 : 1, sales: p.sales },
      cells: {
        month: p.label,
        amount: <b>{usd(p.amountCents)}</b>,
        status: p.status === "paid" ? <Pill tone="green">Paid {day(p.paidAt)}</Pill> : p.status === "scheduled" ? (late ? <Pill tone="red">Late</Pill> : <Pill tone="amber">Due {day(p.dueDate)}</Pill>) : <Pill>This month</Pill>,
        method: <span className="text-ink-2">{p.method}</span>,
        sales: p.sales,
      },
    };
  });
  const orderTable: TRow[] = orderRows.map((o) => {
    const st = o.paymentStatus === "paid" || o.kind === "reprint" ? o.shippingStatus : o.paymentStatus;
    return {
      id: o.id,
      date: o.createdAt.toISOString(),
      search: `${orderNumber(o.id)} ${o.shippingName ?? ""} ${o.email}`,
      sort: { date: o.createdAt.toISOString(), buyer: (o.shippingName || o.email).toLowerCase(), total: o.amountTotal, status: st },
      cells: {
        date: <><Link href={`/admin/orders/${o.id}`} className="font-semibold text-scan">{orderNumber(o.id)}</Link><span className="block text-[12px] text-ink-2">{day(o.createdAt)}</span></>,
        buyer: <span className="block max-w-[200px] truncate">{o.shippingName || o.email}</span>,
        total: usd(o.amountTotal),
        status: <span className="flex flex-wrap gap-1">{o.kind !== "retail" && <Pill tone="amber">{o.kind}</Pill>}<StatusPill status={st} /></span>,
      },
    };
  });
  const codeTable: TRow[] = codes.map((c) => ({
    id: c.id,
    search: `${c.code} ${c.artwork?.title ?? ""} ${c.label ?? ""} ${c.venue ?? ""}`,
    sort: { code: c.code, to: c.artwork?.title || "Artist page", where: [c.label, c.venue].filter(Boolean).join(" · "), scans: c._count.scans },
    cells: {
      code: <span className="font-semibold">{c.code}{!c.active && <span className="ml-1 text-[11.5px] font-normal text-ink-2">(off)</span>}</span>,
      to: <span className="block max-w-[180px] truncate">{c.artwork?.title || "Artist page"}</span>,
      where: <span className="block max-w-[180px] truncate text-ink-2">{[c.label, c.venue].filter(Boolean).join(" · ") || "—"}{c.discountPct ? ` · ${c.discountPct}% off` : ""}</span>,
      scans: c._count.scans,
    },
  }));

  return (
    <div className="grid gap-6">
      <PageHead
        back={{ href: "/admin/artists", label: "Artists" }}
        title={
          <span className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {a.profileImage ? <img src={a.profileImage} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-full bg-gallery" />}
            <span className="min-w-0 break-words">{name}</span>
          </span>
        }
        sub={<>@{a.slug} · {a.email} · joined {day(a.createdAt)}</>}
        action={
          <>
            {a.verification === "VERIFIED" ? (
              <ActionButton url={`/api/admin/verification/${a.id}`} body={{ action: "revoke" }} label="Unverify" title={`Remove ${name}'s verified seal?`} tone="danger"
                confirm="The seal comes off their page and they get an email with your note." fields={[{ name: "note", label: "Note for the artist", type: "textarea", placeholder: "Optional" }]} confirmLabel="Unverify" done="Verification removed" />
            ) : (
              <ActionButton url={`/api/admin/verification/${a.id}`} body={{ action: "approve" }} label="Verify" title={`Verify ${name}?`} tone={a.verification === "PENDING" ? "blue" : "ghost"}
                confirm="Their page shows the verified seal and they get an email." confirmLabel="Verify" done="Verified" />
            )}
            {!a.closedAt && !a.suspendedAt && <a href={artistPath(a.slug)} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">Public page ↗</a>}
            <MoreMenu label="Account">
        <ActionButton url={target} body={{ action: "grant_infinity" }} need="accounts" label="Grant Infinity" title={`Give ${name} Infinity months`}
          confirm={infinity ? `Adds to their current Infinity, which runs until ${formatPlanDate(a.proUntil!)}.` : "Starts today. They get the Infinity split on new sales while it lasts."}
          fields={[{ name: "months", label: "Months", type: "number", defaultValue: "2", required: true, hint: "1 to 24" }]} confirmLabel="Grant" done="Infinity granted" />
        {infinity && (
          <ActionButton url={target} body={{ action: "revoke_infinity" }} need="accounts" label="End Infinity" title={`End ${name}'s Infinity now?`} tone="danger"
            confirm={`Their Infinity (until ${formatPlanDate(a.proUntil!)}) ends today. New sales use the free plan's split.`} confirmLabel="End Infinity" done="Infinity ended" />
        )}
        <ActionButton url={target} body={{ action: "resend_payout_email" }} label="Resend payout email" title="Resend the payout email?" disabled={!lastPaid}
          confirm={lastPaid ? `Sends the “payout sent” email for ${lastPaid.label} (${usd(lastPaid.amountCents)}) to ${a.email} again.` : "No paid payout yet."} confirmLabel="Send" done="Payout email sent" />
          <ActionButton url={target} body={{ action: "send_password_reset" }} need="accountSupport" disabled={teammate} label={hasPassword ? "Send password reset link" : "Send set-password link"}
            title="Email a password link?" confirm={`Sends the “Reset your password” email to ${a.email}. The link works for 30 minutes and signs them out everywhere once used.${hasPassword ? "" : " They have no password yet, so this lets them add one."}`} confirmLabel="Send link" done="Link sent" />
          <ActionButton url={target} body={{ action: "resend_verification" }} need="accountSupport" disabled={!!a.emailVerifiedAt} label="Resend email confirmation"
            title="Resend the confirmation link?" confirm={`Sends a fresh “Confirm your email” link to ${a.email} (good for 7 days).`} confirmLabel="Send" done="Confirmation sent" />
          <ActionButton url={target} body={{ action: "change_email" }} need="accounts" disabled={teammate} label="Change email"
            title={`Change ${name}'s email`} confirm={`Now ${a.email}. The new address has to be confirmed (we email a link), and they're signed out everywhere. Payouts and newsletters wait until it's confirmed.`}
            fields={[{ name: "email", label: "New email", required: true, defaultValue: a.email }]} confirmLabel="Change email" done="Email changed" />
          <ActionButton url={target} body={{ action: "edit_profile" }} need="accounts" disabled={teammate} label="Edit name, handle, city"
            title={`Edit ${name}'s profile`} confirm="A new handle keeps the old one working: /@old redirects, artwork links and printed codes keep working."
            fields={[
              { name: "artist_name", label: "Display name", defaultValue: name, required: true },
              { name: "handle", label: "Handle", defaultValue: a.slug, required: true, hint: "3–30 letters, numbers, dots or underscores" },
              { name: "city", label: "City", defaultValue: a.city, required: true },
            ]} confirmLabel="Save" done="Profile saved" />
          <ActionButton url={target} body={{ action: "sign_out_everywhere" }} need="accountSupport" disabled={teammate} label="Sign out everywhere" tone="danger"
            title={`Sign ${name} out everywhere?`} confirm={self ? "Every session ends, including this one. You'll need to log in again." : "Every logged-in browser and phone is signed out on its next click. Their password and sign-in methods stay the same."} confirmLabel="Sign out everywhere" done="Signed out everywhere" />
              <Link href={`/admin/activity?id=${a.id}`} className="btn btn-ghost btn-sm">Full activity</Link>
            </MoreMenu>
          </>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {isAdmin && <Pill tone="ink">{ROLE_LABEL[asAdminRole(a.adminRole)]}</Pill>}
          {a.suspendedAt && <Pill tone="red">Suspended {day(a.suspendedAt)}</Pill>}
          {a.closedAt && <Pill tone="red">Closed {day(a.closedAt)}</Pill>}
          {a.verification === "VERIFIED" ? <Pill tone="blue">Verified</Pill> : a.verification === "PENDING" ? <Pill tone="amber">Verification requested</Pill> : a.verification === "REJECTED" ? <Pill>Verification declined</Pill> : null}
          <Pill tone={infinity ? "blue" : "grey"}>{infinity ? `Infinity to ${formatPlanDate(a.proUntil!)}` : "Free plan"}</Pill>
          {billing.view.kind === "payment_failed" && <Pill tone="red">{BILLING_LABEL[billing.view.kind]}</Pill>}
          {!a.emailVerifiedAt && <Pill tone="amber">Email not confirmed</Pill>}
          <Pill>{followers} followers</Pill>
        </div>
      </PageHead>

      {a.suspendedAt && (
        <Problem tone="error" title={`Suspended: ${a.suspendedReason || "no reason given"}`}>Pages 404, codes go nowhere, checkout is blocked.</Problem>
      )}
      {teammate && <p className="text-[13px] text-ink-2">Another admin&apos;s account: only an owner can change its sign-in, email or profile.</p>}

      <section aria-label="Money" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Ready to pay" value={usd(balance.availableCents)} earned />
        <Stat label="On hold (14 days)" value={usd(balance.pendingCents)} />
        <Stat label="Paid out" value={usd(balance.paidTotalCents)} />
        <Stat label={`${prints} prints · ${usd(gross)} sales`} value={usd(balance.lifetimeCents)} earned />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card title="Payouts" sub={`${balance.payoutVia === "stripe" ? "Stripe" : "Venmo"} · Stripe ${STRIPE_LABEL[balance.stripeStatus].toLowerCase()} · Venmo ${a.venmoHandle ? `@${a.venmoHandle.replace(/^@/, "")}` : "none"}${a.venmoPending ? ` (@${a.venmoPending} unconfirmed)` : ""}`}>
            {balance.lateMonths.length > 0 && <p className="mb-2 rounded-lg bg-coral/10 px-3 py-2 text-[13.5px] font-semibold text-coral">Late: {balance.lateMonths.map((m) => monthLabel(m)).join(", ")}</p>}
            {balance.adjustmentCents !== 0 && <p className="mb-2 text-[13px] text-ink-2">Paid months differ from today&apos;s recompute by {usd(balance.adjustmentCents)} (a refund or change after payout).</p>}
            <DataTable id="artist-payouts" caption="Payouts" minWidth={480} defaultSort={{ key: "month", dir: "desc" }}
              columns={[{ key: "month", label: "Month", firstDir: "desc" }, { key: "amount", label: "Amount", align: "right" }, { key: "status", label: "Status" }, { key: "method", label: "Method", sortable: false }, { key: "sales", label: "Sales", align: "right" }]}
              rows={payoutRows} empty={<Empty>No sales yet.</Empty>} />
          </Card>

          <Card title="Orders" sub="Latest 25 with their work">
            <DataTable id="artist-orders" caption="Orders" minWidth={480} defaultSort={{ key: "date", dir: "desc" }} search="Order or buyer"
              columns={[{ key: "date", label: "Order", firstDir: "desc" }, { key: "buyer", label: "Buyer" }, { key: "total", label: "Total", align: "right" }, { key: "status", label: "Status" }]}
              rows={orderTable} empty={<Empty>No orders.</Empty>} />
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

          <Card title="Printed codes" id="codes" sub={`${codes.length} codes`}>
            <DataTable id="artist-codes" caption="Printed codes" minWidth={480} defaultSort={{ key: "scans", dir: "desc" }} search={codes.length > 8 ? "Code, art or place" : undefined}
              columns={[{ key: "code", label: "Code" }, { key: "to", label: "Points to" }, { key: "where", label: "Where" }, { key: "scans", label: "Scans", align: "right" }]}
              rows={codeTable} empty={<Empty>No codes.</Empty>} />
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <NotesPanel targetType="artist" targetId={a.id} notes={notes.map((n) => ({ id: n.id, adminEmail: n.adminEmail, body: n.body, createdAt: n.createdAt.toISOString() }))} />
          <Card fold title="Sign-in and account" sub={`Session v${a.sessionVersion}`}>
            <dl className="grid gap-1.5 text-[13.5px]">
              <Row k="Email">{a.email} {a.emailVerifiedAt ? <span className="text-earned">· confirmed {day(a.emailVerifiedAt)}</span> : <span className="text-coral">· not confirmed</span>}</Row>
              <Row k="Password">{hasPassword ? "Set" : "None (signs in with a provider, or hasn't set one yet)"}</Row>
              {isAdmin && <Row k="Admin role"><Link href="/admin/team" className="text-scan">{ROLE_LABEL[asAdminRole(a.adminRole)]}</Link></Row>}
            </dl>
            {a.oauthAccounts.length === 0 ? (
              <p className="text-[13px] text-ink-2">No social sign-ins connected.</p>
            ) : (
              <ul className="grid gap-1.5">
                {a.oauthAccounts.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-[13.5px]">
                    <span className="min-w-0">
                      <b>{isProviderId(o.provider) ? PROVIDER_LABEL[o.provider] : o.provider}</b>
                      <span className="text-ink-2">{o.email ? ` · ${o.email}` : ""} · added {day(o.createdAt)}{o.lastUsedAt ? ` · last used ${day(o.lastUsedAt)}` : ""}</span>
                    </span>
                    {roleCan(me.adminRole, "disconnectOAuth") && (
                      <ActionButton url={target} body={{ action: "disconnect_oauth", oauthId: o.id }} need="disconnectOAuth" tone="danger" label="Disconnect"
                        disabled={!hasPassword && a.oauthAccounts.length === 1}
                        title={`Disconnect ${isProviderId(o.provider) ? PROVIDER_LABEL[o.provider] : o.provider}?`}
                        confirm={!hasPassword && a.oauthAccounts.length === 1 ? "This is their only way to log in. Send a set-password link first." : "They can't log in with it any more (they can connect it again from Studio). Existing sessions stay until they expire or you sign them out."}
                        confirmLabel="Disconnect" done="Disconnected" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card fold open={a.verification === "PENDING"} title="Verification">
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

          <Card fold open={billing.view.kind === "payment_failed"} title="Infinity billing" sub={billing.mode === "simulated" ? "Test mode (no Stripe keys)" : billing.mode === "off" ? "Billing not set up" : "Stripe Billing"}>
            <dl className="grid gap-1.5 text-[13.5px]">
              <Row k="Plan">{infinity ? `Infinity until ${formatPlanDate(a.proUntil!)}` : "Free"}</Row>
              <Row k="Billing">{BILLING_LABEL[billing.view.kind]}</Row>
              {sub.subscriptionId && (
                <Row k="Subscription">
                  {billing.mode === "live" ? <a href={stripeDashboardUrl("subscriptions", sub.subscriptionId)} target="_blank" rel="noopener" className="break-all text-scan">{sub.subscriptionId}</a> : <span className="break-all">{sub.subscriptionId}</span>}
                  <span className="text-ink-2"> · {sub.status}{sub.interval ? ` · ${sub.interval === "year" ? "yearly" : "monthly"}` : ""}{sub.simulated ? " · simulated" : ""}</span>
                </Row>
              )}
              {sub.periodEnd && <Row k={sub.status === "trialing" ? "First charge" : sub.cancelAtPeriodEnd ? "Ends" : "Period ends"}>{day(sub.periodEnd)}</Row>}
              {sub.paymentFailedAt && <Row k="Payment failed"><span className="font-semibold text-coral">{day(sub.paymentFailedAt)}</span></Row>}
              {sub.endedAt && <Row k="Ended">{day(sub.endedAt)}</Row>}
              {sub.customerId && (
                <Row k="Customer">{billing.mode === "live" && !sub.simulated ? <a href={stripeDashboardUrl("customers", sub.customerId)} target="_blank" rel="noopener" className="break-all text-scan">{sub.customerId}</a> : <span className="break-all">{sub.customerId}</span>}</Row>
              )}
            </dl>
            {subLive && (
              <div className="mt-2 flex flex-wrap gap-2">
                {sub.cancelAtPeriodEnd ? (
                  <ActionButton url={billingTarget} body={{ action: "resume" }} need="money" label="Undo cancel" title="Keep their subscription going?" confirm="It renews again at the end of the period." confirmLabel="Undo cancel" done="Cancellation undone" />
                ) : (
                  <ActionButton url={billingTarget} body={{ action: "cancel_at_period_end" }} need="money" label="Cancel at period end" title={`Stop ${name}'s renewal?`}
                    confirm={`No more charges. They keep Infinity until ${sub.periodEnd ? day(sub.periodEnd) : "the period ends"}, then go to Free.`} confirmLabel="Cancel renewal" done="Cancels at period end" />
                )}
                <ActionButton url={billingTarget} body={{ action: "cancel_now" }} need="money" tone="danger" label="Cancel now" title={`End ${name}'s subscription now?`}
                  confirm="The subscription and Infinity end today, with no refund (refund in Stripe if one is owed). New sales use the free plan's split; past orders keep theirs." confirmLabel="Cancel now" done="Cancelled" />
                {billing.mode === "live" && <ActionButton url={billingTarget} body={{ action: "sync" }} need="money" label="Sync from Stripe" title="Re-read the subscription from Stripe?" confirm="Updates the status, period and Infinity date from Stripe." confirmLabel="Sync" done="Synced" />}
              </div>
            )}
            {subLive && infinity && <p className="mt-2 text-[13px] text-ink-2">To take Infinity away from a paying artist, cancel the subscription here first; End Infinity is blocked while it&apos;s live.</p>}
          </Card>

          <Card fold title="Referrals">
            <dl className="grid gap-1.5 text-[13.5px]">
              <Row k="Their code">{a.referralCode || "—"}</Row>
              <Row k="Referred by">{referredBy ? <Link href={`/admin/artists/${referredBy.id}`} className="text-scan">{referredBy.artist_name || referredBy.name}</Link> : "—"}</Row>
              <Row k="Brought in">{referrals.length ? referrals.map((r, i) => <span key={r.id}>{i > 0 && ", "}<Link href={`/admin/artists/${r.id}`} className="text-scan">{r.artist_name || r.name}</Link></span>) : "nobody yet"}</Row>
            </dl>
          </Card>

          <Card fold title="Reviews" sub={`${reviews.length} latest`}>
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

          <Card fold open={reports.some((r) => r.status === "open")} title="Reports" sub={`${reports.length}`}>
            {reports.length === 0 ? <Empty>None.</Empty> : (
              <ul className="grid gap-1.5 text-[13.5px]">
                {reports.map((r) => (
                  <li key={r.id}><b>{r.artwork?.title || "—"}</b> <span className="text-ink-2">· {r.reason} · {r.status} · {day(r.createdAt)} · from {r.name}</span></li>
                ))}
              </ul>
            )}
            <Link href="/admin/reports" className="mt-2 inline-block text-[13px] font-semibold text-scan">Open reports →</Link>
          </Card>

          <Card fold title="Audit trail" sub={`${audit.length}`}>
            <AuditList rows={audit} compact empty="No admin actions yet." />
          </Card>
        </div>
      </div>

      <details className="af-panel border-coral/40 p-4">
        <summary className="cursor-pointer text-[15px] font-bold text-coral">Suspend, close or delete</summary>
        <div className="mt-3 flex flex-wrap gap-2">
        {a.suspendedAt ? (
          <ActionButton url={target} body={{ action: "unsuspend" }} need="suspend" label="Unsuspend" title={`Unsuspend ${name}?`}
            confirm="Their page, art and printed codes come back online and buyers can check out again. They get an email." confirmLabel="Unsuspend" done="Unsuspended" />
        ) : (
          <ActionButton url={target} body={{ action: "suspend" }} need="suspend" label="Suspend" title={`Suspend ${name}?`} tone="danger" disabled={isAdmin}
            confirm="Their public pages 404, printed codes go nowhere and nobody can check out their work. Earnings are still paid. They get an email and see the reason in Studio."
            fields={[{ name: "reason", label: "Reason (the artist sees this)", type: "textarea", required: true, placeholder: "e.g. Several copyright reports while we look into it" }]} confirmLabel="Suspend" done="Suspended" />
        )}
        {a.closedAt ? (
          <ActionButton url={target} body={{ action: "reopen" }} need="suspend" label="Reopen account" title={`Reopen ${name}'s account?`}
            confirm="Their art goes back to how it was before they closed, and they can log in again." confirmLabel="Reopen" done="Account reopened" />
        ) : (
          <ActionButton url={target} body={{ action: "close" }} need="suspend" label="Close account" title={`Close ${name}'s account?`} tone="danger" disabled={isAdmin}
            confirm="Same as the artist closing it: their page and art go offline, printed codes stop working and they're signed out. Orders and unpaid earnings stay and are paid on schedule. You can reopen it later."
            fields={[{ name: "reason", label: "Reason (for the audit log)", type: "textarea", placeholder: "Optional" }]} confirmLabel="Close account" done="Account closed" />
        )}
          {roleCan(me.adminRole, "deleteAccount") && !self && (
            <ActionButton url={target} body={{ action: "delete" }} need="deleteAccount" tone="danger" label="Delete permanently" disabled={!!blocker} redirectTo="/admin/artists"
              title={`Delete ${name} for good?`}
              confirm={blocker ? <>Can&apos;t delete: {blocker}</> : <>Removes the account, its art, links, codes and everything else. <b>This can&apos;t be undone.</b> Type the handle to confirm.</>}
              fields={blocker ? [] : [{ name: "confirm", label: `Type ${a.slug}`, required: true }]} confirmLabel="Delete forever" done="Deleted" />
          )}
        </div>
        {blocker && roleCan(me.adminRole, "deleteAccount") && <p className="mt-2 text-[13px] text-ink-2">Can&apos;t delete permanently: {blocker}</p>}
      </details>
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
      <span className="text-[13px] text-ink-2">{label}</span>
    </div>
  );
}
function Card({ title, sub, id, children, fold, open }: { title: string; sub?: string; id?: string; children: React.ReactNode; fold?: boolean; open?: boolean }) {
  if (fold) {
    return (
      <details id={id} open={open} className="af-panel group p-4">
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 [&::-webkit-details-marker]:hidden">
          <h2 className="t-card">{title}</h2>
          {sub && <span className="text-[13px] text-ink-2">{sub}</span>}
          <span aria-hidden="true" className="ml-auto text-ink-2 transition group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-2 grid gap-2">{children}</div>
      </details>
    );
  }
  return (
    <section id={id} className="af-panel grid content-start gap-2 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="t-card">{title}</h2>
        {sub && <span className="text-[13px] text-ink-2">{sub}</span>}
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
