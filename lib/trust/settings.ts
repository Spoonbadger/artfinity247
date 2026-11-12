// The trust engine's settings, resolved (server only). The pure rules and defaults are in ./config.ts.
import { readAdminSettings } from "@/lib/adminSettings";
import { imageCheckReady, photoCheckReady } from "@/lib/moderation";
import { resolveTrust, type ResolvedTrust } from "./config";

export async function trustSettings(): Promise<ResolvedTrust> {
  const s = await readAdminSettings().catch(() => ({}) as Awaited<ReturnType<typeof readAdminSettings>>);
  return resolveTrust(s.trust, imageCheckReady(), photoCheckReady());
}
