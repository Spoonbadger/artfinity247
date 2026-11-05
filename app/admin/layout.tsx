import type { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import Logo from "@/components/af/Logo";
import AdminNav from "./_components/AdminNav";
import AdminSearch from "./_components/AdminSearch";
import { adminRoleOrRedirect } from "./_components/gate";
import { AdminRoleProvider } from "./_components/AdminRole";
import { openAlertCount } from "@/lib/alerts";
import { ROLE_LABEL } from "@/lib/adminCaps";
import { prisma } from "@/lib/prisma";
import { openRequestCount } from "@/lib/reprints";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Artfinity" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Invite links are opened by people who aren't admins yet: no gate, no admin chrome (middleware sets x-af-path).
  if ((headers().get("x-af-path") || "").startsWith("/admin/invite/")) return <div className="min-h-[100svh] bg-wall">{children}</div>;
  const admin = await adminRoleOrRedirect();
  const [openReports, heldReviews, openReprints, toModerate, toVerify, openAlerts, codeOrdersToPrint, scanRequests, toPrint] = await Promise.all([
    prisma.artReport.count({ where: { status: "open" } }).catch(() => 0),
    prisma.review.count({ where: { status: "flagged" } }).catch(() => 0),
    openRequestCount().catch(() => 0),
    prisma.artwork.count({ where: { OR: [{ status: "PENDING" }, { status: "APPROVED", flaggedReason: { not: null } }] } }).catch(() => 0),
    prisma.artist.count({ where: { verification: "PENDING" } }).catch(() => 0),
    openAlertCount(),
    prisma.codePrintOrder.count({ where: { status: "paid" } }).catch(() => 0),
    prisma.scanBooking.count({ where: { status: "requested" } }).catch(() => 0),
    prisma.order.count({ where: { OR: [{ paymentStatus: "paid" }, { kind: "reprint" }], shippingStatus: "pending", sentToPrinter: false, printerSentAt: null } }).catch(() => 0),
  ]);
  const counts = {
    "/admin/reports": openReports,
    "/admin/reviews": heldReviews,
    "/admin/reprints": openReprints,
    "/admin/moderation": toModerate,
    "/admin/verification": toVerify,
    "/admin/alerts": openAlerts,
    "/admin/code-orders": codeOrdersToPrint,
    "/admin/scanning": scanRequests,
    "/admin/orders": toPrint,
  };

  return (
    <div className="min-h-[100svh] bg-wall">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href="/admin" />
            <span className="sticker-badge text-[11.5px]">Admin</span>
          </div>
          <div className="order-last w-full sm:order-none sm:ml-4 sm:w-auto">
            <AdminSearch />
          </div>
          <div className="ml-auto flex items-center gap-3 text-[14px]">
            <Link
              href="/admin/alerts"
              aria-label={openAlerts ? `${openAlerts} open alerts` : "Alerts, none open"}
              title={openAlerts ? `${openAlerts} open alerts` : "No open alerts"}
              className="relative grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-line bg-white text-ink no-underline transition hover:border-ink"
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              {openAlerts > 0 && <span className="num absolute -right-1 -top-1 min-w-[20px] rounded-full bg-coral px-1 text-center text-[11.5px] font-bold leading-[20px] text-white">{openAlerts > 99 ? "99+" : openAlerts}</span>}
            </Link>
            <span className="hidden text-ink-2 xl:inline">{admin.email} · {ROLE_LABEL[admin.adminRole]}</span>
            <Link href="/" className="btn btn-ghost btn-sm hidden sm:inline-flex">View site</Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-x-8 px-4 pb-20 pt-4 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:pt-8">
        <AdminNav counts={counts} role={admin.adminRole} />
        <main className="min-w-0 pt-4 lg:pt-0 [&>div]:grid-cols-[minmax(0,1fr)]"><AdminRoleProvider role={admin.adminRole}>{children}</AdminRoleProvider></main>
      </div>
    </div>
  );
}
