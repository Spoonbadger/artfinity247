// PUT /api/admin/social/settings { enabled?, autoQueue?, presets?, format?, captionTemplate?, hashtags?, maxPerDay?, times? }
import { NextRequest } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { readSocialSettings, writeSocialSettings } from "@/lib/social/settings";
import { reschedule } from "@/lib/social/admin";
import { bad, json } from "../_lib";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("admin");
  if (denied) return denied;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return bad("Nothing to save.");
  if (Array.isArray(b.presets) && !b.presets.length) return bad("Pick at least one preset for new drafts.", "presets_required");
  if (Array.isArray(b.times) && !b.times.length) return bad("Pick at least one posting time.", "times_required");
  if (typeof b.captionTemplate === "string" && !b.captionTemplate.trim()) return bad("Write a caption template first.", "caption_required");
  const before = await readSocialSettings();
  const next = await writeSocialSettings(b, { id: admin.id, email: admin.email });
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(before[k]));
  await logAdminAction(admin, "social.settings", { type: "setting", id: "social" }, `Social settings: ${changed.join(", ") || "no change"}`, { changed });
  if (changed.includes("times") || changed.includes("maxPerDay")) await reschedule(await readSocialSettings());
  return json({ settings: next, message: next.enabled ? "Saved. Approved posts go out on schedule." : "Saved" });
}
