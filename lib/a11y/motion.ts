// "Pause animations": a site-wide switch (WCAG 2.2.2) on top of prefers-reduced-motion.
// Stored per browser; usePlay (components/motion/Stage.tsx) and the CSS in globals.css honour it.
const KEY = "af:motion";
export const MOTION_EVENT = "af:motion";

export function isMotionPaused(): boolean {
  if (typeof document === "undefined") return false;
  // The on-page switch was removed (prefers-reduced-motion covers it), so a choice saved by it no longer applies:
  // otherwise someone who paused once would stay paused with no way back.
  return document.documentElement.dataset.motion === "paused";
}

export function setMotionPaused(paused: boolean) {
  if (paused) document.documentElement.dataset.motion = "paused";
  else delete document.documentElement.dataset.motion;
  try {
    if (paused) window.localStorage.setItem(KEY, "paused");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the switch still works until the page is left */
  }
  window.dispatchEvent(new Event(MOTION_EVENT));
}
