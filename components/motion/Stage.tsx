"use client";

import { ElementType, HTMLAttributes, ReactNode, useEffect, useRef, useState } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Tracks whether an element should be animating: on screen, tab visible, motion allowed.
 * `armed` is true only when the element started below the fold, so one-shot flourishes
 * can safely reset before the viewer ever sees it (content above the fold never blinks).
 */
export function usePlay<T extends HTMLElement>({ once = false, rootMargin = "0px", threshold = 0.15 } = {}) {
  const ref = useRef<T>(null);
  const [play, setPlay] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const mq = window.matchMedia(REDUCED);
    if (!mq.matches && el.getBoundingClientRect().top > window.innerHeight) setArmed(true);
    let inView = false;
    let done = false;
    const update = () => {
      if (done) return;
      const on = inView && !document.hidden && !mq.matches;
      setPlay(on);
      if (on && once) done = true;
    };
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; update(); }, { rootMargin, threshold });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    mq.addEventListener?.("change", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
      mq.removeEventListener?.("change", update);
    };
  }, [once, rootMargin, threshold]);

  return { ref, play, armed };
}

type StageProps = HTMLAttributes<HTMLElement> & { as?: ElementType; once?: boolean; rootMargin?: string; threshold?: number; children?: ReactNode };

/**
 * A wrapper that sets `data-play` while it is worth animating (on screen, tab visible,
 * motion allowed) and `data-armed` if it started off screen. CSS keys every animation off
 * `[data-play]`, so at rest, before hydration, offscreen and with reduced motion, the
 * finished frame shows. Loops reset to that frame when they scroll away.
 */
export default function Stage({ as: Tag = "div", once, rootMargin, threshold, children, ...rest }: StageProps) {
  const { ref, play, armed } = usePlay<HTMLElement>({ once, rootMargin, threshold });
  return (
    <Tag ref={ref} data-play={play ? "" : undefined} data-armed={armed ? "" : undefined} {...rest}>
      {children}
    </Tag>
  );
}
