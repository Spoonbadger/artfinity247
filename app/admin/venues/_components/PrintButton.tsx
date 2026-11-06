"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/** `auto`: open the print dialog once the page (fonts, QR image) has loaded, so "Venue kit" is one click to print. */
export default function PrintButton({ className = "btn btn-ghost btn-sm", label = "Print", auto = false }: { className?: string; label?: string; auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    let done = false;
    const go = () => { if (done) return; done = true; document.fonts.ready.then(() => window.print()); };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, [auto]);
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden="true" />{label}
    </button>
  );
}
