import { FRAME_COLORS, sizeInches, type FrameColor, type PrintSize } from "@/components/art/pricing";

/**
 * What the frame is, in one short note under the color swatches. Only what the site already states:
 * the three colors (pricing.ts), "ready to hang" (the toggle's own copy) and that Artfinity sets
 * frame prices, the same for every artist (terms). Material, glazing, mat and hardware aren't
 * stated anywhere yet, so they stay out until the owner confirms them.
 */
export default function FrameNote({ color, size }: { color: FrameColor; size: PrintSize }) {
  const label = FRAME_COLORS.find((f) => f.key === color)?.label ?? "Black";
  return (
    <p className="border-t border-dashed border-line pt-2.5 text-[13.5px] leading-snug text-ink-2">
      <b className="font-semibold text-ink">{label} frame</b> made for the {sizeInches(size)} print. Priced by Artfinity, the same for every artist.
    </p>
  );
}
