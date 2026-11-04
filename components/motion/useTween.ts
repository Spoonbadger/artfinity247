"use client";

import { useEffect, useRef, useState } from "react";

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Eases a number toward `target` over `ms`. Jumps straight there with reduced motion. */
export function useTween(target: number, ms = 550) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const raf = useRef<number>();

  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden) {
      from.current = target;
      setValue(target);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const v = start + (target - start) * ease(t);
      from.current = v;
      setValue(v);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, ms]);

  return value;
}
