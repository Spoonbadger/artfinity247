import type { Metadata } from "next";
import Link from "next/link";
import { adminRoleOrRedirect } from "../../_components/gate";
import { prisma } from "@/lib/prisma";
import { readScanSettings } from "@/lib/scanning.server";
import ScanSettingsForm from "./ScanSettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scanning service" };

export default async function ScanningSettingsPage() {
  await adminRoleOrRedirect("/admin/settings/scanning");
  const [s, waitlist, recent] = await Promise.all([
    readScanSettings(),
    prisma.scanWaitlist.count(),
    prisma.scanWaitlist.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { email: true, source: true, createdAt: true } }),
  ]);
  return (
    <div className="grid max-w-[820px] gap-5">
      <div>
        <p className="eyebrow">Settings</p>
        <h1 className="display text-[44px] sm:text-[56px]">Scanning service</h1>
        <p className="text-[14px] text-ink-2">
          Prices, turnaround and wording for the painting scanning service (<Link href="/scanning" className="font-semibold text-scan">public page</Link>,{" "}
          <Link href="/admin/scanning" className="font-semibold text-scan">bookings</Link>). Fields marked <span className="rounded-full bg-sticker px-2 py-0.5 text-[12px] font-bold text-ink">Placeholder · set by Craig</span> still
          have a stand-in value. Artists never see that label: a price that isn&apos;t set reads &ldquo;Ask for a quote&rdquo;.
        </p>
      </div>
      <ScanSettingsForm value={s} />
      <section aria-labelledby="wl-h" className="af-card grid gap-2 p-4 sm:p-5">
        <h2 id="wl-h" className="text-[19px] font-bold">Waitlist <span className="num text-[15px] font-normal text-ink-2">{waitlist}</span></h2>
        <p className="text-[13.5px] text-ink-2">People who asked to hear when scanning opens (shown while the service is off). Email them yourself when you turn it on.</p>
        {recent.length ? (
          <ul className="grid gap-1 text-[14px]">
            {recent.map((w) => (
              <li key={w.email} className="flex flex-wrap justify-between gap-2 border-b border-line py-1 last:border-0">
                <span className="font-semibold">{w.email}</span>
                <span className="num text-[12.5px] text-ink-2">{w.source === "studio" ? "artist, from Studio" : "public page"} · {w.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-ink-2">No one yet.</p>
        )}
      </section>
    </div>
  );
}
