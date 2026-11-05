"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** First tab stop on every page: jumps past the header to the page's <main> (WCAG 2.4.1). */
export default function SkipLink() {
  const path = usePathname();
  const [target, setTarget] = useState<string | null>(null);

  // Layouts name their <main> differently (studio-main, none at all…); point at whichever is there.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return setTarget(null);
    if (!main.id) main.id = "main";
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    setTarget(main.id);
  }, [path]);

  if (!target) return null;
  return (
    <a href={`#${target}`} className="btn btn-blue btn-sm sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100]">
      Skip to content
    </a>
  );
}
