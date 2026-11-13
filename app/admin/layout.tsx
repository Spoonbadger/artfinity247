import type { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { headers } from "next/headers";
import { Swatch } from "@/components/af/Brush";
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
          {/* left to right: back to the site, admin home, alerts */}
          <nav aria-label="Admin shortcuts" className="flex items-center gap-2.5">
            <Link
              href="/"
              aria-label="Back to site"
              title="Back to site"
              className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-edge-strong bg-white text-ink no-underline transition hover:border-ink"
            >
              <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            <Link href="/admin" aria-label="Admin home" title="Admin home" className="group relative inline-grid h-11 place-items-center px-5 no-underline">
              <Swatch color="var(--af-sticker)" className="absolute inset-0 h-full w-full transition group-hover:scale-[1.04]" />
              <span className="display relative text-[24px] leading-none text-ink">Admin</span>
            </Link>
            <Link
              href="/admin/alerts"
              aria-label={openAlerts ? `${openAlerts} open alerts` : "Alerts, none open"}
              title={openAlerts ? `${openAlerts} open alerts` : "No open alerts"}
              className="relative grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-edge-strong bg-white text-ink no-underline transition hover:border-ink"
            >
              <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
              {openAlerts > 0 && <span className="num absolute -right-1 -top-1 min-w-[20px] rounded-full bg-coral px-1 text-center text-[12px] font-bold leading-[20px] text-white">{openAlerts > 99 ? "99+" : openAlerts}</span>}
            </Link>
          </nav>
          <div className="order-last w-full sm:order-none sm:ml-2 sm:w-auto">
            <AdminSearch />
          </div>
          <span className="ml-auto hidden text-[14px] text-ink-2 xl:inline">{admin.email} · {ROLE_LABEL[admin.adminRole]}</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-x-8 px-4 pb-20 pt-4 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:pt-8">
        <AdminNav counts={counts} role={admin.adminRole} />
        <main className="af-app min-w-0 pt-4 lg:pt-0 [&>div]:grid-cols-[minmax(0,1fr)]"><AdminRoleProvider role={admin.adminRole}>{children}</AdminRoleProvider></main>
      </div>
    </div>
  );
}
