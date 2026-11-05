import type { Metadata } from "next";
import { adminRoleOrRedirect } from "../_components/gate";
import { roleCan } from "@/lib/adminRoles";
import { loadSocialPage } from "@/lib/social/admin";
import { igConfigured, igSetupState, igUsername, publishingQuota, tokenHealth } from "@/lib/social/instagram";
import { cloudinaryOn } from "@/lib/social/storage";
import SocialAdmin from "./SocialAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Social" };

export default async function AdminSocialPage({ searchParams }: { searchParams: { post?: string } }) {
  const admin = await adminRoleOrRedirect("/admin/social");
  const data = await loadSocialPage();
  const connected = igConfigured();
  const [username, health, quota] = connected ? await Promise.all([igUsername(), tokenHealth(), publishingQuota()]) : [null, null, null];
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";
  return (
    <SocialAdmin
      {...data}
      ig={{
        connected,
        username,
        setup: igSetupState(),
        health: health ? { status: health.status, expiresAt: health.expiresAt?.toISOString() ?? null, message: health.message } : null,
        quota,
      }}
      canEdit={roleCan(admin.adminRole, "admin")}
      cloud={cloudinaryOn()}
      base={base}
      focus={typeof searchParams.post === "string" ? searchParams.post : null}
    />
  );
}
