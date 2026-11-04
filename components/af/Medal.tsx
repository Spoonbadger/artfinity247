import { MEDALS, type MedalTier } from "@/lib/medals";
import { cn } from "@/lib/utils";

/**
 * Sales medal: a painted disc on a brushed rosette with two ribbon tails.
 * Reads at 16px inline next to a name and holds up at 64px+.
 *   <Medal tier="gold" />                 inline, 18px
 *   <Medal tier="silver" size={64} />     large
 *   <Medal tier="bronze" showLabel />     medal + "Bronze seller" chip
 */

type Paint = { base: string; light: string; shade: string; ink: string; ribbon: string; ribbon2: string };

export const MEDAL_PAINT: Record<MedalTier, Paint> = {
  gold: { base: "#e3b23c", light: "#f8dc85", shade: "#a87a12", ink: "#4a3500", ribbon: "#2b37f0", ribbon2: "#1b24b0" },
  silver: { base: "#bcc1ca", light: "#eceef2", shade: "#7d838e", ink: "#2c3038", ribbon: "#ff5a36", ribbon2: "#cf3a1a" },
  bronze: { base: "#c98a5a", light: "#efc09a", shade: "#8c5226", ink: "#3d1f08", ribbon: "#24707c", ribbon2: "#16505a" },
};

const LOCKED: Paint = { base: "#efede7", light: "#f7f6f2", shade: "#c9c6bd", ink: "#b3afa5", ribbon: "#e1ded6", ribbon2: "#d3d0c7" };

export function medalLabel(tier: MedalTier) {
  const m = MEDALS.find((x) => x.tier === tier)!;
  return { name: m.label, long: `${m.label} · ${m.min}+ prints sold` };
}

// Fixed wobble so each bump is a little different, like a hand-cut paper rosette.
const WOBBLE = [1, 0.78, 1.18, 0.9, 1.08, 0.82, 1.2, 0.95, 1.05, 0.85, 1.14, 0.92, 1.1, 0.8, 1.16, 0.97];

/** Scalloped ring: n bumps around (cx, cy). */
function scallop(cx: number, cy: number, r: number, amp: number, n: number) {
  const pt = (a: number, rad: number) => `${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`;
  let d = `M${pt(-Math.PI / 2, r)}`;
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2;
    const rr = i === n - 1 ? r : r + (WOBBLE[(i + 3) % WOBBLE.length] - 1) * 0.9;
    d += `Q${pt((a0 + a1) / 2 + (WOBBLE[i % WOBBLE.length] - 1) * 0.08, r + amp * 2 * WOBBLE[i % WOBBLE.length])} ${pt(a1, rr)}`;
  }
  return d + "Z";
}

function star(cx: number, cy: number, R: number, r: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`;
  }
  return d + "Z";
}

const ROSETTE_SM = scallop(24, 20, 15.2, 1.3, 11);
const ROSETTE_LG = scallop(24, 20, 15.2, 1.2, 16);
const STAR = star(24, 20.2, 5.4, 2.4);
// A slightly lopsided, hand-painted disc.
const DISC = "M24.3 8.4c6.7-.2 11.9 5.1 11.7 11.8-.2 6.5-5.3 11.6-12 11.5-6.6-.1-11.8-5.2-11.7-11.9.1-6.4 5.3-11.2 12-11.4z";

export function MedalMark({ tier, size = 18, locked = false, className }: { tier: MedalTier; size?: number; locked?: boolean; className?: string }) {
  const p = locked ? LOCKED : MEDAL_PAINT[tier];
  const detailed = size >= 28;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={cn("inline-block shrink-0 align-middle", className)} aria-hidden="true" focusable="false">
      {/* ribbon tails */}
      <path d="M17.6 26.5 10.4 44.6l5.1-2.3 3.6 4.4 6.4-17.2z" fill={p.ribbon} />
      <path d="M30.4 26.5l7.2 18.1-5.1-2.3-3.6 4.4-6.4-17.2z" fill={p.ribbon2} />
      {detailed && <path d="M15.2 33.5c1.1.5 2 1.2 2.6 2.1M33 33.5c-1.1.5-2 1.2-2.6 2.1" stroke="#fff" strokeOpacity=".35" strokeWidth="1.1" strokeLinecap="round" fill="none" />}
      {/* rosette */}
      <path d={detailed ? ROSETTE_LG : ROSETTE_SM} fill={p.light} stroke={p.shade} strokeWidth={detailed ? 1.1 : 1.6} strokeLinejoin="round" strokeDasharray={locked ? "2.2 2" : undefined} />
      {/* painted disc */}
      <path d={DISC} fill={p.base} />
      {detailed && (
        <>
          {/* brush texture: a couple of dragged strokes and a wet highlight */}
          <path d="M14.9 22.4c2.6 4.6 9.2 6.9 14.6 3.6" stroke={p.shade} strokeOpacity=".5" strokeWidth="1.7" strokeLinecap="round" fill="none" />
          <path d="M28.6 11.6c2.7 1.4 4.6 3.9 5.2 6.9" stroke={p.shade} strokeOpacity=".35" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M16.6 16c.5-2.9 3.3-4.8 6-4.2 1 .3.7 1.6-.3 1.8-2.1.5-3.3 1.6-4 3-.4 1-1.8.5-1.7-.6z" fill="#fff" fillOpacity={locked ? 0.5 : 0.75} />
        </>
      )}
      {!detailed && <path d="M17.4 15.6c.9-2 2.6-3.1 4.6-3.2" stroke="#fff" strokeOpacity=".7" strokeWidth="2.2" strokeLinecap="round" fill="none" />}
      <path d={STAR} fill={p.ink} fillOpacity={locked ? 0.6 : 0.82} strokeLinejoin="round" stroke={p.ink} strokeOpacity={locked ? 0.6 : 0.82} strokeWidth=".8" />
    </svg>
  );
}

export default function Medal({
  tier,
  size = 18,
  showLabel = false,
  locked = false,
  className,
}: {
  tier: MedalTier;
  size?: number;
  showLabel?: boolean;
  locked?: boolean;
  className?: string;
}) {
  const { name, long } = medalLabel(tier);
  if (showLabel) {
    const p = MEDAL_PAINT[tier];
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 rounded-full border-[1.5px] py-0.5 pl-1 pr-2.5 font-body text-[12.5px] font-bold tracking-normal [font-variation-settings:normal]", className)}
        style={{ borderColor: p.shade, background: p.light, color: p.ink }}
        title={long}
      >
        <MedalMark tier={tier} size={size} />
        <span>{name}</span>
        <span className="sr-only"> · {MEDALS.find((m) => m.tier === tier)!.min}+ prints sold</span>
      </span>
    );
  }
  return (
    <span role="img" aria-label={locked ? `${name} (not yet earned)` : long} title={locked ? `${name}: not yet` : long} className={cn("inline-flex shrink-0", className)}>
      <MedalMark tier={tier} size={size} locked={locked} />
    </span>
  );
}
