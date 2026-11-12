// Instagram ownership for auto-verification (server only). Instagram sign-in (lib/oauth/providers/instagram.ts)
// tells us the @username of the account that signed in, but OAuthAccount doesn't keep it. So each time an artist
// signs in with Instagram, connects it, or signs up with it, we note the username in an AdminAction row
// ("trust.instagram_owner", by "system"). A verification request whose Instagram handle matches a noted username,
// for an Instagram account still connected to the artist, proves they own it. No schema change, no new provider.
import { prisma } from "@/lib/prisma";
import { enabledProviders } from "@/lib/oauth/providers";
import { instagramHandle } from "./verification";
import { IG_PROOF_ACTION, recordInstagramProofWith } from "./instagramProof";

export { IG_PROOF_ACTION };

/** Instagram sign-in is set up here, so artists can prove a handle by connecting it. */
export const instagramSignInAvailable = () => enabledProviders().includes("instagram");

/** Called after a successful Instagram sign-in, connect or sign-up. Record-only: never throws (./instagramProof.ts). */
export function recordInstagramProof(artistId: string, providerAccountId: string, username: string | null | undefined): Promise<void> {
  try {
    return recordInstagramProofWith(prisma, artistId, providerAccountId, username).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

/** True when the Instagram link in the evidence belongs to an Instagram account connected to this artist. */
export async function instagramProven(artistId: string, instagramUrl: string | null | undefined): Promise<boolean> {
  const handle = instagramHandle(instagramUrl);
  if (!handle) return false;
  const [accounts, proofs] = await Promise.all([
    prisma.oAuthAccount.findMany({ where: { artistId, provider: "instagram" }, select: { providerAccountId: true } }),
    prisma.adminAction.findMany({ where: { action: IG_PROOF_ACTION, targetType: "artist", targetId: artistId }, select: { details: true }, take: 50 }),
  ]).catch(() => [[], []] as const);
  const connected = new Set(accounts.map((a) => a.providerAccountId));
  return proofs.some((p) => {
    const d = (p.details || {}) as Record<string, unknown>;
    return d.username === handle && typeof d.providerAccountId === "string" && connected.has(d.providerAccountId);
  });
}
