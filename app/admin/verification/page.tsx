import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTrust } from "@/lib/artistTrust";
import { readEvidence } from "@/components/artist/verification";
import { cn } from "@/lib/utils";
import { adminOrRedirect } from "../_components/gate";
import { PageHead } from "../_components/ui";
import VerificationQueue, { type VerRow } from "./VerificationQueue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verification" };

const TABS = [
  { id: "queue", label: "To review", status: "PENDING" },
  { id: "verified", label: "Verified", status: "VERIFIED" },
  { id: "declined", label: "Not approved", status: "REJECTED" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function VerificationPage({ searchParams }: { searchParams: { tab?: string } }) {
  await adminOrRedirect("/admin/verification");
  const tab = TABS.find((t) => t.id === searchParams.tab) ?? TABS[0];

  const [pending, verified, declined] = await Promise.all(
    TABS.map((t) => prisma.artist.count({ where: { verification: t.status, role: "USER" } }))
  );
  const counts: Record<TabId, number> = { queue: pending, verified, declined };

  const rows = await prisma.artist.findMany({
    where: { verification: tab.status, role: "USER" },
    orderBy: tab.id === "queue" ? { verificationRequestedAt: "asc" } : tab.id === "verified" ? { verifiedAt: "desc" } : { verificationRequestedAt: "desc" },
    take: 200,
    select: {
      id: true, slug: true, name: true, artist_name: true, email: true, city: true, state: true, profileImage: true, createdAt: true,
      verification: true, verifiedAt: true, verificationRequestedAt: true, verificationEvidence: true, verificationNote: true,
      artworks: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, title: true, imageUrl: true } },
    },
  });
  const trust = await getTrust(rows.map((r) => r.id));

  const items: VerRow[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.artist_name || r.name,
    email: r.email,
    city: [r.city, r.state].filter(Boolean).join(", "),
    avatar: r.profileImage,
    joined: r.createdAt.toISOString(),
    status: r.verification,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    requestedAt: r.verificationRequestedAt?.toISOString() ?? null,
    evidence: readEvidence(r.verificationEvidence),
    note: r.verificationNote,
    printsSold: trust.get(r.id)?.printsSold ?? 0,
    medal: trust.get(r.id)?.earned ?? null,
    art: r.artworks,
  }));

  return (
    <div className="grid gap-5">
      <PageHead title="Verification" sub={`${pending === 0 ? "All clear" : `${pending} waiting`} · does the name match the link?`} />

      <nav aria-label="Verification views" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "queue" ? "/admin/verification" : `/admin/verification?tab=${t.id}`}
            aria-current={tab.id === t.id ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[40px] items-center rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold no-underline transition",
              tab.id === t.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
            )}
          >
            {t.label} <span className="num ml-1 opacity-70">{counts[t.id]}</span>
          </Link>
        ))}
      </nav>

      <VerificationQueue key={tab.id} rows={items} tab={tab.id} />
    </div>
  );
}
