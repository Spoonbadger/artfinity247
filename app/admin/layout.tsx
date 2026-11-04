import type { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import Logo from "@/components/af/Logo";
import AdminNav from "./_components/AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Artfinity" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/login?next=/admin");

  return (
    <div className="min-h-[100svh] bg-wall">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href="/admin/orders" />
            <span className="sticker-badge text-[11.5px]">Admin</span>
          </div>
          <AdminNav />
          <div className="ml-auto flex items-center gap-3 text-[14px]">
            <span className="hidden text-ink-2 lg:inline">{admin.email}</span>
            <Link href="/" className="btn btn-ghost btn-sm">View site</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8">{children}</main>
    </div>
  );
}
