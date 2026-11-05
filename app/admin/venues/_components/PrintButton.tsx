"use client";

import { Printer } from "lucide-react";

export default function PrintButton({ className = "btn btn-ghost btn-sm", label = "Print" }: { className?: string; label?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden="true" />{label}
    </button>
  );
}
