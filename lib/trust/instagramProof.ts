// The record-only core of recordInstagramProof (lib/trust/instagram.ts), with the database passed in, so the unit
// check can prove it never throws. No imports: node --test loads it directly.

export const IG_PROOF_ACTION = "trust.instagram_owner";

type ProofDb = {
  adminAction: {
    findFirst(args: unknown): Promise<{ details: unknown } | null>;
    create(args: unknown): Promise<unknown>;
  };
};

/**
 * Notes the Instagram @username an artist signed in, connected or signed up with. Strictly record-only: it never
 * throws and never rejects, whatever it's given and whatever the database does, so it can't break sign-in.
 */
export async function recordInstagramProofWith(db: ProofDb, artistId: unknown, providerAccountId: unknown, username: unknown): Promise<void> {
  try {
    const u = typeof username === "string" ? username.trim().toLowerCase() : "";
    if (typeof artistId !== "string" || !artistId || typeof providerAccountId !== "string" || !providerAccountId || !/^[a-z0-9._]{1,30}$/.test(u)) return;
    const last = await db.adminAction.findFirst({
      where: { action: IG_PROOF_ACTION, targetType: "artist", targetId: artistId },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });
    const d = (last?.details && typeof last.details === "object" ? last.details : {}) as Record<string, unknown>;
    if (d.username === u && d.providerAccountId === providerAccountId) return;
    await db.adminAction.create({
      data: {
        adminId: "system", adminEmail: "auto-check", action: IG_PROOF_ACTION, targetType: "artist", targetId: artistId,
        summary: `Signed in with Instagram as @${u}`, details: { username: u, providerAccountId },
      },
    });
  } catch (err) {
    try {
      console.error("IG_PROOF_SAVE_FAIL", err);
    } catch {
      // nothing left to do
    }
  }
}
