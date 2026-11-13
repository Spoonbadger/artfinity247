// Owner settings for the trust engine (artwork auto-approval and auto-verification). Pure and client-safe.
// Stored in the admin settings JSON (lib/adminSettings.ts, key "trust"); read on the server by lib/trust/settings.ts.

export type TrustSettings = {
  /** Clean uploads go live without a person (needs an image check provider). */
  autoApprove: boolean;
  /** Artists whose checks all pass are verified without a person (needs an image check provider). */
  autoVerify: boolean;
  /** One in N auto-approved pieces lands on the "Spot check" list. 0 = off. */
  spotCheckEvery: number;
  /** A new artist's uploads past this many in 24 hours wait for a person. */
  velocityN: number;
  /** Days an account must be old to auto-verify, and below which an artist counts as new for the upload pace. */
  minAccountDays: number;
};

export type StoredTrust = Partial<TrustSettings>;

export const TRUST_DEFAULTS = { spotCheckEvery: 20, velocityN: 10, minAccountDays: 7 } as const;
export const TRUST_LIMITS = {
  spotCheckEvery: { min: 0, max: 1000 },
  velocityN: { min: 1, max: 50 },
  minAccountDays: { min: 0, max: 90 },
} as const;

export type ResolvedTrust = TrustSettings & {
  /** What the owner saved for each switch, or null when never saved (the default follows the provider). */
  saved: { autoApprove: boolean | null; autoVerify: boolean | null };
  /** An image check provider is set and can run. Auto-approval needs it; without it, it fails safe. */
  providerReady: boolean;
  /** A photo check that can see a person is set up (Sightengine faces). Auto-verify needs it; without it, everything waits. */
  verifyReady: boolean;
};

const int = (v: unknown, k: keyof typeof TRUST_LIMITS): number => {
  const n = Math.round(Number(v));
  const { min, max } = TRUST_LIMITS[k];
  return Number.isFinite(n) && v !== null && v !== "" ? Math.min(max, Math.max(min, n)) : TRUST_DEFAULTS[k];
};

/** Saved values with defaults. Each switch defaults ON only when the provider it needs is ready. */
export function resolveTrust(raw: unknown, providerReady: boolean, verifyReady: boolean = providerReady): ResolvedTrust {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const sw = (k: "autoApprove" | "autoVerify") => (typeof o[k] === "boolean" ? (o[k] as boolean) : null);
  const saved = { autoApprove: sw("autoApprove"), autoVerify: sw("autoVerify") };
  return {
    autoApprove: saved.autoApprove ?? providerReady,
    autoVerify: saved.autoVerify ?? verifyReady,
    spotCheckEvery: int(o.spotCheckEvery, "spotCheckEvery"),
    velocityN: int(o.velocityN, "velocityN"),
    minAccountDays: int(o.minAccountDays, "minAccountDays"),
    saved,
    providerReady,
    verifyReady,
  };
}

/** Validates an owner's save. Returns the clean value or an error to show. */
export function parseTrustInput(input: unknown): { value: TrustSettings; error?: undefined } | { error: string; value?: undefined } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (typeof o.autoApprove !== "boolean" || typeof o.autoVerify !== "boolean") return { error: "Pick on or off for both switches." };
  const num = (k: keyof typeof TRUST_LIMITS, label: string) => {
    const n = Number(o[k]);
    const { min, max } = TRUST_LIMITS[k];
    return Number.isInteger(n) && n >= min && n <= max ? n : `${label}: ${min} to ${max}.`;
  };
  const spot = num("spotCheckEvery", "Spot check");
  const vel = num("velocityN", "Uploads in 24 hours");
  const age = num("minAccountDays", "Account age");
  for (const v of [spot, vel, age]) if (typeof v === "string") return { error: v };
  return { value: { autoApprove: o.autoApprove, autoVerify: o.autoVerify, spotCheckEvery: spot as number, velocityN: vel as number, minAccountDays: age as number } };
}

/** True for one in `every` calls (rand is injectable for tests). */
export const pickSpotCheck = (every: number, rand: () => number = Math.random) => every > 0 && rand() < 1 / every;
