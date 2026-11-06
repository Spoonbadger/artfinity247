import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminRoleOrRedirect } from "../../_components/gate";
import { ALERT_KINDS, defaultLabel, parseNotifyPrefs } from "@/lib/alertKinds";
import { ROLE_LABEL } from "@/lib/adminCaps";
import NotifyForm from "./NotifyForm";
import { PageHead } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alert emails" };

export default async function NotificationSettingsPage() {
  const admin = await adminRoleOrRedirect("/admin/settings/notifications");
  const me = await prisma.artist.findUnique({ where: { id: admin.id }, select: { email: true, adminNotify: true } });
  const prefs = parseNotifyPrefs(me?.adminNotify);
  const rows = ALERT_KINDS.map((k) => ({ kind: k.kind, label: k.label, defaultLabel: defaultLabel(k.kind, admin.adminRole), value: prefs[k.kind] ?? null }));
  return (
    <div className="grid max-w-[880px] gap-5">
      <PageHead title="Alert emails" sub={<>Sent to <b className="text-ink">{me?.email}</b> ({ROLE_LABEL[admin.adminRole]})</>}>
        <p className="text-[13.5px] text-ink-2">
          <b className="text-ink">Right away:</b> one email per alert. <b className="text-ink">Digest:</b> one email at 8am, skipped on quiet days.
          Everything is on <Link href="/admin/alerts" className="font-semibold text-scan">Alerts</Link> either way.
        </p>
      </PageHead>
      <NotifyForm rows={rows} />
    </div>
  );
}
