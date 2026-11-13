// Sales medals: earned by prints sold (paid orders, counting quantity).
// Shown next to an artist's name so buyers can see who has a track record.
export type MedalTier = "bronze" | "silver" | "gold";

export const MEDALS: { tier: MedalTier; min: number; label: string; color: string; ink: string }[] = [
  { tier: "gold", min: 50, label: "Gold seller", color: "#e3b23c", ink: "#4a3500" },
  { tier: "silver", min: 25, label: "Silver seller", color: "#b9bec7", ink: "#2c3038" },
  { tier: "bronze", min: 10, label: "Bronze seller", color: "#c98a5a", ink: "#3d1f08" },
];

export function medalFor(printsSold: number) {
  return MEDALS.find((m) => printsSold >= m.min) ?? null;
}

/** The next medal and how many more prints it takes, for the Studio's progress bar. */
export function nextMedal(printsSold: number) {
  const next = [...MEDALS].reverse().find((m) => printsSold < m.min);
  return next ? { ...next, remaining: next.min - printsSold } : null;
}
