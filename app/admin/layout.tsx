import type { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";
import Logo from "@/components/af/Logo";
import AdminNav from "./_components/AdminNav";
import AdminSearch from "./_components/AdminSearch";
import { adminOrRedirect } from "./_components/gate";
import { prisma } from "@/lib/prisma";
import { openRequestCount } from "@/lib/reprints";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Artfinity" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await adminOrRedirect();
  const [openReports, heldReviews, openReprints, toModerate, toVerify] = await Promise.all([
    prisma.artReport.count({ where: { status: "open" } }).catch(() => 0),
    prisma.review.count({ where: { status: "flagged" } }).catch(() => 0),
    openRequestCount().catch(() => 0),
    prisma.artwork.count({ where: { OR: [{ status: "PENDING" }, { status: "APPROVED", flaggedReason: { not: null } }] } }).catch(() => 0),
    prisma.artist.count({ where: { verification: "PENDING" } }).catch(() => 0),
  ]);
  const counts = {
    "/admin/reports": openReports,
    "/admin/reviews": heldReviews,
    "/admin/reprints": openReprints,
    "/admin/moderation": toModerate,
    "/admin/verification": toVerify,
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
            <span className="hidden text-ink-2 xl:inline">{admin.email}</span>
            <Link href="/" className="btn btn-ghost btn-sm">View site</Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-x-8 px-4 pb-20 pt-4 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:pt-8">
        <AdminNav counts={counts} />
        <main className="min-w-0 pt-4 lg:pt-0">{children}</main>
      </div>
    </div>
  );
}
