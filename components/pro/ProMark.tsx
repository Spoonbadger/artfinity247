import { cn } from "@/lib/utils";

const LOOP = "M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z";

/** Compact Infinity mark: a yellow ∞ with a thin ink outline so it reads on light walls. For tight spots like the sidebar. */
export default function ProMark({ className, title = "Infinity plan" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} className={cn("h-5 w-5 shrink-0", className)} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <title>{title}</title>
      <path d={LOOP} stroke="var(--af-ink)" strokeWidth={4.6} />
      <path d={LOOP} stroke="var(--af-sticker)" strokeWidth={2.6} />
    </svg>
  );
}
