const COLORS = ["var(--af-scan)", "var(--af-sticker)", "var(--af-coral)"];

/** Three paint dabs, landing one after another. Use in segment-level loading.tsx files. */
export default function PaintLoader({ label = "Mixing paint…" }: { label?: string }) {
  return (
    <div className="grid min-h-[60svh] place-content-center justify-items-center gap-4" role="status" aria-live="polite">
      <style>{`@keyframes af-dab{0%,100%{transform:translateY(0) rotate(-14deg) scale(.85);opacity:.45}40%{transform:translateY(-10px) rotate(8deg) scale(1.1);opacity:1}}`}</style>
      <div className="flex items-end gap-2.5" aria-hidden="true">
        {COLORS.map((c, i) => (
          <span key={i} className="paint-dab h-5 w-5" style={{ ["--dab" as string]: c, animation: `af-dab 1.1s ease-in-out ${i * 0.16}s infinite` }} />
        ))}
      </div>
      <span className="text-[14px] font-semibold text-ink-2">{label}</span>
    </div>
  );
}
