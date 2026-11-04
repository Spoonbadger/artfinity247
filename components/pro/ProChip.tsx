import { cn } from "@/lib/utils";

/** Small "Pro" chip: ink with a yellow brush-dab. For Pro artists only. */
export default function ProChip({ className, title = "Artfinity Pro" }: { className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 -rotate-2 items-center gap-1 rounded-full bg-ink px-2 py-[1px] align-middle font-display text-[11px] font-extrabold uppercase leading-[18px] tracking-[0.06em] text-white",
        className,
      )}
    >
      <i aria-hidden="true" className="paint-dab !h-2 !w-2" style={{ ["--dab" as string]: "var(--af-sticker)" }} />
      Pro
    </span>
  );
}
