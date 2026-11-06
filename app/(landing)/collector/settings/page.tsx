// /collector/settings — the email on the collection, sign out, and deleting the collection (wishlist goes, orders stay).
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCollector } from "@/lib/collector";
import { DeleteCollection, SignOutButton } from "@/components/collector/CollectorActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collection settings", robots: { index: false, follow: false } };

export default async function CollectorSettings() {
  const me = await requireCollector("/collector/settings");
  const saved = await prisma.wishlistItem.count({ where: { collectorId: me.id } });
  return (
    <div className="mx-auto grid max-w-[620px] gap-8 px-4 pb-16 pt-8 sm:pt-12">
      <div className="grid gap-2">
        <Link href="/collector" className="w-fit text-[14px] font-semibold text-ink-2 hover:text-ink">← Your collection</Link>
        <h1 className="t-page">Settings</h1>
      </div>
      <section aria-labelledby="acct-h" className="box grid gap-3 p-5">
        <h2 id="acct-h" className="t-card">Your collection</h2>
        <dl className="grid gap-1 text-[15px]">
          <div className="flex flex-wrap gap-2"><dt className="text-ink-2">Email</dt><dd className="min-w-0 break-words font-semibold">{me.email}</dd></div>
          <div className="flex flex-wrap gap-2"><dt className="text-ink-2">Since</dt><dd>{me.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</dd></div>
          <div className="flex flex-wrap gap-2"><dt className="text-ink-2">Saved pieces</dt><dd className="num">{saved}</dd></div>
        </dl>
        <p className="t-small">Orders are matched to this email. For another email, sign out and sign in with it.</p>
        <SignOutButton className="btn btn-ghost btn-sm w-fit min-h-[44px] px-4" />
      </section>
      <section aria-labelledby="del-section-h" className="box grid gap-3 p-5">
        <h2 id="del-section-h" className="t-card">Delete your collection</h2>
        <p className="t-muted">
          Your wishlist goes right away. Orders stay on record for tax, and your order emails still work. Follows are separate: unfollow on your collection page.
        </p>
        <DeleteCollection email={me.email} />
      </section>
    </div>
  );
}
