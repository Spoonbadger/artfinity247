"use client";
// The second, looping copy of a Marquee row. It has to stay clickable and hoverable (once the row has drifted a
// while, it's the copy people see), but it shouldn't be read twice or tabbed through twice: so it's aria-hidden,
// and its links and buttons are taken out of the Tab order. (`inert` did both, but also killed clicks and hover.)
import { useEffect, useRef, type ReactNode } from "react";

export default function MarqueeCopy({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [tabindex]").forEach((el) => el.setAttribute("tabindex", "-1"));
  });
  return <div ref={ref} className={className} aria-hidden="true">{children}</div>;
}
