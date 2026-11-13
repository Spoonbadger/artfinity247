// Copies a provider's profile picture into our own storage at sign-up (server only). Facebook and Instagram
// picture URLs are signed and expire, so we never store them directly. Only https URLs on the provider's own
// image hosts are fetched (no open fetch of whatever URL a cookie names), capped at 5 MB and 5 seconds.
import { saveUpload } from "@/lib/storage";
import { mockOAuthAllowed } from "./mockGuard";
import type { ProviderId } from "./meta";

const HOSTS: Record<ProviderId, string[]> = {
  google: ["googleusercontent.com"],
  apple: [],
  facebook: ["fbcdn.net", "fbsbx.com"],
  instagram: ["cdninstagram.com", "fbcdn.net"],
  mock: [],
};
const MAX = 5 * 1024 * 1024;

export function avatarUrlAllowed(provider: ProviderId, raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  // The dev mock serves pictures from the local site itself.
  if (provider === "mock") return mockOAuthAllowed() && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  return HOSTS[provider].some((d) => h === d || h.endsWith(`.${d}`));
}

export async function copyAvatar(provider: ProviderId, raw: string | null, slug: string): Promise<string | null> {
  if (!raw || !avatarUrlAllowed(provider, raw)) return null;
  try {
    const res = await fetch(raw, { redirect: "error", signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok || !String(res.headers.get("content-type") || "").startsWith("image/")) return null;
    if (Number(res.headers.get("content-length") || 0) > MAX) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX || buf.length === 0) return null;
    const saved = await saveUpload(buf, { folder: slug, cloudFolder: `artfinity/artists/${slug}/profile`, keepOriginal: false, fileName: "avatar.jpg" });
    return saved.url;
  } catch (e) {
    console.warn("[oauth] avatar not copied", (e as Error)?.message);
    return null;
  }
}
