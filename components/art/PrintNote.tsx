/** Short, collapsible note on what the print is. */
export default function PrintNote({ className }: { className?: string }) {
  return (
    <details className={`group border-t border-line pt-4 ${className ?? ""}`}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-[15px] font-bold marker:hidden">
        About this print <span className="font-normal text-ink-2 group-open:hidden">· show</span>
      </summary>
      {/* Facts from the original site's purchase note */}
      <ul className="mt-1 grid gap-1 text-[15px] text-ink-2">
        <li>12-color giclée print on smooth matte, FSC-certified 310gsm archival paper.</li>
        <li>Keeps the artwork&apos;s original proportions within the size you pick.</li>
        <li>Includes a ½-inch handling border for safe production and framing.</li>
      </ul>
    </details>
  );
}
