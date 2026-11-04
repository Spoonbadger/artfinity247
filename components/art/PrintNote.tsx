/** Short, collapsible note on what the print is. */
export default function PrintNote({ className }: { className?: string }) {
  return (
    <details className={`group border-t border-line pt-4 ${className ?? ""}`}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-[15px] font-bold marker:hidden">
        About this print <span className="font-normal text-ink-2 group-open:hidden">· show</span>
      </summary>
      <p className="mt-1 text-[15px] text-ink-2">
        Giclée print on 310gsm archival paper, with a small white border for handling.
      </p>
    </details>
  );
}
