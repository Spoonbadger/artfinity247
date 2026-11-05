import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminRoleOrRedirect } from "../../_components/gate";
import { ALERT_KINDS, defaultLabel, parseNotifyPrefs } from "@/lib/alertKinds";
import { ROLE_LABEL } from "@/lib/adminCaps";
import NotifyForm from "./NotifyForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Alert emails" };

export default async function NotificationSettingsPage() {
  const admin = await adminRoleOrRedirect("/admin/settings/notifications");
  const me = await prisma.artist.findUnique({ where: { id: admin.id }, select: { email: true, adminNotify: true } });
  const prefs = parseNotifyPrefs(me?.adminNotify);
  const rows = ALERT_KINDS.map((k) => ({ kind: k.kind, label: k.label, defaultLabel: defaultLabel(k.kind, admin.adminRole), value: prefs[k.kind] ?? null }));
  return (
    <div className="grid max-w-[880px] gap-5">
      <div>
        <p className="eyebrow">Your settings · {ROLE_LABEL[admin.adminRole]}</p>
        <h1 className="display text-[44px] sm:text-[56px]">Alert emails</h1>
        <p className="text-[14px] text-ink-2">
          What gets emailed to <b className="text-ink">{me?.email}</b>. <b className="text-ink">Right away</b> sends one email per alert as it happens.
          The <b className="text-ink">digest</b> is one short email around 8am New York time with everything new, and is skipped on quiet days.
          Nothing is ever emailed twice, and every alert is on the <Link href="/admin/alerts" className="font-semibold text-scan">Alerts</Link> page either way.
        </p>
      </div>
      <NotifyForm rows={rows} />
    </div>
  );
}
