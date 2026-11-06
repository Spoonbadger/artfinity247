import type { ReactNode } from "react";
import { adminRoleOrRedirect } from "../_components/gate";
import { roleCan } from "@/lib/adminCaps";
import SettingsTabs from "./SettingsTabs";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const admin = await adminRoleOrRedirect("/admin/settings");
  return (
    <div className="grid gap-5">
      <SettingsTabs owner={roleCan(admin.adminRole, "settings")} />
      {children}
    </div>
  );
}
